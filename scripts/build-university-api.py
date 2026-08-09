#!/usr/bin/env python3
"""Build the private Vercel university function from sakalmanya_uni_dataset.xlsx.

Usage
-----
    python3 scripts/build-university-api.py [path/to/sakalmanya_uni_dataset.xlsx]
    python3 scripts/build-university-api.py --keep-dataset

`--keep-dataset` recompiles api/universities.js from the template and the translation
tables while reusing the dataset already embedded in it. Use it after changing handler
code or scripts/value-translations.json, when the xlsx is not at hand.

Translating the free-text columns
---------------------------------
Every column listed below is read as `<base>_tr` / `<base>_de` / `<base>_en`. Only `_tr`
is required; add a `_de` / `_en` column to the sheet and the field is served in that
language, otherwise it falls back to Turkish. Short enum-like values (state, type,
uni-assist status, prep-course label, QS placement) are NOT translated here — they live
in scripts/value-translations.json.

    Universities            school_intro, city_intro, popularity_reason,
                            university_long_intro, why_choose_this_university,
                            city_student_life, city_transport, city_cost_of_living,
                            city_history, city_historical_note, city_economy,
                            city_industries, student_jobs_note, turkish_students_note
    Deadlines               deadline_display
    IntensiveGermanCourses  course_criteria_match
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

try:
    import pandas as pd
except ImportError:  # only the xlsx build path needs pandas
    pd = None


DATASET_NAME = "sakalmanya_uni_dataset.xlsx"
ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "scripts" / "universities-api-template.js"
TRANSLATIONS_PATH = ROOT / "scripts" / "value-translations.json"
OUTPUT_PATH = ROOT / "api" / "universities.js"
SITEMAP_PATH = ROOT / "sitemap.xml"
MEDIA_MANIFEST_PATH = ROOT / "server-data" / "university-media-manifest.json"

LANGUAGES = ("tr", "de", "en")

# Locale roots that can hold a hand-written static detail page per slug. The build
# scans these so detailUrl only points at a localised page that actually exists.
LOCALE_DETAIL_ROOTS = {
    "de": ROOT / "de" / "universitaeten",
    "en": ROOT / "en" / "universities",
}

TRANSLATIONS = json.loads(TRANSLATIONS_PATH.read_text(encoding="utf-8"))
VALUE_LABELS = TRANSLATIONS["values"]


def text(value):
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    value = str(value).strip()
    return value or None


def localized_text(record, base, fallback=None):
    """Return a {tr,de,en} object when a translation column is filled, else the raw string.

    Columns are read as `<base>_tr` / `<base>_de` / `<base>_en`; only `_tr` is required.
    Keeping the plain string when nothing is translated leaves the compiled payload
    unchanged for rows the editor has not localised yet.
    """
    values = {lang: text(record.get(f"{base}_{lang}")) for lang in LANGUAGES}
    turkish = values["tr"] or fallback
    if not values["de"] and not values["en"]:
        return turkish
    return {lang: values[lang] or turkish for lang in LANGUAGES}


def qs_label(value):
    value = text(value)
    if not value:
        return "Henüz doğrulanmadı"
    if value == "not_in_qs_top500_2026":
        return "QS Top 500 dışında"
    return value if value.startswith("#") else f"#{value}"


def read_required_sheet(path, sheet, columns):
    frame = pd.read_excel(path, sheet_name=sheet)
    missing = sorted(set(columns) - set(frame.columns))
    if missing:
        raise ValueError(f"{sheet} sheet eksik kolonlar içeriyor: {', '.join(missing)}")
    return frame


def load_media_manifest():
    """Load generated media metadata without making the raw package public."""
    if not MEDIA_MANIFEST_PATH.exists():
        return {}
    manifest = json.loads(MEDIA_MANIFEST_PATH.read_text(encoding="utf-8"))
    if not isinstance(manifest, list):
        raise ValueError("university-media-manifest.json bir liste olmalıdır")
    media_by_slug = {}
    for item in manifest:
        slug = text(item.get("slug"))
        if not slug:
            continue
        media_by_slug[slug] = item
    return media_by_slug


def localized_option(value):
    """Filter dropdown entry. Labels come from the shared value-translations.json table."""
    label = VALUE_LABELS.get(value)
    return {"value": value, "label": label or {lang: value for lang in LANGUAGES}}


def scan_locale_detail_pages():
    """Map each locale to the slugs that have a hand-written static detail page."""
    pages = {}
    for lang, root in LOCALE_DETAIL_ROOTS.items():
        if not root.exists():
            pages[lang] = []
            continue
        pages[lang] = sorted(
            entry.name for entry in root.iterdir()
            if entry.is_dir() and (entry / "index.html").exists()
        )
    return pages


def build_dataset(path):
    if pd is None:
        raise SystemExit("xlsx okumak için pandas gerekli: pip install pandas openpyxl")
    universities = read_required_sheet(path, "Universities", [
        "university_id", "name", "slug", "city", "state", "type", "official_website",
        "application_portal_for_turkish_applicants", "last_checked_at", "source_url",
        "qs_world_rank_2026", "qs_source_url", "school_intro_tr", "city_intro_tr",
        "popularity_reason_tr", "filter_eyalet", "filter_tur", "filter_almanca_kursu",
        "filter_seviye", "filter_uni_assist",
    ])
    deadlines = read_required_sheet(path, "Deadlines", [
        "university_id", "degree_level", "deadline_date_iso", "deadline_display_tr",
        "application_portal_for_turkish_applicants", "application_portal_category",
        "source_url", "last_checked_at",
    ])
    courses = read_required_sheet(path, "IntensiveGermanCourses", [
        "university_id", "course_name", "course_type", "possible_aufenthg_16_relevance",
        "target_degree_level", "required_german_level", "duration_intensity", "source_url",
        "last_checked_at", "prep_course_status", "prep_course_filter_label",
        "course_criteria_match_tr",
    ])
    filter_options = read_required_sheet(path, "Filter_Options", [
        "EYALET", "TÜR", "ALMANCA KURSU", "SEVİYE", "UNI-ASSIST",
    ])

    if universities["university_id"].duplicated().any() or universities["slug"].duplicated().any():
        raise ValueError("Universities sheet içinde tekrar eden university_id veya slug var")

    deadline_lookup = {}
    for record in deadlines.to_dict("records"):
        university_id = text(record["university_id"])
        level = text(record["degree_level"])
        if level not in {"Bachelor", "Master"}:
            continue
        deadline_lookup[(university_id, level)] = {
            "display": localized_text(record, "deadline_display", fallback="Program bazlı kontrol edilmeli"),
            "date": text(record["deadline_date_iso"]),
            "portal": text(record["application_portal_for_turkish_applicants"]),
            "portalCategory": text(record["application_portal_category"]),
            "sourceUrl": text(record["source_url"]),
            "lastChecked": text(record["last_checked_at"]),
        }

    course_lookup = {}
    for record in courses.to_dict("records"):
        course_lookup[text(record["university_id"])] = {
            "status": text(record["prep_course_status"]),
            "label": text(record["prep_course_filter_label"]) or "Henüz doğrulanmadı",
            "name": text(record["course_name"]),
            "type": text(record["course_type"]),
            "duration": text(record["duration_intensity"]),
            "weeklyHours": text(record.get("weekly_hours")),
            "targetExam": text(record.get("target_exam")),
            "targetDegreeLevel": text(record["target_degree_level"]),
            "requiredLevel": text(record["required_german_level"]),
            "residenceRelevance": text(record["possible_aufenthg_16_relevance"]),
            "criteriaMatch": localized_text(record, "course_criteria_match"),
            "sourceUrl": text(record["source_url"]),
            "lastChecked": text(record["last_checked_at"]),
        }

    media_by_slug = load_media_manifest()
    records = []
    for record in universities.to_dict("records"):
        university_id = text(record["university_id"])
        bachelor = deadline_lookup.get((university_id, "Bachelor"))
        master = deadline_lookup.get((university_id, "Master"))
        course = course_lookup.get(university_id)
        if not bachelor or not master or not course:
            raise ValueError(f"{university_id} için deadline veya kurs kaydı eksik")
        slug = text(record["slug"])
        media = media_by_slug.get(slug, {})
        records.append({
            "id": university_id,
            "name": text(record["name"]),
            "slug": slug,
            "city": text(record["city"]),
            "state": text(record["state"]),
            "type": text(record["type"]),
            "officialWebsite": text(record["official_website"]),
            "applicationPortal": text(record["application_portal_for_turkish_applicants"]),
            "lastChecked": text(record["last_checked_at"]),
            "sourceUrl": text(record["source_url"]),
            "qsWorldRanking2026": qs_label(record["qs_world_rank_2026"]),
            "qsSourceUrl": text(record["qs_source_url"]),
            "schoolIntro": localized_text(record, "school_intro"),
            "cityIntro": localized_text(record, "city_intro"),
            "popularityReason": localized_text(record, "popularity_reason"),
            "logoPath": text(record.get("logoPath")) or text(record.get("logo_path")) or text(media.get("logoPath")),
            "campusImagePath": text(record.get("campusImagePath")) or text(record.get("campus_image_path")) or text(media.get("campusImagePath")),
            "cityImagePath": text(record.get("cityImagePath")) or text(record.get("city_image_path")),
            "campusStatus": text(media.get("campusStatus")),
            "campusAttribution": text(media.get("attribution")),
            "campusLicenseUrl": text(media.get("licenseUrl")),
            "campusSourceUrl": text(media.get("sourceUrl")),
            "logoStatus": text(media.get("logoStatus")),
            "logoAttribution": text(media.get("logoAttribution")),
            "logoLicenseUrl": text(media.get("logoLicenseUrl")),
            "logoSourceUrl": text(media.get("logoSourceUrl")),
            "universityLongIntro": localized_text(record, "university_long_intro"),
            "whyChoose": localized_text(record, "why_choose_this_university"),
            "cityStudentLife": localized_text(record, "city_student_life"),
            "cityTransport": localized_text(record, "city_transport"),
            "cityCostOfLiving": localized_text(record, "city_cost_of_living"),
            "cityHistory": localized_text(record, "city_history"),
            "cityHistoricalNote": localized_text(record, "city_historical_note"),
            "cityEconomy": localized_text(record, "city_economy"),
            "cityIndustries": localized_text(record, "city_industries"),
            "studentJobsNote": localized_text(record, "student_jobs_note"),
            "turkishStudentsNote": localized_text(record, "turkish_students_note"),
            "filters": {
                "state": text(record["filter_eyalet"]),
                "type": text(record["filter_tur"]),
                "germanCourse": text(record["filter_almanca_kursu"]),
                "level": text(record["filter_seviye"]),
                "uniAssist": text(record["filter_uni_assist"]),
            },
            "deadlines": {"bachelor": bachelor, "master": master},
            "germanCourse": course,
        })

    groups = {
        "state": "EYALET",
        "type": "TÜR",
        "germanCourse": "ALMANCA KURSU",
        "level": "SEVİYE",
        "uniAssist": "UNI-ASSIST",
    }
    options = {}
    for group, column in groups.items():
        values = []
        for raw in filter_options[column].tolist():
            value = text(raw)
            if value and value != "Tümü" and value not in values:
                values.append(value)
        options[group] = [localized_option(value) for value in values]

    return {"universities": records, "filterOptions": options}


def update_sitemap(slugs):
    xml = SITEMAP_PATH.read_text(encoding="utf-8")
    lines = xml.splitlines()
    listing_url = "https://sakalmanya.com.tr/universite-tanitimlari/"
    kept = [
        line for line in lines
        if not ("https://sakalmanya.com.tr/universiteler/" in line)
        and not ("https://sakalmanya.com.tr/universite-tanitimlari/" in line and f"<loc>{listing_url}</loc>" not in line)
    ]
    insert_at = next(i + 1 for i, line in enumerate(kept) if f"<loc>{listing_url}</loc>" in line)
    detail_lines = [f"  <url><loc>https://sakalmanya.com.tr/universiteler/{slug}/</loc></url>" for slug in slugs]
    kept[insert_at:insert_at] = detail_lines
    SITEMAP_PATH.write_text("\n".join(kept) + "\n", encoding="utf-8")


def read_compiled_dataset():
    """Recover the dataset already embedded in api/universities.js.

    Lets the handler code and the translation tables be rebuilt without the xlsx,
    which is intentionally not part of the repository.
    """
    if not OUTPUT_PATH.exists():
        raise SystemExit(f"{OUTPUT_PATH.relative_to(ROOT)} yok; --keep-dataset kullanılamaz")
    match = re.search(r"^const DATASET = (.*);$", OUTPUT_PATH.read_text(encoding="utf-8"), re.MULTILINE)
    if not match:
        raise SystemExit(f"{OUTPUT_PATH.relative_to(ROOT)} içinde DATASET satırı bulunamadı")
    return json.loads(match.group(1))


def compact_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def render_output(dataset):
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    replacements = {
        "__VALUE_LABELS__": compact_json(VALUE_LABELS),
        "__DEADLINE_QUALIFIERS__": compact_json(TRANSLATIONS["deadlineQualifiers"]),
        "__TRUST_NOTICE__": compact_json(TRANSLATIONS["trustNotice"]),
        "__LOCALE_DETAIL_PAGES__": compact_json(scan_locale_detail_pages()),
        "__DATASET__": compact_json(dataset),
    }
    for placeholder, payload in replacements.items():
        if placeholder not in template:
            raise SystemExit(f"Şablonda {placeholder} yer tutucusu yok")
        template = template.replace(placeholder, payload)
    OUTPUT_PATH.write_text(template, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("source", nargs="?", help=f"{DATASET_NAME} yolu")
    parser.add_argument(
        "--keep-dataset",
        action="store_true",
        help="xlsx okumadan yalnızca handler kodunu ve çeviri tablolarını yeniden derle",
    )
    args = parser.parse_args()

    if args.keep_dataset:
        if args.source:
            raise SystemExit("--keep-dataset ile dataset yolu birlikte verilemez")
        dataset = read_compiled_dataset()
    else:
        source = Path(args.source) if args.source else ROOT / "server-data" / DATASET_NAME
        if source.name != DATASET_NAME:
            raise SystemExit(f"Dataset dosya adı yalnızca {DATASET_NAME} olmalıdır")
        if not source.exists():
            raise SystemExit(f"Dataset bulunamadı: {source}")
        dataset = build_dataset(source)

    render_output(dataset)
    update_sitemap([item["slug"] for item in dataset["universities"]])
    mode = "mevcut dataset korunarak" if args.keep_dataset else "xlsx'ten"
    print(f"{len(dataset['universities'])} üniversite {mode} {OUTPUT_PATH.relative_to(ROOT)} içine derlendi")


if __name__ == "__main__":
    main()
