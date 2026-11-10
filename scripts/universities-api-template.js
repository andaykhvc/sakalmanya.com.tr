/* This file is compiled from sakalmanya_uni_dataset.xlsx by build-university-api.py. */

const DATASET = __DATASET__;
const UNIVERSITIES = DATASET.universities;
const SITE_URL = "https://sakalmanya.com.tr";

/* Localisation tables, inlined from scripts/value-translations.json at build time. */
const VALUE_LABELS = __VALUE_LABELS__;
const DEADLINE_QUALIFIERS = __DEADLINE_QUALIFIERS__;
const TRUST_NOTICE = __TRUST_NOTICE__;

/* Slugs that have a hand-written static detail page, scanned from the repo at build time. */
const LOCALE_DETAIL_PAGES = __LOCALE_DETAIL_PAGES__;

const LANGUAGES = ["tr", "de", "en"];
const DEFAULT_LANGUAGE = "tr";
const DETAIL_BASE_PATHS = { tr: "/universiteler", de: "/de/universitaeten", en: "/en/universities" };
const LISTING_PATHS = { tr: "/universite-tanitimlari/", de: "/de/universitaeten/", en: "/en/universities/" };
const DATE_LOCALES = { tr: "tr-TR", de: "de-DE", en: "en-GB" };

/* Dropdown labels are re-derived from VALUE_LABELS instead of trusting the labels baked
   into the dataset, so a filter option and a card can never disagree on the same value. */
const FILTER_OPTIONS = Object.fromEntries(
  Object.entries(DATASET.filterOptions).map(([group, entries]) => [
    group,
    entries.map((entry) => ({ value: entry.value, label: VALUE_LABELS[entry.value] || entry.label })),
  ])
);

function resolveLanguage(value) {
  const lang = String(value || "").trim().toLowerCase().slice(0, 2);
  return LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

/* Dataset text fields are either a plain (Turkish) string or a {tr,de,en} object. */
function pickText(value, lang) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[lang] || value[DEFAULT_LANGUAGE] || "";
  }
  return value;
}

/* Localise a value: an explicit translation from the dataset wins, otherwise fall back
   to the shared enum table so Turkish-only rows still render in German and English. */
function localiseValue(value, lang) {
  const raw = pickText(value, lang);
  if (typeof raw !== "string" || !raw) return raw;
  return VALUE_LABELS[raw]?.[lang] || raw;
}

function formatDate(value, lang) {
  if (!value) return localiseValue("Henüz doğrulanmadı", lang);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(DATE_LOCALES[lang] || DATE_LOCALES.tr, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/* Some deadline rows are still raw notation such as
   "restricted: 2026-05-31; unrestricted: 2026-07-15". Rewrite those into readable text
   without touching the dates themselves. */
function expandDeadlineNotation(display, lang) {
  const parts = display.split(";").map((part) => part.trim()).filter(Boolean);
  const expanded = parts.map((part) => {
    const match = /^([a-zA-Z_ -]+):\s*(\d{4}-\d{2}-\d{2})$/.exec(part);
    if (!match) return null;
    const qualifier = DEADLINE_QUALIFIERS[match[1].trim().toLowerCase()];
    if (!qualifier) return null;
    return `${qualifier[lang] || qualifier[DEFAULT_LANGUAGE]}: ${formatDate(match[2], lang)}`;
  });
  return expanded.every(Boolean) ? expanded.join(" · ") : null;
}

/* "15 Temmuz 2026" and similar — a bare day/month/year with nothing else in it. */
const PLAIN_DATE_DISPLAY = /^\d{1,2}\.?\s+\p{L}+\.?\s+\d{4}$/u;

function localiseDeadlineDisplay(deadline, lang) {
  const explicit = pickText(deadline?.display, lang);
  if (typeof explicit !== "string" || !explicit) return localiseValue("Program bazlı kontrol edilmeli", lang);
  /* A translated string from the dataset is used as written. */
  if (deadline.display && typeof deadline.display === "object") return explicit;
  const expanded = expandDeadlineNotation(explicit, lang);
  if (expanded) return expanded;
  /* Re-format from the ISO date only when the written display is nothing but a date, so a
     qualifier someone added in the sheet ("... (tahmini)") is never silently dropped. */
  if (deadline.date && PLAIN_DATE_DISPLAY.test(explicit)) return formatDate(deadline.date, lang);
  return localiseValue(explicit, lang);
}

/* Most slugs only have a Turkish detail page, which this function renders. A locale path
   is used exclusively when a hand-written page for that slug really exists. */
function localeDetailPath(slug, lang) {
  return lang !== DEFAULT_LANGUAGE && LOCALE_DETAIL_PAGES[lang]?.includes(slug)
    ? `${DETAIL_BASE_PATHS[lang]}/${slug}/`
    : "";
}

function detailUrl(slug, lang) {
  return localeDetailPath(slug, lang) || `${DETAIL_BASE_PATHS[DEFAULT_LANGUAGE]}/${slug}/`;
}

/* Language switcher target: the same university in that language when it exists,
   otherwise that language's university listing. */
function languageSwitchUrl(slug, lang) {
  return localeDetailPath(slug, lang) || LISTING_PATHS[lang] || LISTING_PATHS[DEFAULT_LANGUAGE];
}

const requestBuckets = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 90;

function getClientKey(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function isRateLimited(req) {
  const now = Date.now();
  const key = getClientKey(req);
  const bucket = requestBuckets.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

function normalise(value) {
  return String(value || "").trim();
}

function safeSlug(value) {
  const slug = normalise(value).toLowerCase();
  return /^[a-z0-9-]+$/.test(slug) ? slug : "";
}

function matchesFilters(item, filters) {
  const levelMatches = !filters.level
    || item.filters.level === filters.level
    || (item.filters.level === "Lisans ve Master" && ["Lisans", "Master"].includes(filters.level));

  return (!filters.state || item.filters.state === filters.state)
    && (!filters.type || item.filters.type === filters.type)
    && (!filters.germanCourse || item.filters.germanCourse === filters.germanCourse)
    && levelMatches
    && (!filters.uniAssist || item.filters.uniAssist === filters.uniAssist);
}

function rankingScore(item) {
  const rawRank = String(item.qsWorldRanking2026 || "");
  const rank = Number.parseInt(rawRank.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER;
}

function sortByPopularity(a, b) {
  return rankingScore(a) - rankingScore(b) || a.name.localeCompare(b.name, "tr");
}

function publicCard(item, lang) {
  return {
    name: item.name,
    slug: item.slug,
    logoPath: item.logoPath || null,
    city: item.city,
    state: localiseValue(item.state, lang),
    type: localiseValue(item.type, lang),
    qsWorldRanking2026: localiseValue(item.qsWorldRanking2026, lang),
    schoolIntro: pickText(item.schoolIntro, lang),
    cityIntro: pickText(item.cityIntro, lang),
    bachelorDeadline: localiseDeadlineDisplay(item.deadlines.bachelor, lang),
    masterDeadline: localiseDeadlineDisplay(item.deadlines.master, lang),
    germanPrepStatus: localiseValue(item.germanCourse.label, lang),
    uniAssistStatus: localiseValue(item.filters.uniAssist, lang),
    lastChecked: item.lastChecked,
    sourceUrl: item.sourceUrl || item.officialWebsite,
    detailUrl: detailUrl(item.slug, lang),
  };
}

function relatedUniversities(item, lang) {
  return UNIVERSITIES
    .filter((candidate) => candidate.slug !== item.slug && (candidate.city === item.city || candidate.state === item.state))
    .sort((a, b) => Number(b.city === item.city) - Number(a.city === item.city) || a.name.localeCompare(b.name, "tr"))
    .slice(0, 6)
    .map((candidate) => ({
      name: candidate.name,
      city: candidate.city,
      state: localiseValue(candidate.state, lang),
      detailUrl: detailUrl(candidate.slug, lang),
    }));
}

const PROSE_FIELDS = [
  "schoolIntro", "cityIntro", "popularityReason", "universityLongIntro", "whyChoose",
  "cityStudentLife", "cityTransport", "cityCostOfLiving", "cityHistory", "cityHistoricalNote",
  "cityEconomy", "cityIndustries", "studentJobsNote", "turkishStudentsNote",
];

/* Resolve every localisable field of a dataset record for one language, keeping the
   record shape intact so renderers can read it exactly like the raw dataset item. */
function localisedItem(item, lang) {
  const resolved = { ...item };
  PROSE_FIELDS.forEach((field) => {
    resolved[field] = pickText(item[field], lang);
  });
  resolved.state = localiseValue(item.state, lang);
  resolved.type = localiseValue(item.type, lang);
  resolved.qsWorldRanking2026 = localiseValue(item.qsWorldRanking2026, lang);
  resolved.filters = { ...item.filters, uniAssist: localiseValue(item.filters.uniAssist, lang) };
  resolved.deadlines = {
    bachelor: { ...item.deadlines.bachelor, display: localiseDeadlineDisplay(item.deadlines.bachelor, lang) },
    master: { ...item.deadlines.master, display: localiseDeadlineDisplay(item.deadlines.master, lang) },
  };
  resolved.germanCourse = {
    ...item.germanCourse,
    label: localiseValue(item.germanCourse.label, lang),
    criteriaMatch: pickText(item.germanCourse.criteriaMatch, lang),
  };
  return resolved;
}

/* Course-status checks must run against the canonical Turkish value, not a translation. */
function hasVerifiedGermanCourse(item) {
  return pickText(item.germanCourse.label, DEFAULT_LANGUAGE) === "Hazırlık/DSH kursu var";
}

function publicDetail(item, lang) {
  const view = localisedItem(item, lang);
  return {
    name: view.name,
    slug: view.slug,
    city: view.city,
    state: view.state,
    type: view.type,
    officialWebsite: view.officialWebsite,
    qsWorldRanking2026: view.qsWorldRanking2026,
    qsSourceUrl: view.qsSourceUrl,
    schoolIntro: view.schoolIntro,
    cityIntro: view.cityIntro,
    popularityReason: view.popularityReason,
    universityLongIntro: view.universityLongIntro,
    whyChoose: view.whyChoose,
    cityStudentLife: view.cityStudentLife,
    cityTransport: view.cityTransport,
    cityCostOfLiving: view.cityCostOfLiving,
    cityHistory: view.cityHistory,
    cityHistoricalNote: view.cityHistoricalNote,
    cityEconomy: view.cityEconomy,
    cityIndustries: view.cityIndustries,
    studentJobsNote: view.studentJobsNote,
    turkishStudentsNote: view.turkishStudentsNote,
    applicationPortal: view.applicationPortal,
    uniAssistStatus: view.filters.uniAssist,
    lastChecked: view.lastChecked,
    sourceUrl: view.sourceUrl,
    logoPath: view.logoPath,
    campusImagePath: view.campusImagePath,
    campusStatus: view.campusStatus,
    campusAttribution: view.campusAttribution,
    campusLicenseUrl: view.campusLicenseUrl,
    campusSourceUrl: view.campusSourceUrl,
    logoStatus: view.logoStatus,
    logoAttribution: view.logoAttribution,
    logoLicenseUrl: view.logoLicenseUrl,
    logoSourceUrl: view.logoSourceUrl,
    deadlines: view.deadlines,
    germanCourse: view.germanCourse,
    related: relatedUniversities(item, lang),
    trustNotice: TRUST_NOTICE[lang] || TRUST_NOTICE[DEFAULT_LANGUAGE],
    detailUrl: detailUrl(item.slug, lang),
    lang,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function safeAssetPath(value, slug) {
  const rawPath = normalise(value);
  const path = rawPath.startsWith("/public/") ? rawPath.slice(7) : rawPath;
  const prefix = `/assets/universities/${slug}/`;
  return path.startsWith(prefix) && !path.includes("..") ? path : "";
}

function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function factRow(label, value) {
  if (!value) return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function externalButton(url, label, className = "button button-secondary") {
  const safeUrl = safeExternalUrl(url);
  if (!safeUrl) return "";
  return `<a class="${className}" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function externalSourceItem(url, label) {
  const safeUrl = safeExternalUrl(url);
  if (!safeUrl) return "";
  return `<li><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></li>`;
}

function seoUniversityName(item) {
  const tuCitySlugs = {
    "tu-berlin": "TU Berlin",
    "tu-braunschweig": "TU Braunschweig",
    "tu-chemnitz": "TU Chemnitz",
    "tu-darmstadt": "TU Darmstadt",
    "tu-dresden": "TU Dresden",
  };
  const aliases = {
    kit: "KIT",
    "lmu-muenchen": "LMU München",
    tum: "TUM",
    "tu-bergakademie-freiberg": "TU Bergakademie Freiberg",
  };
  return tuCitySlugs[item.slug] || aliases[item.slug] || item.name;
}

function deadlineCard(label, deadline) {
  const portal = deadline.portal ? `<p><strong>Başvuru portalı:</strong> ${escapeHtml(deadline.portal)}</p>` : "";
  const source = externalButton(deadline.sourceUrl, `${label} kaynağı`, "text-link");
  return `<article class="university-info-card">
    <p class="section-label">${escapeHtml(label)}</p>
    <h3>${escapeHtml(deadline.display || "Program bazlı kontrol edilmeli")}</h3>
    ${portal}
    ${source}
  </article>`;
}

function buildFaq(item) {
  const seoName = seoUniversityName(item);
  const courseAnswer = hasVerifiedGermanCourse(item)
    ? `${seoName} için dataset'te doğrulanmış Almanca hazırlık/DSH yolu bulunuyor: ${item.germanCourse.name || item.germanCourse.type}. Katılım ve kabul şartları resmi kaynaktan kontrol edilmelidir.`
    : `${seoName} için Türkiye'deki hazırlık sınıfı mantığına yakın, DSH/Intensivkurs formatında bir Almanca hazırlık kursu resmi kaynakla net doğrulanamadı. Güncel durum resmi kaynaktan kontrol edilmelidir.`;

  return [
    {
      question: `${seoName} son başvuru tarihi ne?`,
      answer: `${seoName} son başvuru tarihi lisans için ${item.deadlines.bachelor.display}, master için ${item.deadlines.master.display} olarak işlenmiştir. Başvuru tarihleri programa ve döneme göre değişebileceği için resmi kaynak kontrol edilmelidir.`,
    },
    {
      question: `${seoName} lisans son başvuru tarihi ne?`,
      answer: `${seoName} lisans son başvuru tarihi için son kontrol edilen bilgi: ${item.deadlines.bachelor.display}. Tarih programa göre değişebilir; resmi kaynak kontrol edilmelidir.`,
    },
    {
      question: `${seoName} master son başvuru tarihi ne?`,
      answer: `${seoName} master son başvuru tarihi için son kontrol edilen bilgi: ${item.deadlines.master.display}. Master tarihleri bölüm bazında değişebileceği için resmi kaynak kontrol edilmelidir.`,
    },
    {
      question: `${seoName} başvurusu Uni-Assist üzerinden mi?`,
      answer: `Dataset'te son kontrol edilen bilgiye göre ${seoName} başvuru yolu: ${item.filters.uniAssist}. Başvuru yolu programa göre değişebilir; resmi program sayfası kontrol edilmelidir.`,
    },
    {
      question: `${seoName} Almanca hazırlık veya DSH kursu sunuyor mu?`,
      answer: courseAnswer,
    },
    {
      question: `${seoName} QS 2026 sıralaması nedir?`,
      answer: `Dataset'te yer alan QS 2026 bilgisi: ${item.qsWorldRanking2026}. Sıralamalar yıllara göre değişebilir.`,
    },
    {
      question: `${item.city} öğrenciler için nasıl bir şehir?`,
      answer: item.cityIntro,
    },
  ];
}

function renderUniversityPage(record) {
  /* This route is the Turkish detail page; resolve the record into Turkish once so the
     markup below can read it exactly like a plain, single-language dataset item. */
  const item = localisedItem(record, DEFAULT_LANGUAGE);
  const canonical = `${SITE_URL}${DETAIL_BASE_PATHS[DEFAULT_LANGUAGE]}/${item.slug}/`;
  const seoName = seoUniversityName(item);
  const title = `${seoName} Son Başvuru Tarihleri | Lisans, Master ve Almanca Hazırlık`;
  const description = `${seoName} son başvuru tarihleri, lisans ve master başvuru bilgileri, Uni-Assist durumu, Almanca hazırlık/DSH kursu ve ${item.city} öğrenci yaşamı.`;
  const image = `${SITE_URL}/assets/hero-germany-study.png`;
  const faq = buildFaq(item);
  const sources = [
    externalSourceItem(item.officialWebsite, "Resmi üniversite sayfası"),
    externalSourceItem(item.deadlines.bachelor.sourceUrl, "Lisans başvuru kaynağı"),
    externalSourceItem(item.deadlines.master.sourceUrl, "Master başvuru kaynağı"),
    externalSourceItem(item.germanCourse.sourceUrl, "Almanca hazırlık / DSH kaynağı"),
    externalSourceItem(item.qsSourceUrl, "QS 2026 sıralama kaynağı"),
    item.campusAttribution && externalSourceItem(item.campusLicenseUrl || item.campusSourceUrl, item.campusAttribution),
    item.logoAttribution && externalSourceItem(item.logoLicenseUrl || item.logoSourceUrl, item.logoAttribution),
  ].filter(Boolean);
  const uniqueSources = [...new Set(sources)];
  const related = relatedUniversities(record, DEFAULT_LANGUAGE);
  const logoPath = safeAssetPath(item.logoPath, item.slug);
  const campusPath = safeAssetPath(item.campusImagePath, item.slug) || safeAssetPath(item.cityImagePath, item.slug);
  const visualCard = (path, label, fallback, kind, sourceUrl, attribution) => path
    ? `<figure class="university-visual-image university-visual-image--${escapeHtml(kind)}"><img src="${escapeHtml(path)}" alt="${escapeHtml(label)}" loading="lazy" /><figcaption><span>${escapeHtml(label)}</span>${safeExternalUrl(sourceUrl) ? `<a href="${escapeHtml(safeExternalUrl(sourceUrl))}" target="_blank" rel="noopener noreferrer">Görsel kaynağı</a>` : ""}${attribution ? `<small>${escapeHtml(attribution)}</small>` : ""}</figcaption></figure>`
    : `<div class="university-visual-placeholder"><span>${escapeHtml(label)}</span><strong>${escapeHtml(fallback)}</strong></div>`;
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
  const universitySchema = {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: item.name,
    url: canonical,
    description: item.schoolIntro,
    address: {
      "@type": "PostalAddress",
      addressLocality: item.city,
      /* Structured data keeps the canonical German Bundesland name, not the display label. */
      addressRegion: record.state,
      addressCountry: "DE",
    },
    ...(safeExternalUrl(item.officialWebsite) ? { sameAs: [safeExternalUrl(item.officialWebsite)] } : {}),
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Almanya Üniversiteleri", item: `${SITE_URL}/universite-tanitimlari/` },
      { "@type": "ListItem", position: 3, name: item.name, item: canonical },
    ],
  };
  const courseDetails = [
    item.germanCourse.name && factRow("Kurs adı", item.germanCourse.name),
    item.germanCourse.type && factRow("Kurs türü", item.germanCourse.type),
    item.germanCourse.duration && factRow("Süre / yoğunluk", item.germanCourse.duration),
    item.germanCourse.weeklyHours && factRow("Haftalık ders", item.germanCourse.weeklyHours),
    item.germanCourse.targetExam && factRow("Hedef sınav", item.germanCourse.targetExam),
    item.germanCourse.requiredLevel && factRow("Giriş seviyesi", item.germanCourse.requiredLevel),
    item.germanCourse.targetDegreeLevel && factRow("Hedef eğitim seviyesi", item.germanCourse.targetDegreeLevel),
    item.germanCourse.residenceRelevance && factRow("Oturum §16 açısından not", item.germanCourse.residenceRelevance),
  ].filter(Boolean).join("");
  const verifiedCourse = hasVerifiedGermanCourse(item);
  const courseFallback = "Bu üniversitede Türkiye’deki hazırlık sınıfı mantığına yakın, DSH/Intensivkurs formatında bir hazırlık kursu resmi kaynakla net doğrulanamadı.";
  const courseIntro = verifiedCourse
    ? item.germanCourse.criteriaMatch || "Resmi kaynakta hazırlık/DSH yolu doğrulandı; kabul ve katılım şartları ayrıca kontrol edilmelidir."
    : courseFallback;
  const relatedSection = related.length
    ? `<h2>Bu Eyaletteki Diğer Üniversiteler</h2><div class="inline-links">${related.map((entry) => `<a href="${escapeHtml(entry.detailUrl)}">${escapeHtml(entry.name)} <span>${escapeHtml(entry.city)}</span></a>`).join("")}</div>`
    : "";

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="google-site-verification" content="google600d9d87c71c7a8e.html" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta name="theme-color" content="#111111" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
    <script src="/analytics.js"></script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-P7JNVHYCS2"></script>
    <script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
    <script defer src="/_vercel/insights/script.js"></script>
    <script type="application/ld+json">${jsonForHtml(universitySchema)}</script>
    <script type="application/ld+json">${jsonForHtml(breadcrumbSchema)}</script>
    <script type="application/ld+json">${jsonForHtml(faqSchema)}</script>
  </head>
  <body data-university-name="${escapeHtml(item.name)}">
    <div class="flag-strip" aria-hidden="true"><span class="strip-black"></span><span class="strip-red"></span><span class="strip-gold"></span></div>
    <header class="site-header" data-header>
      <a class="brand" href="/" aria-label="ŞAK Almanya Ana sayfa"><img class="brand-mark" src="/assets/logoask.svg" alt="ŞAK Almanya logosu" width="50" height="50" /><span><strong>Almanya</strong></span></a>
      <nav class="main-nav" aria-label="Türkçe menü" data-nav><a href="/#hakkimda">Hakkımda</a><a href="/#hizmetler">Hizmetler</a><a href="/#basarilar">Başarılar</a><a href="/#surec">Süreç</a><a href="/universite-tanitimlari/" aria-current="page">Üniversiteler</a><a href="/blog/">Blog</a><a href="/sss/">SSS</a></nav>
      <div class="language-switcher" aria-label="Dil seçimi"><a href="${escapeHtml(canonical)}" lang="tr" aria-current="true">TR</a><span>|</span><a href="${escapeHtml(languageSwitchUrl(item.slug, "de"))}" lang="de">DE</a><span>|</span><a href="${escapeHtml(languageSwitchUrl(item.slug, "en"))}" lang="en">EN</a></div>
    </header>
    <main>
      <section class="page-hero university-dataset-hero">
        <div class="container">
          <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Ana Sayfa</a> / <a href="/universite-tanitimlari/">Almanya Üniversiteleri</a> / <span>${escapeHtml(item.name)}</span></nav>
          <p class="section-label">${escapeHtml(item.city)} / ${escapeHtml(item.state)}</p>
          <h1>${escapeHtml(seoName)} Son Başvuru Tarihleri ve Başvuru Rehberi</h1>
          <p>${escapeHtml(item.schoolIntro)} ${escapeHtml(seoName)} son başvuru tarihi, lisans ve master başvuru yolu, Uni-Assist durumu ve Almanca hazırlık bilgileri aşağıda kaynaklı şekilde özetlenmiştir.</p>
          <div class="university-hero-facts"><span>${escapeHtml(item.type)}</span><span>QS 2026: ${escapeHtml(item.qsWorldRanking2026)}</span><span>Son kontrol: ${escapeHtml(formatDate(item.lastChecked, DEFAULT_LANGUAGE))}</span></div>
          <div class="hero-actions">${externalButton(item.officialWebsite, "Resmi üniversite sitesi", "button button-primary")}<a class="button button-secondary" href="#basvuru-bilgileri">Başvuru bilgileri</a></div>
        </div>
      </section>
      <section class="section page-content">
        <div class="container article-layout university-detail university-dataset-detail">
          <p class="notice-box">${escapeHtml(TRUST_NOTICE[DEFAULT_LANGUAGE])}</p>
          <section class="university-visual-grid" aria-label="Üniversite görselleri">${visualCard(logoPath, `${item.name} logosu`, item.name, "logo", item.logoSourceUrl, item.logoAttribution)}${visualCard(campusPath, `${item.name} kampüs veya ${item.city} şehir görseli`, item.city, "campus", item.campusSourceUrl, item.campusAttribution)}</section>
          <h2>Hızlı Bilgi</h2>
          <div class="table-wrap"><table class="info-table"><tbody>${factRow("Üniversite", item.name)}${factRow("Şehir", item.city)}${factRow("Eyalet", item.state)}${factRow("Tür", item.type)}${factRow("QS 2026", item.qsWorldRanking2026)}${factRow("Uni-Assist", item.filters.uniAssist)}${factRow("Son kontrol", formatDate(item.lastChecked, DEFAULT_LANGUAGE))}</tbody></table></div>
          <h2>Üniversite Hakkında</h2><p>${escapeHtml(item.schoolIntro)}</p>${item.universityLongIntro ? `<p>${escapeHtml(item.universityLongIntro)}</p>` : ""}${item.whyChoose ? `<p>${escapeHtml(item.whyChoose)}</p>` : ""}${item.popularityReason ? `<p>${escapeHtml(item.popularityReason)}</p>` : ""}
          <h2>Şehir Hakkında</h2><p>${escapeHtml(item.cityIntro)}</p>${item.cityStudentLife ? `<p>${escapeHtml(item.cityStudentLife)}</p>` : ""}${item.cityTransport ? `<p>${escapeHtml(item.cityTransport)}</p>` : ""}${item.cityCostOfLiving ? `<p>${escapeHtml(item.cityCostOfLiving)}</p>` : ""}
          ${(item.cityHistory || item.cityHistoricalNote) ? `<h2>Şehrin Kısa Tarihi</h2>${item.cityHistory ? `<p>${escapeHtml(item.cityHistory)}</p>` : ""}${item.cityHistoricalNote ? `<p>${escapeHtml(item.cityHistoricalNote)}</p>` : ""}` : ""}
          ${(item.cityEconomy || item.cityIndustries || item.studentJobsNote) ? `<h2>Ekonomi ve Kariyer Çevresi</h2>${item.cityEconomy ? `<p>${escapeHtml(item.cityEconomy)}</p>` : ""}${item.cityIndustries ? `<p>${escapeHtml(item.cityIndustries)}</p>` : ""}${item.studentJobsNote ? `<p>${escapeHtml(item.studentJobsNote)}</p>` : ""}` : ""}
          <section id="basvuru-bilgileri" class="university-anchor-section"><h2>${escapeHtml(seoName)} Son Başvuru Tarihleri</h2><p>${escapeHtml(seoName)} son başvuru tarihi lisans ve master seviyesinde farklı olabilir. Aşağıdaki bilgiler Türkiye’den başvuran adaylar için resmi kaynaklardan kontrol edilmiş özet niteliğindedir.</p><p><strong>Genel başvuru yolu:</strong> ${escapeHtml(item.applicationPortal || item.filters.uniAssist)}</p><h2>${escapeHtml(seoName)} Lisans Son Başvuru Tarihi</h2>${deadlineCard("Lisans", item.deadlines.bachelor)}<h2>${escapeHtml(seoName)} Master Son Başvuru Tarihi</h2>${deadlineCard("Master", item.deadlines.master)}<h2>${escapeHtml(seoName)} Uni-Assist Başvurusu</h2><p>${escapeHtml(seoName)} için Uni-Assist durumu: <strong>${escapeHtml(item.filters.uniAssist)}</strong>. Bazı üniversitelerde başvuru yolu programa, dereceye veya önceki eğitim belgesine göre değişebilir.</p><p class="notice-box">${escapeHtml(TRUST_NOTICE[DEFAULT_LANGUAGE])}</p></section>
          <h2>${escapeHtml(seoName)} Almanca Hazırlık / DSH Kursu</h2><p><strong>Durum:</strong> ${escapeHtml(item.germanCourse.label)}</p><p>${escapeHtml(courseIntro)}</p>${courseDetails ? `<div class="table-wrap"><table class="info-table"><tbody>${courseDetails}</tbody></table></div>` : ""}${externalButton(item.germanCourse.sourceUrl, "Almanca hazırlık kaynağı", "text-link")}
          <aside class="deutschlaender-callout" aria-labelledby="deutschlaender-university-title"><p class="section-label">Ücretsiz Almanca ve topluluk</p><h2 id="deutschlaender-university-title">${escapeHtml(seoName)} hakkında sorularını topluluğa taşı.</h2><p>DSH, TestDaF, Almanca hazırlık ve üniversite başvurusu sorularını Deutschländer forumunda paylaş; ücretsiz sınav ve ders içeriklerini incele.</p><div class="deutschlaender-callout-actions"><a class="button button-primary" href="https://deutschlaender.com.tr/forum/kategori/universite-ve-basvuru" data-deutschlaender-link data-deutschlaender-path="/forum/kategori/universite-ve-basvuru" data-deutschlaender-content="university_detail_forum">Üniversite forumuna git ↗</a><a class="button button-secondary" href="https://deutschlaender.com.tr/pruefungen" data-deutschlaender-link data-deutschlaender-path="/pruefungen" data-deutschlaender-content="university_detail_exams">DSH ve TestDaF rehberleri ↗</a></div></aside>
          <h2>QS 2026 Sıralaması</h2><p><strong>${escapeHtml(item.qsWorldRanking2026)}</strong>. Sıralamalar yıldan yıla değişebilir; karar verirken program içeriği, şehir, bütçe ve kabul şartları birlikte değerlendirilmelidir.</p>${externalButton(item.qsSourceUrl, "QS kaynağını aç", "text-link")}
          ${item.turkishStudentsNote ? `<h2>Türk Öğrenciler İçin Notlar</h2><p>${escapeHtml(item.turkishStudentsNote)}</p>` : ""}
          ${relatedSection}
          <h2>Sık Sorulan Sorular</h2><div class="faq-list">${faq.map((entry) => `<details><summary>${escapeHtml(entry.question)}</summary><p>${escapeHtml(entry.answer)}</p></details>`).join("")}</div>
          <h2>Kaynaklar</h2>${uniqueSources.length ? `<ul class="university-source-list">${uniqueSources.join("")}</ul>` : ""}<p><strong>Son kontrol tarihi:</strong> ${escapeHtml(formatDate(item.lastChecked, DEFAULT_LANGUAGE))}</p>
          <a class="text-link university-back-link" href="/universite-tanitimlari/">← Tüm üniversitelere dön</a>
        </div>
      </section>
    </main>
    <footer class="site-footer"><div class="container footer-grid"><div class="footer-about"><strong>ŞAK Almanya</strong><p>Almanca, Almanya eğitim, Hochschule ve Ausbildung danışmanlığı.</p><p class="legal-note">Resmi kurum değildir. Kabul, vize veya yerleşim garantisi verilmez.</p></div><div class="footer-links-panel"><nav class="footer-nav" aria-label="Türkçe footer menüsü"><a href="/#iletisim">İletişim</a></nav><div class="social-links" aria-label="Sosyal medya hesapları"><a class="social-instagram" href="https://www.instagram.com/andaykahveci" target="_blank" rel="noopener noreferrer">Instagram</a><a class="social-youtube" href="https://www.youtube.com/@andaykhvc" target="_blank" rel="noopener noreferrer">YouTube</a><a class="social-linkedin" href="https://www.linkedin.com/in/andaykahveci/" target="_blank" rel="noopener noreferrer">LinkedIn</a><a class="footer-look-link" href="https://github.com/andaykhvc" target="_blank" rel="noopener noreferrer" aria-label="ŞAK Almanya GitHub profilini aç"><img src="/assets/buraya-bakarlar.jpg" alt="buraya bakarlar" /></a></div><span>© <span data-year></span> ŞAK Almanya</span><span class="footer-domain">sakalmanya.com.tr</span></div></div></footer>
    <script src="/script.js"></script>
  </body>
</html>`;
}

function renderNotFoundPage() {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex, follow" /><title>Üniversite bulunamadı | ŞAK Almanya</title><link rel="stylesheet" href="/styles.css" /></head><body><main><section class="page-hero"><div class="container"><p class="section-label">404</p><h1>Üniversite bulunamadı</h1><p>Bu bağlantı geçerli değil veya üniversite kaydı güncellenmiş olabilir.</p><a class="button button-primary" href="/universite-tanitimlari/">Tüm üniversitelere dön</a></div></section></main></body></html>`;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", statusCode === 200 ? "s-maxage=300, stale-while-revalidate=600" : "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", statusCode === 200 ? "s-maxage=3600, stale-while-revalidate=86400" : "no-store");
  res.setHeader("X-Robots-Tag", statusCode === 200 ? "index, follow" : "noindex, follow");
  res.end(html);
}

module.exports = function handler(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const url = new URL(req.url || "/api/universities", SITE_URL);
  const slug = safeSlug(url.searchParams.get("slug"));
  const view = normalise(url.searchParams.get("view"));
  const lang = resolveLanguage(url.searchParams.get("lang"));
  const selectedUniversity = slug ? UNIVERSITIES.find((item) => item.slug === slug) : null;

  if (view === "page") {
    if (!selectedUniversity) {
      sendHtml(res, 404, renderNotFoundPage());
      return;
    }
    sendHtml(res, 200, renderUniversityPage(selectedUniversity));
    return;
  }

  if (isRateLimited(req)) {
    sendJson(res, 429, { error: "Too many requests" });
    return;
  }

  if (slug) {
    if (!selectedUniversity) {
      sendJson(res, 404, { error: "University not found" });
      return;
    }
    sendJson(res, 200, { item: publicDetail(selectedUniversity, lang) });
    return;
  }

  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "12", 10) || 12;
  const limit = Math.min(Math.max(1, requestedLimit), 24);
  const filters = {
    state: normalise(url.searchParams.get("state")),
    type: normalise(url.searchParams.get("type")),
    germanCourse: normalise(url.searchParams.get("germanCourse")),
    level: normalise(url.searchParams.get("level")),
    uniAssist: normalise(url.searchParams.get("uniAssist")),
  };
  const matched = UNIVERSITIES.filter((item) => matchesFilters(item, filters)).sort(sortByPopularity);
  const start = (page - 1) * limit;
  const items = matched.slice(start, start + limit).map((item) => publicCard(item, lang));

  sendJson(res, 200, {
    items,
    pagination: {
      page,
      limit,
      total: matched.length,
      totalPages: Math.ceil(matched.length / limit),
      hasMore: start + limit < matched.length,
    },
    filters: FILTER_OPTIONS,
    lang,
  });
};
