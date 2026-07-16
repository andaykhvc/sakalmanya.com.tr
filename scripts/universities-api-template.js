/* This file is compiled from sakalmanya_uni_dataset.xlsx by build-university-api.py. */

const DATASET = __DATASET__;
const UNIVERSITIES = DATASET.universities;
const FILTER_OPTIONS = DATASET.filterOptions;
const SITE_URL = "https://sakalmanya.com.tr";
const TRUST_NOTICE = "Başvuru tarihleri ve kabul şartları programa, döneme ve öğrencinin durumuna göre değişebilir. En güncel bilgi için üniversitenin resmi sayfası kontrol edilmelidir.";

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

function publicCard(item) {
  return {
    name: item.name,
    slug: item.slug,
    city: item.city,
    state: item.state,
    type: item.type,
    qsWorldRanking2026: item.qsWorldRanking2026,
    schoolIntro: item.schoolIntro,
    cityIntro: item.cityIntro,
    bachelorDeadline: item.deadlines.bachelor.display,
    masterDeadline: item.deadlines.master.display,
    germanPrepStatus: item.germanCourse.label,
    uniAssistStatus: item.filters.uniAssist,
    lastChecked: item.lastChecked,
    sourceUrl: item.sourceUrl || item.officialWebsite,
    detailUrl: `/universiteler/${item.slug}/`,
  };
}

function relatedUniversities(item) {
  return UNIVERSITIES
    .filter((candidate) => candidate.slug !== item.slug && (candidate.city === item.city || candidate.state === item.state))
    .sort((a, b) => Number(b.city === item.city) - Number(a.city === item.city) || a.name.localeCompare(b.name, "tr"))
    .slice(0, 6)
    .map((candidate) => ({
      name: candidate.name,
      city: candidate.city,
      state: candidate.state,
      detailUrl: `/universiteler/${candidate.slug}/`,
    }));
}

function publicDetail(item) {
  return {
    name: item.name,
    slug: item.slug,
    city: item.city,
    state: item.state,
    type: item.type,
    officialWebsite: item.officialWebsite,
    qsWorldRanking2026: item.qsWorldRanking2026,
    qsSourceUrl: item.qsSourceUrl,
    schoolIntro: item.schoolIntro,
    cityIntro: item.cityIntro,
    popularityReason: item.popularityReason,
    universityLongIntro: item.universityLongIntro,
    whyChoose: item.whyChoose,
    cityStudentLife: item.cityStudentLife,
    cityTransport: item.cityTransport,
    cityCostOfLiving: item.cityCostOfLiving,
    cityHistory: item.cityHistory,
    cityHistoricalNote: item.cityHistoricalNote,
    cityEconomy: item.cityEconomy,
    cityIndustries: item.cityIndustries,
    studentJobsNote: item.studentJobsNote,
    turkishStudentsNote: item.turkishStudentsNote,
    applicationPortal: item.applicationPortal,
    uniAssistStatus: item.filters.uniAssist,
    lastChecked: item.lastChecked,
    sourceUrl: item.sourceUrl,
    logoPath: item.logoPath,
    campusImagePath: item.campusImagePath,
    campusStatus: item.campusStatus,
    campusAttribution: item.campusAttribution,
    campusLicenseUrl: item.campusLicenseUrl,
    campusSourceUrl: item.campusSourceUrl,
    logoStatus: item.logoStatus,
    logoAttribution: item.logoAttribution,
    logoLicenseUrl: item.logoLicenseUrl,
    logoSourceUrl: item.logoSourceUrl,
    deadlines: item.deadlines,
    germanCourse: item.germanCourse,
    related: relatedUniversities(item),
    trustNotice: TRUST_NOTICE,
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

function formatDateTr(value) {
  if (!value) return "Henüz doğrulanmadı";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
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
  const courseAnswer = item.germanCourse.label === "Hazırlık/DSH kursu var"
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

function renderUniversityPage(item) {
  const canonical = `${SITE_URL}/universiteler/${item.slug}/`;
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
  const related = relatedUniversities(item);
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
      addressRegion: item.state,
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
  const verifiedCourse = item.germanCourse.label === "Hazırlık/DSH kursu var";
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
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-P7JNVHYCS2"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-P7JNVHYCS2');
      gtag('config', 'AW-18308696518');
    </script>
    <script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
    <script defer src="/_vercel/insights/script.js"></script>
    <script type="application/ld+json">${jsonForHtml(universitySchema)}</script>
    <script type="application/ld+json">${jsonForHtml(breadcrumbSchema)}</script>
    <script type="application/ld+json">${jsonForHtml(faqSchema)}</script>
  </head>
  <body>
    <div class="flag-strip" aria-hidden="true"><span class="strip-black"></span><span class="strip-red"></span><span class="strip-gold"></span></div>
    <header class="site-header" data-header>
      <a class="brand" href="/" aria-label="ŞAK Almanya Ana sayfa"><img class="brand-mark" src="/assets/logoask.svg" alt="ŞAK Almanya logosu" width="50" height="50" /><span><strong>Almanya</strong></span></a>
      <nav class="main-nav" aria-label="Türkçe menü" data-nav><a href="/#hakkimda">Hakkımda</a><a href="/#hizmetler">Hizmetler</a><a href="/#basarilar">Başarılar</a><a href="/#surec">Süreç</a><a href="/universite-tanitimlari/" aria-current="page">Üniversite Tanıtımları</a><a href="/blog/">Blog</a><a href="/sss/">SSS</a></nav>
      <div class="language-switcher" aria-label="Dil seçimi"><a href="${escapeHtml(canonical)}" lang="tr" aria-current="true">TR</a><span>|</span><a href="/de/universitaeten/" lang="de">DE</a><span>|</span><a href="/en/universities/" lang="en">EN</a></div>
    </header>
    <main>
      <section class="page-hero university-dataset-hero">
        <div class="container">
          <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Ana Sayfa</a> / <a href="/universite-tanitimlari/">Almanya Üniversiteleri</a> / <span>${escapeHtml(item.name)}</span></nav>
          <p class="section-label">${escapeHtml(item.city)} / ${escapeHtml(item.state)}</p>
          <h1>${escapeHtml(seoName)} Son Başvuru Tarihleri ve Başvuru Rehberi</h1>
          <p>${escapeHtml(item.schoolIntro)} ${escapeHtml(seoName)} son başvuru tarihi, lisans ve master başvuru yolu, Uni-Assist durumu ve Almanca hazırlık bilgileri aşağıda kaynaklı şekilde özetlenmiştir.</p>
          <div class="university-hero-facts"><span>${escapeHtml(item.type)}</span><span>QS 2026: ${escapeHtml(item.qsWorldRanking2026)}</span><span>Son kontrol: ${escapeHtml(formatDateTr(item.lastChecked))}</span></div>
          <div class="hero-actions">${externalButton(item.officialWebsite, "Resmi üniversite sitesi", "button button-primary")}<a class="button button-secondary" href="#basvuru-bilgileri">Başvuru bilgileri</a></div>
        </div>
      </section>
      <section class="section page-content">
        <div class="container article-layout university-detail university-dataset-detail">
          <p class="notice-box">${escapeHtml(TRUST_NOTICE)}</p>
          <section class="university-visual-grid" aria-label="Üniversite görselleri">${visualCard(logoPath, `${item.name} logosu`, item.name, "logo", item.logoSourceUrl, item.logoAttribution)}${visualCard(campusPath, `${item.name} kampüs veya ${item.city} şehir görseli`, item.city, "campus", item.campusSourceUrl, item.campusAttribution)}</section>
          <h2>Hızlı Bilgi</h2>
          <div class="table-wrap"><table class="info-table"><tbody>${factRow("Üniversite", item.name)}${factRow("Şehir", item.city)}${factRow("Eyalet", item.state)}${factRow("Tür", item.type)}${factRow("QS 2026", item.qsWorldRanking2026)}${factRow("Uni-Assist", item.filters.uniAssist)}${factRow("Son kontrol", formatDateTr(item.lastChecked))}</tbody></table></div>
          <h2>Üniversite Hakkında</h2><p>${escapeHtml(item.schoolIntro)}</p>${item.universityLongIntro ? `<p>${escapeHtml(item.universityLongIntro)}</p>` : ""}${item.whyChoose ? `<p>${escapeHtml(item.whyChoose)}</p>` : ""}${item.popularityReason ? `<p>${escapeHtml(item.popularityReason)}</p>` : ""}
          <h2>Şehir Hakkında</h2><p>${escapeHtml(item.cityIntro)}</p>${item.cityStudentLife ? `<p>${escapeHtml(item.cityStudentLife)}</p>` : ""}${item.cityTransport ? `<p>${escapeHtml(item.cityTransport)}</p>` : ""}${item.cityCostOfLiving ? `<p>${escapeHtml(item.cityCostOfLiving)}</p>` : ""}
          ${(item.cityHistory || item.cityHistoricalNote) ? `<h2>Şehrin Kısa Tarihi</h2>${item.cityHistory ? `<p>${escapeHtml(item.cityHistory)}</p>` : ""}${item.cityHistoricalNote ? `<p>${escapeHtml(item.cityHistoricalNote)}</p>` : ""}` : ""}
          ${(item.cityEconomy || item.cityIndustries || item.studentJobsNote) ? `<h2>Ekonomi ve Kariyer Çevresi</h2>${item.cityEconomy ? `<p>${escapeHtml(item.cityEconomy)}</p>` : ""}${item.cityIndustries ? `<p>${escapeHtml(item.cityIndustries)}</p>` : ""}${item.studentJobsNote ? `<p>${escapeHtml(item.studentJobsNote)}</p>` : ""}` : ""}
          <section id="basvuru-bilgileri" class="university-anchor-section"><h2>${escapeHtml(seoName)} Son Başvuru Tarihleri</h2><p>${escapeHtml(seoName)} son başvuru tarihi lisans ve master seviyesinde farklı olabilir. Aşağıdaki bilgiler Türkiye’den başvuran adaylar için resmi kaynaklardan kontrol edilmiş özet niteliğindedir.</p><p><strong>Genel başvuru yolu:</strong> ${escapeHtml(item.applicationPortal || item.filters.uniAssist)}</p><h2>${escapeHtml(seoName)} Lisans Son Başvuru Tarihi</h2>${deadlineCard("Lisans", item.deadlines.bachelor)}<h2>${escapeHtml(seoName)} Master Son Başvuru Tarihi</h2>${deadlineCard("Master", item.deadlines.master)}<h2>${escapeHtml(seoName)} Uni-Assist Başvurusu</h2><p>${escapeHtml(seoName)} için Uni-Assist durumu: <strong>${escapeHtml(item.filters.uniAssist)}</strong>. Bazı üniversitelerde başvuru yolu programa, dereceye veya önceki eğitim belgesine göre değişebilir.</p><p class="notice-box">${escapeHtml(TRUST_NOTICE)}</p></section>
          <h2>${escapeHtml(seoName)} Almanca Hazırlık / DSH Kursu</h2><p><strong>Durum:</strong> ${escapeHtml(item.germanCourse.label)}</p><p>${escapeHtml(courseIntro)}</p>${courseDetails ? `<div class="table-wrap"><table class="info-table"><tbody>${courseDetails}</tbody></table></div>` : ""}${externalButton(item.germanCourse.sourceUrl, "Almanca hazırlık kaynağı", "text-link")}
          <h2>QS 2026 Sıralaması</h2><p><strong>${escapeHtml(item.qsWorldRanking2026)}</strong>. Sıralamalar yıldan yıla değişebilir; karar verirken program içeriği, şehir, bütçe ve kabul şartları birlikte değerlendirilmelidir.</p>${externalButton(item.qsSourceUrl, "QS kaynağını aç", "text-link")}
          ${item.turkishStudentsNote ? `<h2>Türk Öğrenciler İçin Notlar</h2><p>${escapeHtml(item.turkishStudentsNote)}</p>` : ""}
          ${relatedSection}
          <h2>Sık Sorulan Sorular</h2><div class="faq-list">${faq.map((entry) => `<details><summary>${escapeHtml(entry.question)}</summary><p>${escapeHtml(entry.answer)}</p></details>`).join("")}</div>
          <h2>Kaynaklar</h2>${uniqueSources.length ? `<ul class="university-source-list">${uniqueSources.join("")}</ul>` : ""}<p><strong>Son kontrol tarihi:</strong> ${escapeHtml(formatDateTr(item.lastChecked))}</p>
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
    sendJson(res, 200, { item: publicDetail(selectedUniversity) });
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
  const matched = UNIVERSITIES.filter((item) => matchesFilters(item, filters));
  const start = (page - 1) * limit;
  const items = matched.slice(start, start + limit).map(publicCard);

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
  });
};
