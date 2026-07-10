#!/usr/bin/env python3
"""Build the private Vercel university function from sakalmanya_uni_dataset.xlsx."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd


DATASET_NAME = "sakalmanya_uni_dataset.xlsx"
ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "scripts" / "universities-api-template.js"
OUTPUT_PATH = ROOT / "api" / "universities.js"
SITEMAP_PATH = ROOT / "sitemap.xml"
MEDIA_MANIFEST_PATH = ROOT / "server-data" / "university-media-manifest.json"


def text(value):
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    value = str(value).strip()
    return value or None


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


def localized_option(group, value):
    state_labels = {
        "Niedersachsen": {"tr": "Aşağı Saksonya", "de": "Niedersachsen", "en": "Lower Saxony"},
        "Nordrhein-Westfalen": {"tr": "Kuzey Ren-Vestfalya", "de": "Nordrhein-Westfalen", "en": "North Rhine-Westphalia"},
        "Sachsen": {"tr": "Saksonya", "de": "Sachsen", "en": "Saxony"},
        "Bayern": {"tr": "Bavyera", "de": "Bayern", "en": "Bavaria"},
    }
    translations = {
        "Hazırlık/DSH kursu var": {"tr": "Hazırlık/DSH kursu var", "de": "Vorbereitung/DSH-Kurs vorhanden", "en": "Prep/DSH course available"},
        "Hazırlık/DSH kursu yok": {"tr": "Hazırlık/DSH kursu yok", "de": "Kein bestätigter Prep/DSH-Kurs", "en": "No confirmed prep/DSH course"},
        "Program bazlı / değişken": {"tr": "Program bazlı / değişken", "de": "Programmabhängig / variabel", "en": "Program-based / variable"},
        "Henüz doğrulanmadı": {"tr": "Henüz doğrulanmadı", "de": "Noch nicht verifiziert", "en": "Not verified yet"},
        "Uni-Assist var": {"tr": "Uni-Assist var", "de": "Uni-Assist vorhanden", "en": "Uni-Assist available"},
        "Direkt başvuru": {"tr": "Direkt başvuru", "de": "Direktbewerbung", "en": "Direct application"},
        "Technische Universität": {"tr": "Technische Universität", "de": "Technische Universität", "en": "Technical University"},
        "Universität": {"tr": "Universität", "de": "Universität", "en": "University"},
        "Hochschule": {"tr": "Hochschule", "de": "Hochschule", "en": "University of Applied Sciences"},
        "Lisans": {"tr": "Lisans", "de": "Bachelor", "en": "Bachelor"},
        "Master": {"tr": "Master", "de": "Master", "en": "Master"},
        "Lisans ve Master": {"tr": "Lisans ve Master", "de": "Bachelor und Master", "en": "Bachelor and Master"},
    }
    label = state_labels.get(value) if group == "state" else translations.get(value)
    return {"value": value, "label": label or {"tr": value, "de": value, "en": value}}


def build_dataset(path):
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
            "display": text(record["deadline_display_tr"]) or "Program bazlı kontrol edilmeli",
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
            "criteriaMatch": text(record["course_criteria_match_tr"]),
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
            "schoolIntro": text(record["school_intro_tr"]),
            "cityIntro": text(record["city_intro_tr"]),
            "popularityReason": text(record["popularity_reason_tr"]),
            "logoPath": text(record.get("logoPath")) or text(record.get("logo_path")) or text(media.get("logoPath")),
            "campusImagePath": text(record.get("campusImagePath")) or text(record.get("campus_image_path")) or text(media.get("campusImagePath")),
            "cityImagePath": text(record.get("cityImagePath")) or text(record.get("city_image_path")),
            "campusStatus": text(media.get("campusStatus")),
            "campusAttribution": text(media.get("attribution")),
            "campusLicenseUrl": text(media.get("licenseUrl")),
            "campusSourceUrl": text(media.get("sourceUrl")),
            "universityLongIntro": text(record.get("university_long_intro_tr")),
            "whyChoose": text(record.get("why_choose_this_university_tr")),
            "cityStudentLife": text(record.get("city_student_life_tr")),
            "cityTransport": text(record.get("city_transport_tr")),
            "cityCostOfLiving": text(record.get("city_cost_of_living_tr")),
            "cityHistory": text(record.get("city_history_tr")),
            "cityHistoricalNote": text(record.get("city_historical_note_tr")),
            "cityEconomy": text(record.get("city_economy_tr")),
            "cityIndustries": text(record.get("city_industries_tr")),
            "studentJobsNote": text(record.get("student_jobs_note_tr")),
            "turkishStudentsNote": text(record.get("turkish_students_note_tr")),
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
        options[group] = [localized_option(group, value) for value in values]

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


def main():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "server-data" / DATASET_NAME
    if source.name != DATASET_NAME:
        raise SystemExit(f"Dataset dosya adı yalnızca {DATASET_NAME} olmalıdır")
    if not source.exists():
        raise SystemExit(f"Dataset bulunamadı: {source}")

    dataset = build_dataset(source)
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    payload = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
    OUTPUT_PATH.write_text(template.replace("__DATASET__", payload), encoding="utf-8")
    update_sitemap([item["slug"] for item in dataset["universities"]])
    print(f"{len(dataset['universities'])} üniversite {OUTPUT_PATH.relative_to(ROOT)} içine derlendi")


if __name__ == "__main__":
    main()
