const yearElement = document.querySelector("[data-year]");

const whatsappNumber = "905452013570";
const pageLanguage = document.documentElement.lang || "tr";
const analyticsStorageKey = "sak-attribution-v1";
const consentStorageKey = "sak-consent-v1";
const campaignParameterNames = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid"];
const deutschlaenderOrigin = "https://deutschlaender.com.tr";
const deutschlaenderCampaign = "deutschlaender_ecosystem";
let isPilotNoticeDismissed = false;

const safelyReadStorage = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch (_error) {
    return null;
  }
};

const safelyWriteStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_error) {
    // Tracking remains functional when storage is unavailable.
  }
};

const safelyRemoveStorage = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch (_error) {
    // The preference update still applies to the current page.
  }
};

const captureAttribution = () => {
  const current = safelyReadStorage(analyticsStorageKey) || {};
  const consent = safelyReadStorage(consentStorageKey);
  const search = new URLSearchParams(window.location.search);
  const incoming = {};
  campaignParameterNames.forEach((name) => {
    const value = search.get(name);
    if (value) incoming[name] = value.slice(0, 180);
  });
  const attribution = {
    ...current,
    ...incoming,
    first_landing_page: current.first_landing_page || `${window.location.pathname}${window.location.search}`.slice(0, 500),
    last_landing_page: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    captured_at: current.captured_at || new Date().toISOString(),
  };
  if ((consent?.analytics || consent?.marketing) && (Object.keys(incoming).length || !current.captured_at)) {
    safelyWriteStorage(analyticsStorageKey, attribution);
  }
  return attribution;
};

const attribution = captureAttribution();

const getPageType = () => {
  const path = window.location.pathname.replace(/\/+$/, "/") || "/";
  if (/^\/(universiteler|universite-tanitimlari|de\/universitaeten|en\/universities)\/[^/]+\/$/.test(path)) return "university_detail";
  if (/^\/(universite-tanitimlari|de\/universitaeten|en\/universities)\/$/.test(path)) return "university_list";
  if (/^\/(blog|de\/blog|en\/blog)\/[^/]+\/$/.test(path)) return "blog_article";
  if (path === "/" || path === "/de/" || path === "/en/") return "home";
  return "content_page";
};

const getUniversitySlug = () => {
  if (getPageType() !== "university_detail") return undefined;
  return window.location.pathname.split("/").filter(Boolean).pop();
};

const getElementLocation = (element) => {
  if (!element) return "unknown";
  if (element.classList.contains("floating-whatsapp")) return "floating_button";
  if (element.closest(".mobile-nav-drawer")) return "mobile_drawer";
  if (element.closest(".hero, .page-hero, .university-hero")) return "hero";
  if (element.closest(".cta-band")) return "cta_band";
  if (element.closest(".contact-section")) return "contact_section";
  if (element.closest(".site-footer")) return "footer";
  if (element.closest(".university-card")) return "university_card";
  return "content";
};

const analyticsContext = (element) => {
  const context = {
    page_type: getPageType(),
    content_language: pageLanguage,
    cta_location: getElementLocation(element),
  };
  const universitySlug = getUniversitySlug();
  if (universitySlug) context.university_slug = universitySlug;
  ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach((name) => {
    if (attribution[name]) context[name] = attribution[name];
  });
  return context;
};

const trackEvent = (eventName, parameters = {}) => {
  if (typeof window.gtag !== "function") return;
  const { element, ...eventParameters } = parameters;
  window.gtag("event", eventName, { ...analyticsContext(element), ...eventParameters });
};

const buildDeutschlaenderUrl = (path = "/", content = "sitewide") => {
  const target = new URL(path, deutschlaenderOrigin);
  target.searchParams.set("utm_source", "sakalmanya");
  target.searchParams.set("utm_medium", "referral");
  target.searchParams.set("utm_campaign", deutschlaenderCampaign);
  target.searchParams.set("utm_content", content);
  return target.toString();
};

const setupDeutschlaenderLinks = () => {
  document.querySelectorAll("[data-deutschlaender-link]").forEach((link) => {
    link.href = buildDeutschlaenderUrl(link.dataset.deutschlaenderPath || "/", link.dataset.deutschlaenderContent || getPageType());
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  document.querySelectorAll(".site-header [data-nav]").forEach((navigation) => {
    if (navigation.querySelector("[data-deutschlaender-header-link]")) return;
    const link = document.createElement("a");
    link.href = buildDeutschlaenderUrl("/forum", "header_nav_forum");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Deutschländer Forum";
    link.setAttribute("data-deutschlaender-link", "");
    link.setAttribute("data-deutschlaender-header-link", "");
    link.dataset.deutschlaenderPath = "/forum";
    link.dataset.deutschlaenderContent = "header_nav_forum";

    const universityLink = Array.from(navigation.querySelectorAll("a")).find((item) => item.href.includes("/universite-tanitimlari/") || item.href.includes("/universitaeten/") || item.href.includes("/universities/"));
    const navigationAnchor = navigation.querySelector("[data-dresden-header-link]") || universityLink;
    if (navigationAnchor) {
      navigationAnchor.after(link);
    } else {
      navigation.append(link);
    }
  });

  const footerLabels = {
    tr: "Almanca öğren & forum",
    de: "Deutsch lernen & Forum",
    en: "Learn German & forum",
  };
  document.querySelectorAll(".site-footer .footer-nav").forEach((navigation) => {
    if (navigation.querySelector("[data-deutschlaender-link]")) return;
    const link = document.createElement("a");
    link.href = buildDeutschlaenderUrl("/", "footer");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = footerLabels[pageLanguage] || footerLabels.tr;
    link.setAttribute("data-deutschlaender-link", "");
    link.dataset.deutschlaenderContent = "footer";
    navigation.append(link);
  });
};

const setupDresdenNavigation = () => {
  const dresdenPaths = {
    tr: "/dresden/",
    de: "/de/dresden/",
    en: "/en/dresden/",
  };
  const dresdenPath = dresdenPaths[pageLanguage] || dresdenPaths.tr;

  document.querySelectorAll(".site-header [data-nav]").forEach((navigation) => {
    if (navigation.querySelector("[data-dresden-header-link]")) return;
    const link = document.createElement("a");
    link.href = dresdenPath;
    link.textContent = "Dresden";
    link.setAttribute("data-dresden-header-link", "");
    if (window.location.pathname === dresdenPath) link.setAttribute("aria-current", "page");

    const universityLink = Array.from(navigation.querySelectorAll("a")).find(
      (item) =>
        item.href.includes("/universite-tanitimlari/") ||
        item.href.includes("/universitaeten/") ||
        item.href.includes("/universities/")
    );
    if (universityLink) {
      universityLink.after(link);
    } else {
      navigation.append(link);
    }
  });
};

const setupMasterNavigation = () => {
  const masterPaths = {
    tr: "/almanya-yuksek-lisans-sartlari/",
    de: "/de/master-voraussetzungen/",
    en: "/en/masters-requirements/",
  };
  const masterLabels = {
    tr: "Yüksek Lisans",
    de: "Master",
    en: "Master’s",
  };
  const masterPath = masterPaths[pageLanguage] || masterPaths.tr;
  const masterLabel = masterLabels[pageLanguage] || masterLabels.tr;

  document.querySelectorAll(".site-header [data-nav]").forEach((navigation) => {
    if (navigation.querySelector("[data-master-header-link]")) return;
    const link = document.createElement("a");
    link.href = masterPath;
    link.textContent = masterLabel;
    link.setAttribute("data-master-header-link", "");
    if (window.location.pathname === masterPath) link.setAttribute("aria-current", "page");

    const universityLink = Array.from(navigation.querySelectorAll("a")).find(
      (item) =>
        item.href.includes("/universite-tanitimlari/") ||
        item.href.includes("/universitaeten/") ||
        item.href.includes("/universities/")
    );
    if (universityLink) {
      universityLink.after(link);
    } else {
      navigation.append(link);
    }
  });
};

const setupAboutNavigation = () => {
  const aboutPaths = {
    tr: "/hakkimizda/",
    de: "/de/ueber-uns/",
    en: "/en/about/",
  };
  const aboutLabels = {
    tr: "Hakkımızda",
    de: "Über uns",
    en: "About",
  };
  const aboutPath = aboutPaths[pageLanguage] || aboutPaths.tr;
  const aboutLabel = aboutLabels[pageLanguage] || aboutLabels.tr;
  const currentPath = window.location.pathname.replace(/\/+$/, "/") || "/";

  document.querySelectorAll(".site-header [data-nav]").forEach((navigation) => {
    const link = Array.from(navigation.querySelectorAll("a")).find((item) => {
      const href = item.getAttribute("href") || "";
      return href === aboutPath || href.includes("#hakkimda") || href.includes("#ueber-mich") || href.includes("#about") || item.hasAttribute("data-about-header-link");
    });
    if (!link) return;
    link.href = aboutPath;
    link.textContent = aboutLabel;
    link.setAttribute("data-about-header-link", "");
    link.removeAttribute("aria-current");
    if (currentPath === aboutPath) link.setAttribute("aria-current", "page");
  });

  document.querySelectorAll(".site-footer .footer-nav").forEach((navigation) => {
    let link = navigation.querySelector("[data-about-footer-link]") || Array.from(navigation.querySelectorAll("a")).find((item) => {
      const href = item.getAttribute("href") || "";
      return href === aboutPath || href.includes("#hakkimda") || href.includes("#ueber-mich") || href.includes("#about");
    });
    if (!link) {
      link = document.createElement("a");
      navigation.prepend(link);
    }
    link.setAttribute("data-about-footer-link", "");
    link.href = aboutPath;
    link.textContent = aboutLabel;
    link.removeAttribute("aria-current");
    if (currentPath === aboutPath) link.setAttribute("aria-current", "page");
  });

  const servicePaths = ["/hizmetler/", "/de/leistungen/", "/en/services/"];
  if (servicePaths.includes(currentPath) && !document.querySelector("[data-about-context-link]")) {
    const cta = document.querySelector(".services-section .cta-band");
    if (cta) {
      const paragraph = document.createElement("p");
      const link = document.createElement("a");
      paragraph.className = "about-context-link";
      paragraph.setAttribute("data-about-context-link", "");
      link.className = "text-link";
      link.href = aboutPath;
      link.textContent = pageLanguage === "de"
        ? "Mehr über den Gründer und die Entstehung von ŞAK Almanya erfahren"
        : pageLanguage === "en"
          ? "Learn more about the founder and how ŞAK Almanya was built"
          : "Kurucuyu ve ŞAK Almanya’nın nasıl ortaya çıktığını tanıyın";
      paragraph.append(link);
      cta.before(paragraph);
    }
  }
};

const whatsappMessages = {
  tr: "Merhaba Anday, sakalmanya.com.tr üzerinden yazıyorum. Almanya eğitimi veya Almanca öğrenme hedefim için ücretsiz pilot görüşmeye başvurmak istiyorum.",
  de: "Hallo Anday, ich schreibe über sakalmanya.com.tr. Ich möchte ein kostenloses Pilotgespräch zu meinem Ziel Studium in Deutschland oder Deutschlernen anfragen.",
  en: "Hello Anday, I am contacting you through sakalmanya.com.tr. I would like to apply for a free pilot conversation about studying in Germany or learning German.",
};

const buildWhatsappMessage = () => {
  const base = whatsappMessages[pageLanguage] || whatsappMessages.tr;
  const universityName = getPageType() === "university_detail"
    ? document.body.dataset.universityName || document.querySelector("h1")?.textContent?.trim()
    : "";
  const pageNote = universityName
    ? pageLanguage === "de"
      ? ` Ich interessiere mich für ${universityName}.`
      : pageLanguage === "en"
        ? ` I am interested in ${universityName}.`
        : ` ${universityName} hakkında bilgi almak istiyorum.`
    : "";
  const source = attribution.utm_source?.replace(/[^a-z0-9._-]/gi, "").slice(0, 40);
  const sourceNote = source ? ` [Kaynak: ${source}]` : "";
  return `${base}${pageNote}${sourceNote}`;
};

const updateWhatsappLinks = (root = document) => {
  root.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
    link.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildWhatsappMessage())}`;
  });
};

const consentCopy = {
  tr: {
    title: "Çerez tercihlerin",
    description: "Site performansını ölçmek ve reklam dönüşümlerini anlamak için isteğe bağlı Analytics ve pazarlama teknolojileri kullanıyoruz.",
    accept: "Tümünü kabul et",
    reject: "İsteğe bağlıları reddet",
    customize: "Tercihleri yönet",
    settingsTitle: "Çerez tercihlerini yönet",
    necessary: "Gerekli",
    necessaryDescription: "Sitenin ve tercih panelinin çalışması için her zaman aktiftir.",
    analytics: "Analytics",
    analyticsDescription: "Hangi sayfaların ve içeriklerin faydalı olduğunu anlamamıza yardımcı olur.",
    marketing: "Pazarlama",
    marketingDescription: "Google Ads dönüşümlerini ölçmeye ve reklam performansını geliştirmeye yardımcı olur.",
    alwaysOn: "Her zaman açık",
    save: "Tercihleri kaydet",
    close: "Kapat",
    footer: "Çerez tercihleri",
  },
  de: {
    title: "Cookie-Einstellungen",
    description: "Wir verwenden optionale Analytics- und Marketing-Technologien, um die Website- und Anzeigenleistung zu messen.",
    accept: "Alle akzeptieren",
    reject: "Optionale ablehnen",
    customize: "Einstellungen verwalten",
    settingsTitle: "Cookie-Einstellungen verwalten",
    necessary: "Erforderlich",
    necessaryDescription: "Für die Website und das Einstellungsfenster immer aktiv.",
    analytics: "Analytics",
    analyticsDescription: "Hilft uns zu verstehen, welche Seiten und Inhalte nützlich sind.",
    marketing: "Marketing",
    marketingDescription: "Hilft bei der Messung von Google-Ads-Conversions und der Anzeigenleistung.",
    alwaysOn: "Immer aktiv",
    save: "Einstellungen speichern",
    close: "Schließen",
    footer: "Cookie-Einstellungen",
  },
  en: {
    title: "Cookie preferences",
    description: "We use optional Analytics and marketing technologies to measure website and advertising performance.",
    accept: "Accept all",
    reject: "Reject optional",
    customize: "Manage preferences",
    settingsTitle: "Manage cookie preferences",
    necessary: "Necessary",
    necessaryDescription: "Always active so the website and preference panel can work.",
    analytics: "Analytics",
    analyticsDescription: "Helps us understand which pages and content are useful.",
    marketing: "Marketing",
    marketingDescription: "Helps measure Google Ads conversions and improve advertising performance.",
    alwaysOn: "Always on",
    save: "Save preferences",
    close: "Close",
    footer: "Cookie preferences",
  },
};

const pilotNoticeCopy = {
  de: {
    title: "Wichtiger Hinweis",
    paragraphs: [
      "ŞAK Almanya befindet sich derzeit in einer nicht kommerziellen Vorbereitungs- und Pilotphase. Über diese Website werden aktuell keine kostenpflichtige Beratung, kein entgeltlicher Sprachunterricht und keine sonstigen kostenpflichtigen Leistungen angeboten.",
      "Lediglich einer begrenzten Anzahl von Personen wird unentgeltlich und zu Testzwecken eine allgemeine Orientierungshilfe angeboten. Es werden keine Vergütungen angenommen und keine Rechnungen oder entgeltlichen Dienstleistungsverträge erstellt.",
      "Kostenpflichtige Leistungen werden erst nach Abschluss der in Deutschland erforderlichen Genehmigungs- und Registrierungsschritte angeboten.",
    ],
    confirm: "Verstanden",
    languageButton: "TR",
    languageLabel: "Türkçe göster",
  },
  tr: {
    title: "Önemli Bilgilendirme",
    paragraphs: [
      "ŞAK Almanya şu anda ticari olmayan bir hazırlık ve pilot çalışma aşamasındadır. Bu internet sitesi üzerinden hâlen ücretli danışmanlık, özel ders veya başka bir ücretli hizmet sunulmamaktadır.",
      "Sınırlı sayıdaki kişiye yalnızca ücretsiz ve deneme amaçlı bilgilendirme desteği verilmektedir. Herhangi bir ücret alınmamakta; fatura, ücretli hizmet sözleşmesi veya ticari ödeme oluşturulmamaktadır.",
      "Ücretli hizmetler ancak Almanya’daki gerekli izin ve kayıt süreçleri tamamlandıktan sonra başlayacaktır.",
    ],
    confirm: "Anladım",
    languageButton: "DE",
    languageLabel: "Auf Deutsch anzeigen",
  },
};

const setupPilotNotice = () => {
  if (isPilotNoticeDismissed) return;
  if (document.querySelector("[data-pilot-notice]")) return;

  let activeLanguage = "de";
  let previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const modal = document.createElement("div");
  const overlay = document.createElement("div");
  const dialog = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h2");
  const languageButton = document.createElement("button");
  const description = document.createElement("div");
  const confirmButton = document.createElement("button");
  const titleId = "sak-pilot-notice-title";
  const descriptionId = "sak-pilot-notice-description";

  modal.className = "pilot-notice";
  modal.setAttribute("data-pilot-notice", "");
  overlay.className = "pilot-notice__overlay";
  overlay.setAttribute("aria-hidden", "true");
  dialog.className = "pilot-notice__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.setAttribute("aria-describedby", descriptionId);
  dialog.tabIndex = -1;
  header.className = "pilot-notice__header";
  title.id = titleId;
  languageButton.className = "pilot-notice__language";
  languageButton.type = "button";
  description.className = "pilot-notice__description";
  description.id = descriptionId;
  confirmButton.className = "button button-primary pilot-notice__confirm";
  confirmButton.type = "button";
  header.append(title, languageButton);
  dialog.append(header, description, confirmButton);
  modal.append(overlay, dialog);

  const render = () => {
    const copy = pilotNoticeCopy[activeLanguage];
    title.textContent = copy.title;
    languageButton.textContent = copy.languageButton;
    languageButton.setAttribute("aria-label", copy.languageLabel);
    confirmButton.textContent = copy.confirm;
    dialog.lang = activeLanguage;
    description.replaceChildren(...copy.paragraphs.map((paragraph) => {
      const element = document.createElement("p");
      element.textContent = paragraph;
      return element;
    }));
  };

  const focusableElements = () => [languageButton, confirmButton].filter((element) => !element.disabled);

  const close = () => {
    isPilotNoticeDismissed = true;
    document.removeEventListener("keydown", handleKeydown);
    document.documentElement.classList.remove("is-pilot-notice-open");
    document.body.classList.remove("is-pilot-notice-open");
    modal.remove();
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
    previouslyFocused = null;
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = focusableElements();
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  languageButton.addEventListener("click", () => {
    activeLanguage = activeLanguage === "de" ? "tr" : "de";
    render();
    languageButton.focus();
  });
  confirmButton.addEventListener("click", () => {
    close();
  });

  render();
  document.body.append(modal);
  document.documentElement.classList.add("is-pilot-notice-open");
  document.body.classList.add("is-pilot-notice-open");
  document.addEventListener("keydown", handleKeydown);
  languageButton.focus();
};

const setupConsentManager = () => {
  if (document.querySelector("[data-consent-banner]")) return;
  const copy = consentCopy[pageLanguage] || consentCopy.tr;
  const existingConsent = safelyReadStorage(consentStorageKey);
  const banner = document.createElement("section");
  const settingsOverlay = document.createElement("div");
  const settings = document.createElement("section");
  const analyticsInputId = "consent-analytics";
  const marketingInputId = "consent-marketing";

  banner.className = "consent-banner";
  banner.setAttribute("data-consent-banner", "");
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", copy.title);
  banner.innerHTML = `
    <div class="consent-banner-copy"><strong>${copy.title}</strong><p>${copy.description}</p></div>
    <div class="consent-banner-actions">
      <button class="button button-primary" type="button" data-consent-accept>${copy.accept}</button>
      <button class="button button-secondary" type="button" data-consent-reject>${copy.reject}</button>
      <button class="consent-text-button" type="button" data-consent-customize>${copy.customize}</button>
    </div>`;

  settingsOverlay.className = "consent-settings-overlay";
  settingsOverlay.hidden = true;
  settingsOverlay.setAttribute("data-consent-overlay", "");

  settings.className = "consent-settings";
  settings.hidden = true;
  settings.setAttribute("data-consent-settings", "");
  settings.setAttribute("role", "dialog");
  settings.setAttribute("aria-modal", "true");
  settings.setAttribute("aria-labelledby", "consent-settings-title");
  settings.innerHTML = `
    <div class="consent-settings-header">
      <h2 id="consent-settings-title">${copy.settingsTitle}</h2>
      <button class="consent-close" type="button" aria-label="${copy.close}" data-consent-close>×</button>
    </div>
    <div class="consent-option consent-option--fixed">
      <div><strong>${copy.necessary}</strong><p>${copy.necessaryDescription}</p></div><span>${copy.alwaysOn}</span>
    </div>
    <label class="consent-option" for="${analyticsInputId}">
      <div><strong>${copy.analytics}</strong><p>${copy.analyticsDescription}</p></div><input id="${analyticsInputId}" type="checkbox" />
    </label>
    <label class="consent-option" for="${marketingInputId}">
      <div><strong>${copy.marketing}</strong><p>${copy.marketingDescription}</p></div><input id="${marketingInputId}" type="checkbox" />
    </label>
    <button class="button button-primary consent-save" type="button" data-consent-save>${copy.save}</button>`;

  document.body.append(banner, settingsOverlay, settings);

  const analyticsInput = settings.querySelector(`#${analyticsInputId}`);
  const marketingInput = settings.querySelector(`#${marketingInputId}`);
  let previouslyFocused = null;

  const persistConsent = (analytics, marketing) => {
    const consent = { analytics, marketing, updatedAt: new Date().toISOString() };
    safelyWriteStorage(consentStorageKey, consent);
    if (analytics || marketing) {
      safelyWriteStorage(analyticsStorageKey, attribution);
    } else {
      safelyRemoveStorage(analyticsStorageKey);
    }
    window.sakUpdateGoogleConsent?.(consent);
    banner.hidden = true;
    closeSettings();
    if (analytics) trackEvent("consent_update", { analytics_consent: analytics ? "granted" : "denied", marketing_consent: marketing ? "granted" : "denied" });
  };

  const openSettings = () => {
    previouslyFocused = document.activeElement;
    const consent = safelyReadStorage(consentStorageKey) || existingConsent || {};
    analyticsInput.checked = consent.analytics === true;
    marketingInput.checked = consent.marketing === true;
    settingsOverlay.hidden = false;
    settings.hidden = false;
    document.body.classList.add("is-consent-open");
    window.setTimeout(() => settings.querySelector("[data-consent-close]")?.focus(), 20);
  };

  function closeSettings() {
    settingsOverlay.hidden = true;
    settings.hidden = true;
    document.body.classList.remove("is-consent-open");
    previouslyFocused?.focus();
  }

  banner.querySelector("[data-consent-accept]").addEventListener("click", () => persistConsent(true, true));
  banner.querySelector("[data-consent-reject]").addEventListener("click", () => persistConsent(false, false));
  banner.querySelector("[data-consent-customize]").addEventListener("click", openSettings);
  settings.querySelector("[data-consent-save]").addEventListener("click", () => persistConsent(analyticsInput.checked, marketingInput.checked));
  settings.querySelector("[data-consent-close]").addEventListener("click", closeSettings);
  settingsOverlay.addEventListener("click", closeSettings);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !settings.hidden) closeSettings();
  });

  document.querySelectorAll(".site-footer .footer-nav").forEach((navigation) => {
    if (navigation.querySelector("[data-consent-preferences]")) return;
    const button = document.createElement("button");
    button.className = "consent-preferences-link";
    button.type = "button";
    button.textContent = copy.footer;
    button.setAttribute("data-consent-preferences", "");
    button.addEventListener("click", openSettings);
    navigation.append(button);
  });

  if (existingConsent) banner.hidden = true;
};

const setupAnalyticsTracking = () => {
  const universitySlug = getUniversitySlug();
  if (universitySlug) {
    trackEvent("view_university", {
      university_slug: universitySlug,
      university_name: document.querySelector("h1")?.textContent?.trim().slice(0, 100),
    });
  } else if (getPageType() === "university_list") {
    trackEvent("view_university_list");
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("data-whatsapp-link")) return;
    const href = link.getAttribute("href") || "";

    if (href.startsWith("mailto:")) {
      trackEvent("click_email", { element: link, link_domain: "email" });
      return;
    }

    let target;
    try {
      target = new URL(link.href, window.location.origin);
    } catch (_error) {
      return;
    }

    if (target.origin === window.location.origin && /^\/universiteler\/[^/]+\/?$/.test(target.pathname)) {
      trackEvent("select_university", {
        element: link,
        university_slug: target.pathname.split("/").filter(Boolean).pop(),
        link_text: link.textContent.trim().slice(0, 100),
      });
      return;
    }

    if (target.origin !== window.location.origin) {
      if (target.hostname === "deutschlaender.com.tr" || target.hostname === "www.deutschlaender.com.tr") {
        trackEvent("click_deutschlaender", {
          element: link,
          link_domain: "deutschlaender.com.tr",
          destination_path: target.pathname,
          link_text: link.textContent.trim().slice(0, 100),
          cross_site_content: link.dataset.deutschlaenderContent || getPageType(),
        });
        return;
      }
      const socialPlatform = ["instagram.com", "youtube.com", "linkedin.com"].find((domain) => target.hostname.includes(domain));
      trackEvent(socialPlatform ? "click_social" : "click_official_source", {
        element: link,
        link_domain: target.hostname.replace(/^www\./, ""),
        link_text: link.textContent.trim().slice(0, 100),
        ...(socialPlatform ? { social_platform: socialPlatform.replace(".com", "") } : {}),
      });
    }
  });

  document.querySelectorAll("details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      trackEvent("open_faq", {
        element: details,
        faq_question: details.querySelector("summary")?.textContent?.trim().slice(0, 100),
      });
    });
  });

  document.querySelectorAll(".language-switcher a, .mobile-drawer-languages a").forEach((link) => {
    link.addEventListener("click", () => {
      trackEvent("change_language", {
        element: link,
        selected_language: link.getAttribute("lang") || link.textContent.trim().toLowerCase(),
      });
    });
  });

  const reachedDepths = new Set();
  const trackScrollDepth = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const percent = Math.round((window.scrollY / scrollable) * 100);
    [50, 90].forEach((depth) => {
      if (percent < depth || reachedDepths.has(depth)) return;
      reachedDepths.add(depth);
      trackEvent("scroll_depth", { percent_scrolled: depth });
    });
  };
  window.addEventListener("scroll", trackScrollDepth, { passive: true });
};

const bindGoogleAdsConversion = (link) => {
  if (!link || link.dataset.googleAdsConversionBound === "true") return;
  link.dataset.googleAdsConversionBound = "true";
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    trackEvent("click_whatsapp", {
      element: link,
      link_domain: "wa.me",
      university_slug: getUniversitySlug(),
    });
    if (typeof window.gtag_report_conversion !== "function") return;
    if (link.target === "_blank") {
      window.gtag_report_conversion(undefined, analyticsContext(link));
      return;
    }
    event.preventDefault();
    window.gtag_report_conversion(link.href, analyticsContext(link));
  });
};

const bindGoogleAdsConversions = () => {
  document.querySelectorAll("[data-whatsapp-link]").forEach(bindGoogleAdsConversion);
};

const floatingWhatsappMessages = {
  tr: "Merhaba, Almanya süreci hakkında bilgi almak istiyorum.",
  de: "Hallo, ich möchte Informationen zum Deutschland-Prozess erhalten.",
  en: "Hello, I would like to get information about the Germany process.",
};

const mobileNavigationCopy = {
  tr: {
    menu: "Menüyü aç",
    close: "Menüyü kapat",
    navigation: "Mobil menü",
    cta: "Ücretsiz pilot görüşmeye başvur",
    language: "Dil seçimi",
    links: [
      ["Ana Sayfa", "/"],
      ["Planlanan destek alanları", "/hizmetler/"],
      ["Studienkolleg Rehberi", "/studienkolleg/"],
      ["Üniversiteler", "/universite-tanitimlari/"],
      ["Dresden", "/dresden/"],
      ["Deutschländer Forum", "https://deutschlaender.com.tr/forum"],
      ["Almanya’da Eğitim", "/almanya-egitim-danismanligi/"],
      ["Başarılarımız", "/#basarilar"],
      ["Hakkımızda", "/hakkimizda/"],
      ["Sık Sorulan Sorular", "/sss/"],
      ["İletişim", "/#iletisim"],
    ],
  },
  de: {
    menu: "Menü öffnen",
    close: "Menü schließen",
    navigation: "Mobile Navigation",
    cta: "Kostenloses Pilotgespräch anfragen",
    language: "Sprachauswahl",
    links: [
      ["Startseite", "/de/"],
      ["Geplante Unterstützungsbereiche", "/de/leistungen/"],
      ["Studienkolleg", "/de/studienkolleg/"],
      ["Universitäten", "/de/universitaeten/"],
      ["Dresden", "/de/dresden/"],
      ["Deutschländer Forum", "https://deutschlaender.com.tr/forum"],
      ["Bildungsberatung", "/de/bildungsberatung/"],
      ["Erfolge", "/de/#erfolge"],
      ["Über uns", "/de/ueber-uns/"],
      ["FAQ", "/de/faq/"],
      ["Kontakt", "/de/#kontakt"],
    ],
  },
  en: {
    menu: "Open menu",
    close: "Close menu",
    navigation: "Mobile navigation",
    cta: "Apply for a free pilot consultation",
    language: "Language selection",
    links: [
      ["Home", "/en/"],
      ["Planned support areas", "/en/services/"],
      ["Studienkolleg guide", "/en/studienkolleg/"],
      ["Universities", "/en/universities/"],
      ["Dresden", "/en/dresden/"],
      ["Deutschländer Forum", "https://deutschlaender.com.tr/forum"],
      ["Education Guidance", "/en/education-consulting/"],
      ["Success Stories", "/en/#success-stories"],
      ["About", "/en/about/"],
      ["Frequently Asked Questions", "/en/faq/"],
      ["Contact", "/en/#contact"],
    ],
  },
};

const setupMobileNavigation = () => {
  const header = document.querySelector("[data-header]");
  const desktopNavigation = header?.querySelector("[data-nav]");
  const languageSwitcher = header?.querySelector(".language-switcher");
  if (!header || !desktopNavigation || !languageSwitcher || document.querySelector("[data-mobile-drawer]")) return;

  const copy = mobileNavigationCopy[pageLanguage] || mobileNavigationCopy.tr;
  const activeLanguage = languageSwitcher.querySelector('[aria-current="true"]') || languageSwitcher.querySelector("a");
  const controls = document.createElement("div");
  const toggle = document.createElement("button");
  const overlay = document.createElement("div");
  const drawer = document.createElement("aside");
  const drawerHeader = document.createElement("div");
  const drawerTitle = document.createElement("strong");
  const closeButton = document.createElement("button");
  const navigation = document.createElement("nav");
  const drawerFooter = document.createElement("div");
  const cta = document.createElement("a");
  const drawerLanguages = document.createElement("div");
  const mobileLanguageSwitcher = languageSwitcher.cloneNode(true);
  const drawerSocials = document.querySelector(".site-footer .social-links")?.cloneNode(true);
  const drawerId = "mobile-navigation-drawer";
  let previouslyFocused = null;
  let closeTimer = null;

  controls.className = "mobile-nav-controls";
  mobileLanguageSwitcher.classList.add("header-language-switcher");
  toggle.className = "mobile-menu-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", copy.menu);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", drawerId);
  toggle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
  controls.append(mobileLanguageSwitcher, toggle);
  header.append(controls);

  overlay.className = "mobile-nav-overlay";
  overlay.hidden = true;
  overlay.setAttribute("data-mobile-overlay", "");

  drawer.className = "mobile-nav-drawer";
  drawer.id = drawerId;
  drawer.hidden = true;
  drawer.setAttribute("data-mobile-drawer", "");
  drawer.setAttribute("aria-hidden", "true");
  drawer.setAttribute("aria-label", copy.navigation);

  drawerHeader.className = "mobile-drawer-header";
  drawerTitle.textContent = "ŞAK Almanya";
  closeButton.className = "mobile-menu-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", copy.close);
  closeButton.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span>';
  drawerHeader.append(drawerTitle, closeButton);

  navigation.className = "mobile-drawer-nav";
  navigation.setAttribute("aria-label", copy.navigation);
  const currentPath = window.location.pathname.replace(/\/+$/, "/") || "/";
  copy.links.forEach(([label, href]) => {
    const link = document.createElement("a");
    const target = new URL(href, window.location.origin);
    const isDeutschlaenderLink = target.hostname === "deutschlaender.com.tr" || target.hostname === "www.deutschlaender.com.tr";
    const targetPath = target.pathname.replace(/\/+$/, "/") || "/";
    const exactSection = target.hash && currentPath === targetPath && window.location.hash === target.hash;
    const isLanguageHome = ["/", "/de/", "/en/"].includes(targetPath);
    const routeMatch =
      !target.hash && (currentPath === targetPath || (!isLanguageHome && currentPath.startsWith(targetPath)));
    link.href = isDeutschlaenderLink ? buildDeutschlaenderUrl(target.pathname, "mobile_drawer_forum") : href;
    link.textContent = label;
    if (isDeutschlaenderLink) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("data-deutschlaender-link", "");
      link.dataset.deutschlaenderPath = target.pathname;
      link.dataset.deutschlaenderContent = "mobile_drawer_forum";
    }
    if (exactSection || routeMatch) link.setAttribute("aria-current", "page");
    navigation.append(link);
  });

  drawerFooter.className = "mobile-drawer-footer";
  cta.className = "button button-primary mobile-drawer-cta";
  cta.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    floatingWhatsappMessages[pageLanguage] || floatingWhatsappMessages.tr
  )}`;
  cta.target = "_blank";
  cta.rel = "noopener noreferrer";
  cta.textContent = copy.cta;
  cta.setAttribute("data-whatsapp-link", "");

  drawerLanguages.className = "mobile-drawer-languages";
  drawerLanguages.setAttribute("aria-label", copy.language);
  languageSwitcher.querySelectorAll("a").forEach((languageLink) => drawerLanguages.append(languageLink.cloneNode(true)));
  drawerFooter.append(cta, drawerLanguages);
  if (drawerSocials) {
    drawerSocials.classList.add("mobile-drawer-socials");
    drawerSocials.querySelector(".footer-look-link")?.remove();
    drawerFooter.append(drawerSocials);
  }
  drawer.append(drawerHeader, navigation, drawerFooter);
  document.body.append(overlay, drawer);

  const focusableElements = () => Array.from(drawer.querySelectorAll('a[href], button:not([disabled])'));
  const setOpen = (open) => {
    window.clearTimeout(closeTimer);
    if (open) previouslyFocused = document.activeElement;
    drawer.hidden = false;
    overlay.hidden = false;
    requestAnimationFrame(() => {
      drawer.classList.toggle("is-open", open);
      overlay.classList.toggle("is-open", open);
    });
    drawer.setAttribute("aria-hidden", String(!open));
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? copy.close : copy.menu);
    document.body.classList.toggle("is-mobile-menu-open", open);
    document.documentElement.classList.toggle("is-mobile-menu-open", open);
    if (open) {
      window.setTimeout(() => closeButton.focus(), 60);
    } else {
      closeTimer = window.setTimeout(() => {
        drawer.hidden = true;
        overlay.hidden = true;
      }, 240);
      previouslyFocused?.focus();
    }
  };

  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  closeButton.addEventListener("click", () => setOpen(false));
  overlay.addEventListener("click", () => setOpen(false));
  drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  drawer.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const elements = focusableElements();
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setOpen(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && toggle.getAttribute("aria-expanded") === "true") setOpen(false);
  });

  if (activeLanguage) {
    activeLanguage.setAttribute("data-active-language", "");
    mobileLanguageSwitcher.querySelector(`[lang="${activeLanguage.getAttribute("lang")}"]`)?.setAttribute("data-active-language", "");
  }
};

const setupFooterBottomRows = () => {
  document.querySelectorAll(".site-footer .footer-links-panel").forEach((panel) => {
    if (panel.querySelector(":scope > .footer-bottom-row")) return;
    const metadata = Array.from(panel.children).filter((child) => child.tagName === "SPAN");
    if (!metadata.length) return;
    const bottomRow = document.createElement("div");
    bottomRow.className = "footer-bottom-row";
    metadata.forEach((item) => bottomRow.append(item));
    panel.append(bottomRow);
  });
};

setupConsentManager();
setupPilotNotice();
setupAboutNavigation();
setupMobileNavigation();
setupFooterBottomRows();
setupDresdenNavigation();
setupMasterNavigation();
setupDeutschlaenderLinks();
updateWhatsappLinks();
bindGoogleAdsConversions();
setupAnalyticsTracking();

const floatingWhatsapp = document.createElement("a");
floatingWhatsapp.className = "floating-whatsapp";
floatingWhatsapp.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
  floatingWhatsappMessages[pageLanguage] || floatingWhatsappMessages.tr
)}`;
floatingWhatsapp.target = "_blank";
floatingWhatsapp.rel = "noopener noreferrer";
floatingWhatsapp.setAttribute("aria-label", "WhatsApp");
floatingWhatsapp.setAttribute("data-whatsapp-link", "");
floatingWhatsapp.innerHTML = `
  <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path d="M16.04 3.2A12.67 12.67 0 0 0 5.32 22.6L3.2 28.8l6.4-2.04A12.66 12.66 0 1 0 16.04 3.2Zm0 23.05c-2.1 0-4.06-.62-5.7-1.7l-.4-.26-3.77 1.2 1.23-3.64-.27-.42a10.26 10.26 0 1 1 8.91 4.82Zm5.82-7.68c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.72.16-.21.32-.82 1.03-1.01 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57-.94-.84-1.58-1.88-1.76-2.2-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.36-.26-.62-.52-.53-.72-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.08 1.31 3.29c.16.21 2.27 3.46 5.5 4.85.77.33 1.37.53 1.84.68.77.24 1.47.21 2.02.13.62-.09 1.88-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"/>
  </svg>
  <span>WhatsApp</span>
`;
document.body.appendChild(floatingWhatsapp);
updateWhatsappLinks();
bindGoogleAdsConversion(floatingWhatsapp);

const siteFooter = document.querySelector(".site-footer");
if (siteFooter && "IntersectionObserver" in window) {
  const footerObserver = new IntersectionObserver(
    ([entry]) => floatingWhatsapp.classList.toggle("is-footer-visible", entry.isIntersecting),
    { threshold: 0.02 }
  );
  footerObserver.observe(siteFooter);
}

document.querySelectorAll("[data-document-carousel]").forEach((carousel) => {
  const items = Array.from(carousel.querySelectorAll(".document-previews a"));
  const previous = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  const visibleCount = Math.min(3, items.length);
  let current = 0;

  const show = (index) => {
    current = (index + items.length) % items.length;
    items.forEach((item, itemIndex) => {
      const offset = (itemIndex - current + items.length) % items.length;
      item.classList.toggle("is-active", offset < visibleCount);
    });
  };

  previous?.addEventListener("click", () => show(current - 1));
  next?.addEventListener("click", () => show(current + 1));
  show(0);
});

const universityFilters = document.querySelector("[data-university-filters]");
const universityGrid = document.querySelector("[data-university-grid]");
const universityLoadMore = document.createElement("button");

const universityCopy = {
  tr: {
    all: "Tümü",
    loading: "Üniversite verileri yükleniyor...",
    empty: "Üniversite verisi yakında eklenecek.",
    error: "Üniversite verileri şu an yüklenemedi.",
    loadMore: "Daha fazla göster",
    source: "Resmi kaynak",
    details: "Detayları gör",
    qs: "QS 2026",
    bachelor: "Lisans",
    master: "Master",
    germanPrep: "Almanca hazırlık",
    uniAssist: "Uni-Assist",
    lastChecked: "Son kontrol",
  },
  de: {
    all: "Alle",
    loading: "Universitätsdaten werden geladen...",
    empty: "Universitätsdaten werden bald ergänzt.",
    error: "Universitätsdaten konnten gerade nicht geladen werden.",
    loadMore: "Mehr anzeigen",
    source: "Offizielle Quelle",
    details: "Details ansehen",
    qs: "QS 2026",
    bachelor: "Bachelor",
    master: "Master",
    germanPrep: "Deutschvorbereitung",
    uniAssist: "Uni-Assist",
    lastChecked: "Zuletzt geprüft",
  },
  en: {
    all: "All",
    loading: "Loading university data...",
    empty: "University data will be added soon.",
    error: "University data could not be loaded right now.",
    loadMore: "Show more",
    source: "Official source",
    details: "View details",
    qs: "QS 2026",
    bachelor: "Bachelor",
    master: "Master",
    germanPrep: "German prep",
    uniAssist: "Uni-Assist",
    lastChecked: "Last checked",
  },
};

const activeUniversityCopy = universityCopy[pageLanguage] || universityCopy.tr;

if (universityFilters && universityGrid) {
  let universityPage = 1;
  let hasMoreUniversities = false;
  let universityFiltersPopulated = false;

  universityLoadMore.type = "button";
  universityLoadMore.className = "button button-secondary university-load-more";
  universityLoadMore.textContent = activeUniversityCopy.loadMore;
  universityLoadMore.hidden = true;
  universityGrid.after(universityLoadMore);

  const setUniversityMessage = (message) => {
    universityGrid.innerHTML = "";
    const emptyState = document.createElement("p");
    emptyState.className = "university-empty-state";
    emptyState.textContent = message;
    universityGrid.append(emptyState);
  };

  const getLabel = (option) => option?.label?.[pageLanguage] || option?.label?.tr || option?.value || "";

  const populateUniversityFilters = (filters) => {
    if (!filters || universityFiltersPopulated) return;
    universityFilters.querySelectorAll("[data-filter]").forEach((field) => {
      const options = filters[field.dataset.filter];
      if (!Array.isArray(options)) return;
      const currentValue = field.value;
      field.innerHTML = "";
      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = activeUniversityCopy.all;
      field.append(allOption);
      options.forEach((option) => {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = getLabel(option);
        field.append(element);
      });
      field.value = currentValue;
    });
    universityFiltersPopulated = true;
  };

  const currentUniversityParams = () => {
    const params = new URLSearchParams({ page: String(universityPage), limit: "12", lang: pageLanguage });
    universityFilters.querySelectorAll("[data-filter]").forEach((field) => {
      if (field.value) params.set(field.dataset.filter, field.value);
    });
    return params;
  };

  const createFact = (label, value) => {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value || "-";
    wrapper.append(term, description);
    return wrapper;
  };

  const renderUniversityCard = (item) => {
    const card = document.createElement("article");
    card.className = "university-card";

    if (item.logoPath) {
      const logo = document.createElement("img");
      logo.className = "university-card-logo";
      logo.src = item.logoPath;
      logo.alt = "";
      logo.setAttribute("aria-hidden", "true");
      logo.loading = "lazy";
      logo.decoding = "async";
      logo.addEventListener("error", () => {
        logo.remove();
        card.classList.remove("has-logo");
      }, { once: true });
      card.classList.add("has-logo");
      card.append(logo);
    }

    const location = document.createElement("p");
    location.className = "section-label";
    location.textContent = [item.city, item.state].filter(Boolean).join(" / ");

    const title = document.createElement("h2");
    title.textContent = item.name;

    const type = document.createElement("p");
    type.className = "university-type";
    type.textContent = item.type;

    const meta = document.createElement("p");
    meta.className = "university-card-meta";
    meta.textContent = `${activeUniversityCopy.qs}: ${item.qsWorldRanking2026 || "-"}`;

    const facts = document.createElement("dl");
    facts.className = "university-facts-mini";
    facts.append(
      createFact(activeUniversityCopy.bachelor, item.bachelorDeadline),
      createFact(activeUniversityCopy.master, item.masterDeadline),
      createFact(activeUniversityCopy.germanPrep, item.germanPrepStatus),
      createFact(activeUniversityCopy.uniAssist, item.uniAssistStatus),
      createFact(activeUniversityCopy.lastChecked, item.lastChecked)
    );

    const schoolIntro = document.createElement("p");
    schoolIntro.textContent = item.schoolIntro;

    const cityIntro = document.createElement("p");
    cityIntro.textContent = item.cityIntro;

    const actions = document.createElement("div");
    actions.className = "university-card-actions";

    if (item.sourceUrl) {
      const source = document.createElement("a");
      source.className = "button button-secondary";
      source.href = item.sourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = activeUniversityCopy.source;
      actions.append(source);
    }

    const details = document.createElement("a");
    details.className = "button button-primary";
    details.href = item.detailUrl;
    details.textContent = activeUniversityCopy.details;
    actions.append(details);

    card.append(location, title, type, meta, facts, schoolIntro, cityIntro, actions);
    return card;
  };

  const loadUniversities = async ({ reset = false } = {}) => {
    if (reset) {
      universityPage = 1;
      setUniversityMessage(activeUniversityCopy.loading);
    }

    universityLoadMore.disabled = true;
    const response = await fetch(`/api/universities?${currentUniversityParams().toString()}`);
    if (!response.ok) throw new Error("University API request failed");
    const payload = await response.json();
    populateUniversityFilters(payload.filters);

    if (reset) universityGrid.innerHTML = "";

    if (!payload.items?.length && universityPage === 1) {
      setUniversityMessage(activeUniversityCopy.empty);
    } else {
      payload.items.forEach((item) => universityGrid.append(renderUniversityCard(item)));
    }

    hasMoreUniversities = Boolean(payload.pagination?.hasMore);
    universityLoadMore.hidden = !hasMoreUniversities;
    universityLoadMore.disabled = false;
  };

  universityFilters.addEventListener("change", () => {
    const changedFilter = document.activeElement?.matches?.("[data-filter]") ? document.activeElement : null;
    trackEvent("use_university_filter", {
      element: changedFilter || universityFilters,
      filter_name: changedFilter?.dataset.filter || "multiple",
      filter_value: changedFilter?.value || "all",
    });
    loadUniversities({ reset: true }).catch(() => {
      universityLoadMore.hidden = true;
      setUniversityMessage(activeUniversityCopy.error);
    });
  });

  universityLoadMore.addEventListener("click", () => {
    if (!hasMoreUniversities) return;
    trackEvent("load_more_universities", { page_number: universityPage + 1 });
    universityPage += 1;
    loadUniversities().catch(() => {
      universityLoadMore.hidden = true;
      setUniversityMessage(activeUniversityCopy.error);
    });
  });

  loadUniversities({ reset: true }).catch(() => {
    universityLoadMore.hidden = true;
    setUniversityMessage(activeUniversityCopy.error);
  });
}

const documentModal = document.querySelector("[data-document-modal]");
const documentFrame = document.querySelector("[data-document-frame]");
const modalPrevious = document.querySelector("[data-document-modal-prev]");
const modalNext = document.querySelector("[data-document-modal-next]");
let activeDocuments = [];
let activeDocumentIndex = 0;

const openDocumentModal = (documents, index) => {
  if (!documentModal || !documentFrame) return;
  activeDocuments = documents;
  activeDocumentIndex = index;
  documentFrame.src = activeDocuments[activeDocumentIndex].href;
  documentModal.classList.add("is-open");
  documentModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-modal-open");
  const hasMultipleDocuments = activeDocuments.length > 1;
  if (modalPrevious) modalPrevious.disabled = !hasMultipleDocuments;
  if (modalNext) modalNext.disabled = !hasMultipleDocuments;
};

const closeDocumentModal = () => {
  if (!documentModal || !documentFrame) return;
  documentModal.classList.remove("is-open");
  documentModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-modal-open");
  documentFrame.src = "";
};

const showModalDocument = (offset) => {
  if (!activeDocuments.length || !documentFrame) return;
  activeDocumentIndex = (activeDocumentIndex + offset + activeDocuments.length) % activeDocuments.length;
  documentFrame.src = activeDocuments[activeDocumentIndex].href;
};

document.querySelectorAll("[data-document-carousel]").forEach((carousel) => {
  const documents = Array.from(carousel.querySelectorAll(".document-previews a"));
  documents.forEach((documentLink, index) => {
    documentLink.addEventListener("click", (event) => {
      event.preventDefault();
      openDocumentModal(documents, index);
    });
  });
});

document.querySelectorAll("[data-document-close]").forEach((button) => {
  button.addEventListener("click", closeDocumentModal);
});

modalPrevious?.addEventListener("click", () => showModalDocument(-1));
modalNext?.addEventListener("click", () => showModalDocument(1));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDocumentModal();
});

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}
