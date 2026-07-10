#!/usr/bin/env python3
"""Create a license-recorded university media package from sakalmanya_uni_dataset.xlsx.

Only Wikimedia Commons images with a clear CC or public-domain licence are used for
campus photos. University logos are deliberately not downloaded automatically: their
brand terms need an individual manual review.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import sys
import time
import zipfile
from datetime import date
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd
from PIL import Image, ImageDraw, ImageOps


DATASET_NAME = "sakalmanya_uni_dataset.xlsx"
ROOT = Path(__file__).resolve().parents[1]
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "SakalmanyaUniversityMediaBuilder/1.0 (iletisim@sakalmanya.com.tr)"
ALLOWED_LICENSE_MARKERS = ("CC", "Public domain", "CC0")
EXCLUDED_TITLE_WORDS = (
    "logo", "wappen", "coat of arms", "flag", "map", "plan", "interior",
    "innen", "portrait", "selfie", "student", "aula", "auditorium", "mensa",
)
BUILDING_WORDS = ("universit", "university", "hochschule", "campus", "gebäude", "gebaeude", "hauptgebäude", "hauptgebaeude", "building")
# The automatic search can find associated but unsuitable media (a seal, a document,
# a hospital sign, etc.). Keep those out rather than publishing a misleading image.
REJECTED_AUTOMATIC_CANDIDATES = {
    "fau-erlangen-nuernberg", "goethe-universitaet-frankfurt", "tum",
    "universitaet-bayreuth", "universitaet-bonn", "universitaet-goettingen",
    "universitaet-hamburg", "universitaet-leipzig",
    "johannes-gutenberg-universitaet-mainz", "universitaet-stuttgart",
    "universitaet-wuerzburg",
}


def plain(value):
    if value is None:
        return None
    value = re.sub(r"<[^>]+>", "", str(value))
    value = html.unescape(value).replace("\n", " ").strip()
    return re.sub(r"\s+", " ", value) or None


def request_json(url):
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=40) as response:
        return json.load(response)


def download(url):
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=60) as response:
        content_type = response.headers.get_content_type()
        return response.read(), content_type


def commons_candidates(name, city):
    query = f'"{name}" {city}'
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": "18",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|size|mime",
        "iiurlwidth": "1920",
    }
    payload = request_json(f"{COMMONS_API}?{urlencode(params)}")
    pages = payload.get("query", {}).get("pages", {}).values()
    result = []
    name_tokens = {token for token in re.split(r"[^a-z0-9]+", name.lower()) if len(token) > 2}
    city_tokens = {token for token in re.split(r"[^a-z0-9]+", city.lower()) if len(token) > 2}
    for page in pages:
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}
        licence = plain((meta.get("LicenseShortName") or {}).get("value"))
        mime = info.get("mime")
        title = page.get("title", "")
        title_lower = title.lower()
        if not licence or not any(marker.lower() in licence.lower() for marker in ALLOWED_LICENSE_MARKERS):
            continue
        if mime not in {"image/jpeg", "image/png", "image/tiff"}:
            continue
        if not info.get("thumburl") or any(word in title_lower for word in EXCLUDED_TITLE_WORDS):
            continue
        score = 0
        score += sum(token in title_lower for token in name_tokens) * 5
        score += sum(token in title_lower for token in city_tokens) * 2
        score += sum(word in title_lower for word in BUILDING_WORDS) * 2
        width, height = int(info.get("width") or 0), int(info.get("height") or 0)
        if width >= 1400:
            score += 2
        if width and height and width / max(height, 1) >= 1.25:
            score += 1
        result.append({
            "score": score,
            "title": title,
            "pageUrl": info.get("descriptionurl"),
            "originalFileUrl": info.get("url"),
            "thumbUrl": info.get("thumburl"),
            "license": licence,
            "licenseUrl": plain((meta.get("LicenseUrl") or {}).get("value")),
            "author": plain((meta.get("Artist") or {}).get("value")),
            "width": width,
            "height": height,
        })
    return sorted(result, key=lambda item: (-item["score"], item["title"]))


def convert_to_webp(content, output_path):
    """Create a metadata-free, reasonably small WebP without excessive compression."""
    with Image.open(BytesIO(content)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        width, height = image.size
        if width > 1920:
            height = round(height * 1920 / width)
            image = image.resize((1920, height), Image.Resampling.LANCZOS)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        # 82 is the target quality. Retry a few sensible values for unusually
        # detailed photographs so cards do not ship multi-megabyte images.
        for quality in (82, 78, 74, 70, 66, 62, 58, 54):
            image.save(output_path, "WEBP", quality=quality, method=6)
            if output_path.stat().st_size <= 500 * 1024:
                break
        if output_path.stat().st_size > 500 * 1024:
            # A slightly smaller source preserves more detail than pushing WebP
            # quality too low, while still meeting the responsive-card budget.
            width, height = image.size
            if width > 1600:
                image = image.resize((1600, round(height * 1600 / width)), Image.Resampling.LANCZOS)
            image.save(output_path, "WEBP", quality=54, method=6)
    if output_path.stat().st_size == 0:
        raise ValueError(f"0 byte output: {output_path}")


def make_contact_sheet(entries, output_path):
    cards = []
    for entry in entries:
        image_path = entry.get("previewPath")
        if not image_path or not Path(image_path).is_file():
            continue
        with Image.open(image_path) as image:
            preview = ImageOps.fit(image.convert("RGB"), (300, 180), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (320, 235), "white")
        canvas.paste(preview, (10, 10))
        draw = ImageDraw.Draw(canvas)
        draw.text((10, 196), entry["slug"][:42], fill="black")
        draw.text((10, 214), entry["candidate"]["title"][:42], fill="black")
        cards.append(canvas)
    if not cards:
        return
    columns = 3
    rows = (len(cards) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 320, rows * 235), "#eeeeee")
    for index, card in enumerate(cards):
        sheet.paste(card, ((index % columns) * 320, (index // columns) * 235))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "JPEG", quality=88)


def logo_record(university):
    return {
        "status": "needs-manual-review",
        "path": None,
        "sourceUrl": university["officialWebsite"],
        "sourceType": "official-website",
        "license": None,
        "attribution": None,
        "accessedAt": str(date.today()),
        "notes": "Logo indirilmedi. Üniversitenin marka kullanım koşulları manuel olarak doğrulanmalıdır.",
    }


def campus_record(candidate, slug):
    if not candidate:
        return {
            "status": "missing",
            "path": None,
            "sourceUrl": None,
            "originalFileUrl": None,
            "sourceType": None,
            "license": None,
            "author": None,
            "attribution": None,
            "licenseUrl": None,
            "accessedAt": str(date.today()),
            "notes": "Açık lisanslı, uygun dış cephe görseli bulunamadı.",
        }
    author = candidate["author"] or "Bilinmeyen yazar"
    attribution = f"Fotoğraf: {author}, Wikimedia Commons, {candidate['license']}"
    return {
        "status": "available",
        "path": f"/assets/universities/{slug}/campus.webp",
        "sourceUrl": candidate["pageUrl"],
        "originalFileUrl": candidate["originalFileUrl"],
        "sourceType": "wikimedia-commons",
        "license": candidate["license"],
        "author": author,
        "attribution": attribution,
        "licenseUrl": candidate["licenseUrl"],
        "accessedAt": str(date.today()),
        "notes": None,
    }


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--assets-root", type=Path, default=ROOT / "assets" / "universities")
    parser.add_argument("--server-data", type=Path, default=ROOT / "server-data")
    parser.add_argument("--package-dir", type=Path, default=ROOT / "outputs" / "university-media")
    parser.add_argument("--zip", type=Path, default=ROOT / "outputs" / "sakalmanya_university_media.zip")
    parser.add_argument("--preview-dir", type=Path, default=Path("/tmp/sakalmanya-media-previews"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.dataset.name != DATASET_NAME:
        raise SystemExit(f"Dataset dosyası {DATASET_NAME} olmalıdır.")
    universities = pd.read_excel(args.dataset, sheet_name="Universities")
    required = {"university_id", "name", "slug", "city", "official_website"}
    missing = required - set(universities.columns)
    if missing:
        raise SystemExit(f"Universities sheet eksik kolonlar: {', '.join(sorted(missing))}")

    if args.package_dir.exists():
        shutil.rmtree(args.package_dir)
    package_root = args.package_dir
    package_universities = package_root / "universities"
    staged = []
    manifest = []

    for row in universities.to_dict("records"):
        university = {
            "universityId": plain(row["university_id"]),
            "universityName": plain(row["name"]),
            "slug": plain(row["slug"]),
            "city": plain(row["city"]),
            "officialWebsite": plain(row["official_website"]),
        }
        candidates = commons_candidates(university["universityName"], university["city"])
        candidate = candidates[0] if candidates else None
        if university["slug"] in REJECTED_AUTOMATIC_CANDIDATES:
            candidate = None
        if candidate:
            preview_path = args.preview_dir / f"{university['slug']}.jpg"
            try:
                content, content_type = download(candidate["thumbUrl"])
                if not content_type.startswith("image/"):
                    raise ValueError(f"Unexpected MIME type: {content_type}")
                preview_path.parent.mkdir(parents=True, exist_ok=True)
                preview_path.write_bytes(content)
                staged.append({"slug": university["slug"], "candidate": candidate, "previewPath": str(preview_path)})
            except Exception as error:
                print(f"WARN preview failed {university['slug']}: {error}", file=sys.stderr)
                candidate = None

        logo = logo_record(university)
        campus = campus_record(candidate, university["slug"])
        source_payload = {**university, "logo": logo, "campus": campus}
        university_package = package_universities / university["slug"]
        write_json(university_package / "sources.json", source_payload)

        if candidate and not args.dry_run:
            try:
                content, content_type = download(candidate["thumbUrl"])
                if not content_type.startswith("image/"):
                    raise ValueError(f"Unexpected MIME type: {content_type}")
                convert_to_webp(content, university_package / "campus.webp")
                convert_to_webp(content, args.assets_root / university["slug"] / "campus.webp")
            except Exception as error:
                campus = campus_record(None, university["slug"])
                source_payload["campus"] = campus
                write_json(university_package / "sources.json", source_payload)
                print(f"WARN campus conversion failed {university['slug']}: {error}", file=sys.stderr)

        manifest.append({
            "universityId": university["universityId"],
            "slug": university["slug"],
            "universityName": university["universityName"],
            "logoPath": logo["path"],
            "campusImagePath": campus["path"],
            "logoStatus": logo["status"],
            "campusStatus": campus["status"],
            "requiresAttribution": bool(campus["attribution"]),
            "attribution": campus["attribution"],
            "licenseUrl": campus["licenseUrl"],
            "sourceUrl": campus["sourceUrl"],
            "originalFileUrl": campus["originalFileUrl"],
            "sourceFile": f"universities/{university['slug']}/sources.json",
        })
        time.sleep(0.2)

    write_json(package_root / "manifest.json", manifest)
    write_json(args.server_data / "university-media-manifest.json", manifest)
    sources_root = args.server_data / "university-media-sources"
    for item in manifest:
        source = package_root / item["sourceFile"]
        target = sources_root / f"{item['slug']}.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    available_campuses = sum(item["campusStatus"] == "available" for item in manifest)
    missing_campuses = len(manifest) - available_campuses
    readme = f"""# Sakalmanya University Media\n\nBu paket `{DATASET_NAME}` temel alınarak oluşturulmuştur. Her klasör dataset slug’ı ile birebir eşleşir.\n\n- Üniversite sayısı: {len(manifest)}\n- Açık lisanslı kampüs fotoğrafı: {available_campuses}\n- Eksik kampüs fotoğrafı: {missing_campuses}\n- Logo: otomatik indirilmemiştir; marka kullanım koşulları okul bazında manuel doğrulanmalıdır.\n\nWikimedia Commons görsellerindeki atıf ve lisans bilgileri `sources.json` içinde korunur. `needs-manual-review` veya `license-unclear` durumundaki dosyalar yayına alınmamalıdır. Üniversitelerin logo ve görselleri Sakalmanya’nın mülkiyeti olarak sunulmamalıdır. Görseller yeniden dağıtılırken ilgili lisans şartları ayrıca kontrol edilmelidir.\n"""
    (package_root / "README.md").write_text(readme, encoding="utf-8")

    if not args.dry_run:
        args.zip.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(args.zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for file in package_root.rglob("*"):
                if file.is_file():
                    archive.write(file, Path("university-media") / file.relative_to(package_root))
    make_contact_sheet(staged, args.preview_dir / "contact-sheet.jpg")
    print(json.dumps({"universities": len(manifest), "campusAvailable": available_campuses, "campusMissing": missing_campuses, "zip": str(args.zip)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
