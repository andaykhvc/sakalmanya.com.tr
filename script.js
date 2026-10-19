const yearElement = document.querySelector("[data-year]");

const pageLanguage = document.documentElement.lang || "tr";
const analyticsStorageKey = "sak-attribution-v1";
const consentStorageKey = "sak-consent-v1";
const campaignParameterNames = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid"];
const deutschlaenderOrigin = "https://deutschlaender.com.tr";
const deutschlaenderCampaign = "deutschlaender_ecosystem";
let isPilotNoticeDismissed = false;

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";

// Surfaces leave along the path they arrived by, a little faster than they came in.
const sheetExit = [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px) scale(0.97)" }];
const fadeExit = [{ opacity: 1 }, { opacity: 0 }];

const playExit = (element, keyframes, duration = 180) => {
  if (!element || typeof element.animate !== "function") return Promise.resolve();
  element.style.pointerEvents = "none";
  const animation = element.animate(reducedMotionQuery.matches ? fadeExit : keyframes, {
    duration,
    easing: easeOut,
    fill: "forwards",
  });
  // Never let a stalled frame clock (hidden tab, throttled page) keep a closed surface on screen.
  const timeout = new Promise((resolve) => window.setTimeout(resolve, duration + 120));
  return Promise.race([animation.finished.catch(() => {}), timeout])
    .then(() => () => {
      animation.cancel();
      element.style.pointerEvents = "";
    });
};

// Hide after the exit, then drop the held final frame so the next open starts clean.
const hideWithExit = (element, keyframes, duration) =>
  playExit(element, keyframes, duration).then((reset) => {
    element.hidden = true;
    reset?.();
  });

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

  // The forum lives in the footer, the drawer and the in-page callouts; the header stays short.

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

const routeTestPromptCopy = {
  tr: {
    title: "Rota testini çözmek ister misin?",
    description: "Mevcut durumuna göre Almanya’da sana en uygun eğitim rotasını yaklaşık 2 dakikada keşfedebilirsin.",
    start: "Evet, testi başlat",
    skip: "Şimdilik geç",
    languageLabel: "Dil seçimi",
    currentLanguage: "Türkçe",
  },
  de: {
    title: "Möchtest du den Routen-Test machen?",
    description: "Finde in etwa zwei Minuten heraus, welcher Bildungsweg in Deutschland am besten zu deiner aktuellen Situation passt.",
    start: "Ja, Test starten",
    skip: "Vorerst überspringen",
    languageLabel: "Sprachauswahl",
    currentLanguage: "Deutsch",
  },
  en: {
    title: "Would you like to take the route test?",
    description: "In about two minutes, you can discover which education route in Germany best fits your current situation.",
    start: "Yes, start the test",
    skip: "Maybe later",
    languageLabel: "Language selection",
    currentLanguage: "English",
  },
};

const routeTestPromptStorageKey = "sak-route-test-prompt-v1";

const hasSeenRouteTestPrompt = () => {
  try {
    return window.sessionStorage.getItem(routeTestPromptStorageKey) === "shown";
  } catch (_error) {
    return false;
  }
};

const markRouteTestPromptSeen = () => {
  try {
    window.sessionStorage.setItem(routeTestPromptStorageKey, "shown");
  } catch (_error) {
    // The prompt still works when session storage is unavailable.
  }
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
    if (isPilotNoticeDismissed) return;
    isPilotNoticeDismissed = true;
    document.removeEventListener("keydown", handleKeydown);
    document.documentElement.classList.remove("is-pilot-notice-open");
    document.body.classList.remove("is-pilot-notice-open");
    Promise.all([playExit(dialog, sheetExit), playExit(overlay, fadeExit)]).then(() => modal.remove());
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
    previouslyFocused = null;
    setupRouteTestPrompt();
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

const setupRouteTestPrompt = () => {
  const currentPath = window.location.pathname.replace(/\/+$/, "/") || "/";
  if (currentPath === "/rota-testi/" || hasSeenRouteTestPrompt() || document.querySelector("[data-route-test-prompt]")) return;

  let activeLanguage = ["tr", "de", "en"].includes(pageLanguage) ? pageLanguage : "de";
  let previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modal = document.createElement("div");
  const overlay = document.createElement("div");
  const dialog = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h2");
  const languages = document.createElement("div");
  const description = document.createElement("p");
  const actions = document.createElement("div");
  const startLink = document.createElement("a");
  const skipButton = document.createElement("button");
  const titleId = "sak-route-test-prompt-title";
  const descriptionId = "sak-route-test-prompt-description";
  const languageButtons = [];

  modal.className = "pilot-notice route-test-prompt";
  modal.setAttribute("data-route-test-prompt", "");
  overlay.className = "pilot-notice__overlay";
  overlay.setAttribute("aria-hidden", "true");
  dialog.className = "pilot-notice__dialog route-test-prompt__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.setAttribute("aria-describedby", descriptionId);
  dialog.tabIndex = -1;
  header.className = "pilot-notice__header";
  title.id = titleId;
  languages.className = "route-test-prompt__languages";
  languages.setAttribute("aria-label", "Dil seçimi");
  description.className = "route-test-prompt__description";
  description.id = descriptionId;
  actions.className = "route-test-prompt__actions";
  startLink.className = "button button-primary";
  startLink.href = "/rota-testi/";
  startLink.setAttribute("data-route-test-prompt-start", "");
  skipButton.className = "button button-secondary";
  skipButton.type = "button";
  skipButton.setAttribute("data-route-test-prompt-skip", "");

  ["tr", "de", "en"].forEach((language) => {
    const button = document.createElement("button");
    button.className = "pilot-notice__language route-test-prompt__language";
    button.type = "button";
    button.textContent = language.toUpperCase();
    button.dataset.language = language;
    button.addEventListener("click", () => {
      activeLanguage = language;
      render();
      button.focus();
    });
    languageButtons.push(button);
    languages.append(button);
  });

  header.append(title, languages);
  actions.append(startLink, skipButton);
  dialog.append(header, description, actions);
  modal.append(overlay, dialog);

  const render = () => {
    const copy = routeTestPromptCopy[activeLanguage];
    title.textContent = copy.title;
    description.textContent = copy.description;
    startLink.textContent = copy.start;
    skipButton.textContent = copy.skip;
    languages.setAttribute("aria-label", copy.languageLabel);
    dialog.lang = activeLanguage;
    languageButtons.forEach((button) => {
      const isCurrent = button.dataset.language === activeLanguage;
      button.setAttribute("aria-pressed", String(isCurrent));
      button.setAttribute("aria-label", `${routeTestPromptCopy[button.dataset.language].currentLanguage} ${copy.languageLabel.toLowerCase()}`);
    });
  };

  const focusableElements = () => [...languageButtons, startLink, skipButton].filter((element) => !element.disabled);

  let isClosing = false;
  const close = (eventName = "route_test_prompt_skip") => {
    if (isClosing) return;
    isClosing = true;
    markRouteTestPromptSeen();
    document.removeEventListener("keydown", handleKeydown);
    document.documentElement.classList.remove("is-pilot-notice-open");
    document.body.classList.remove("is-pilot-notice-open");
    Promise.all([playExit(dialog, sheetExit), playExit(overlay, fadeExit)]).then(() => modal.remove());
    if (previouslyFocused?.isConnected) previouslyFocused.focus();
    previouslyFocused = null;
    trackEvent(eventName);
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
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

  startLink.addEventListener("click", () => {
    close("route_test_prompt_start");
  });
  skipButton.addEventListener("click", () => close());

  render();
  markRouteTestPromptSeen();
  document.body.append(modal);
  document.documentElement.classList.add("is-pilot-notice-open");
  document.body.classList.add("is-pilot-notice-open");
  document.addEventListener("keydown", handleKeydown);
  trackEvent("route_test_prompt_view");
  startLink.focus();
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
    // The banner sinks back out of the bottom edge it rose from.
    if (!banner.hidden) hideWithExit(banner, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(24px)" }], 200);
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
    if (settings.hidden) return;
    hideWithExit(settings, [
      { opacity: 1, transform: "translate(-50%, -50%)" },
      { opacity: 0, transform: "translate(-50%, calc(-50% + 8px)) scale(0.97)" },
    ]);
    hideWithExit(settingsOverlay, fadeExit);
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
    if (!link) return;
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

const mobileNavigationCopy = {
  tr: {
    menu: "Menüyü aç",
    close: "Menüyü kapat",
    navigation: "Mobil menü",
    cta: "E-posta gönder",
    language: "Dil seçimi",
    links: [
      ["Ana Sayfa", "/"],
      ["Planlanan destek alanları", "/hizmetler/"],
      ["Studienkolleg Rehberi", "/studienkolleg/"],
      ["Üniversiteler", "/universite-tanitimlari/"],
      ["Dresden", "/dresden/"],
      ["Deutschländer Forum", "https://deutschlaender.com.tr/forum"],
      ["Almanya’da Eğitim", "/almanya-egitim-danismanligi/"],
      ["Rota Testi", "/rota-testi/"],
      ["Belgeler", "/#basarilar"],
      ["Hakkımızda", "/hakkimizda/"],
      ["Sık Sorulan Sorular", "/sss/"],
      ["İletişim", "/#iletisim"],
    ],
  },
  de: {
    menu: "Menü öffnen",
    close: "Menü schließen",
    navigation: "Mobile Navigation",
    cta: "E-Mail senden",
    language: "Sprachauswahl",
    links: [
      ["Startseite", "/de/"],
      ["Geplante Unterstützungsbereiche", "/de/leistungen/"],
      ["Studienkolleg", "/de/studienkolleg/"],
      ["Universitäten", "/de/universitaeten/"],
      ["Dresden", "/de/dresden/"],
      ["Deutschländer Forum", "https://deutschlaender.com.tr/forum"],
      ["Bildungsberatung", "/de/bildungsberatung/"],
      ["Routen-Test", "/rota-testi/"],
      ["Dokumente", "/de/#erfolge"],
      ["Über uns", "/de/ueber-uns/"],
      ["FAQ", "/de/faq/"],
      ["Kontakt", "/de/#kontakt"],
    ],
  },
  en: {
    menu: "Open menu",
    close: "Close menu",
    navigation: "Mobile navigation",
    cta: "Send an email",
    language: "Language selection",
    links: [
      ["Home", "/en/"],
      ["Planned support areas", "/en/services/"],
      ["Studienkolleg guide", "/en/studienkolleg/"],
      ["Universities", "/en/universities/"],
      ["Dresden", "/en/dresden/"],
      ["Deutschländer Forum", "https://deutschlaender.com.tr/forum"],
      ["Education Guidance", "/en/education-consulting/"],
      ["Route test", "/rota-testi/"],
      ["Documents", "/en/#success-stories"],
      ["About", "/en/about/"],
      ["Frequently Asked Questions", "/en/faq/"],
      ["Contact", "/en/#contact"],
    ],
  },
};

const setupRouteTestNavigation = () => {
  const currentPath = window.location.pathname.replace(/\/+$/, "/") || "/";
  const labels = { tr: "Rota Testi", de: "Routen-Test", en: "Route test" };
  document.querySelectorAll(".site-header [data-nav]").forEach((navigation) => {
    if (navigation.querySelector("[data-route-test-link], a[href='/rota-testi/']")) return;
    const link = document.createElement("a");
    link.href = "/rota-testi/";
    link.textContent = labels[pageLanguage] || labels.tr;
    link.setAttribute("data-route-test-link", "");
    if (currentPath === "/rota-testi/") link.setAttribute("aria-current", "page");
    const blogLink = Array.from(navigation.querySelectorAll("a")).find((item) => item.getAttribute("href")?.includes("/blog/"));
    if (blogLink) blogLink.before(link);
    else navigation.append(link);
  });
};

const routeTestQuestions = [
  {
    id: "target",
    prompt: "Almanya’da hangi hedef sana daha yakın?",
    options: [
      { value: "lisans", label: "Lisans eğitimi almak istiyorum.", scores: { universite: 6 } },
      { value: "master", label: "Yüksek lisans yapmak istiyorum.", scores: { master: 7 } },
      { value: "ausbildung", label: "Uygulamalı bir meslek eğitimi ve iş deneyimi istiyorum.", scores: { ausbildung: 7 } },
      { value: "dil", label: "Önce Almancamı geliştirip sonra eğitim yoluma karar vermek istiyorum.", scores: { dil: 7 } },
      { value: "kararsiz", label: "Henüz karar veremedim; seçenekleri karşılaştırmak istiyorum.", scores: { karsilastirma: 6 } },
    ],
  },
  {
    id: "education",
    prompt: "Şu anki eğitim durumun hangisine daha yakın?",
    options: [
      { value: "lise_ogrenci", label: "Lise öğrencisiyim.", scores: { universite: 1 } },
      { value: "lise_mezunu", label: "Liseden mezun oldum.", scores: { universite: 1 } },
      { value: "universite_ogrenci", label: "Üniversitede okuyorum.", scores: { universite: 1, master: 1 } },
      { value: "universite_mezunu", label: "Üniversiteden mezun oldum.", scores: { master: 2 } },
      { value: "mesleki_egitim", label: "Mesleki veya teknik bir eğitim aldım.", scores: { ausbildung: 3 } },
    ],
  },
  {
    id: "german",
    prompt: "Almanca seviyen ne durumda?",
    options: [
      { value: "almanca_yok", label: "Henüz Almanca bilmiyorum.", scores: { dil: 3 } },
      { value: "almanca_baslangic", label: "Başlangıç seviyesindeyim: A1–A2.", scores: { dil: 2 } },
      { value: "almanca_b1", label: "Orta seviyedeyim: B1.", scores: {} },
      { value: "almanca_b2", label: "İyi seviyedeyim: B2.", scores: { universite: 1, ausbildung: 1 } },
      { value: "almanca_c1", label: "İleri seviyedeyim: C1 veya üzeri.", scores: { universite: 1, master: 1 } },
      { value: "almanca_belirsiz", label: "Seviyemi bilmiyorum.", scores: { dil: 1 } },
    ],
  },
  {
    id: "start",
    prompt: "Eğitime ne zaman başlamayı düşünüyorsun?",
    options: [
      { value: "baslangic_6ay", label: "Mümkünse önümüzdeki 6 ay içinde.", scores: { universite: 1, master: 1, ausbildung: 1 } },
      { value: "baslangic_12ay", label: "6–12 ay içinde.", scores: { universite: 1, master: 1, ausbildung: 1 } },
      { value: "baslangic_uzun", label: "Bir yıldan daha uzun bir hazırlık sürecim olabilir.", scores: { dil: 2 } },
      { value: "baslangic_belirsiz", label: "Henüz tarih belirlemedim.", scores: {} },
    ],
  },
  {
    id: "budget",
    prompt: "Eğitim ve yaşam bütçen konusunda kendini nasıl değerlendiriyorsun?",
    options: [
      { value: "butce_sinirli", label: "Bütçem sınırlı; maliyeti düşük seçenekleri araştırmam gerekiyor.", scores: {} },
      { value: "butce_orta", label: "Orta düzeyde bir bütçe planlayabilirim.", scores: {} },
      { value: "butce_genis", label: "Daha geniş seçenekleri değerlendirebilecek bir bütçem var.", scores: {} },
      { value: "butce_belirsiz", label: "Henüz gerçekçi bütçemi hesaplamadım.", scores: {} },
    ],
  },
  {
    id: "style",
    prompt: "Nasıl bir eğitim deneyimi sana daha uygun?",
    options: [
      { value: "akademik", label: "Akademik, teorik ve araştırma odaklı bir eğitim.", scores: { universite: 3, master: 2 } },
      { value: "uygulamali", label: "Uygulamalı, mesleğe ve sektöre yakın bir eğitim.", scores: { ausbildung: 3 } },
      { value: "calisma_deneyimi", label: "Eğitim sırasında çalışma ve iş deneyimi kazanmak.", scores: { ausbildung: 3 } },
      { value: "hazirlik", label: "Önce Almanca ve hazırlık sürecine odaklanmak.", scores: { dil: 4 } },
      { value: "karsilastirma", label: "Emin değilim; farklarını görmek istiyorum.", scores: { karsilastirma: 2 } },
    ],
  },
  {
    id: "interest",
    prompt: "Hangi alan veya alanlar ilgini çekiyor?",
    options: [
      { value: "muhendislik", label: "Mühendislik, bilgisayar veya teknik alanlar.", scores: { universite: 1, master: 1 } },
      { value: "isletme_sosyal", label: "İşletme, ekonomi veya sosyal bilimler.", scores: { universite: 1, master: 1 } },
      { value: "saglik_egitim", label: "Sağlık, eğitim veya insan odaklı alanlar.", scores: { universite: 1, master: 1 } },
      { value: "tasarim_medya", label: "Tasarım, medya veya yaratıcı alanlar.", scores: { universite: 1, master: 1 } },
      { value: "teknik_meslek", label: "Teknik meslekler ve uygulamalı işler.", scores: { ausbildung: 2 } },
      { value: "bolum_belirsiz", label: "Henüz bölüm seçmedim.", scores: { karsilastirma: 1 } },
    ],
  },
  {
    id: "support",
    prompt: "Şu anda en çok hangi konuda desteğe ihtiyacın var?",
    options: [
      { value: "okul_secimi", label: "Bana uygun ülke/şehir/okul seçeneklerini anlamak.", scores: { universite: 1 } },
      { value: "dil_plani", label: "Almanca seviyemi ve hazırlık yolunu planlamak.", scores: { dil: 2 } },
      { value: "basvuru", label: "Üniversite veya Ausbildung başvuru adımlarını öğrenmek.", scores: { universite: 1, master: 1, ausbildung: 1 } },
      { value: "belgeler_takvim", label: "Belgelerimi ve başvuru takvimimi düzenlemek.", scores: { universite: 1, master: 1, ausbildung: 1 } },
      { value: "vize_yerlesim", label: "Vize, bütçe ve Almanya’ya ilk yerleşim sürecini anlamak.", scores: { ausbildung: 1, dil: 1 } },
      { value: "baslangic_destegi", label: "Nereden başlayacağımı bilmiyorum.", scores: { karsilastirma: 2 } },
    ],
  },
];

const routeTestResults = {
  universite: {
    title: "Sana en yakın rota: Almanya’da üniversite",
    copy: "Akademik hedeflerin ve mevcut eğitim geçmişin, Almanya’daki lisans veya ilgili üniversite seçeneklerini araştırmayı mantıklı bir başlangıç noktası yapıyor.",
    next: "Bölüm seçimi, diploma uygunluğu, eğitim dili, başvuru takvimi ve bütçeyi birlikte netleştir.",
    link: "/almanya-universite-basvurusu/",
  },
  master: {
    title: "Sana en yakın rota: Almanya’da yüksek lisans",
    copy: "Lisans geçmişin ve uzmanlaşma hedefin, Almanya’daki yüksek lisans programlarını incelemeyi öne çıkarıyor.",
    next: "Lisans bölümün, transkriptin, dil seviyen ve hedeflediğin alan üzerinden program seçeneklerini daralt.",
    link: "/almanya-yuksek-lisans-sartlari/",
  },
  ausbildung: {
    title: "Sana en yakın rota: Ausbildung",
    copy: "Uygulamalı eğitim, meslek edinme ve iş deneyimi kazanma hedefin Ausbildung seçeneklerini araştırmayı mantıklı hale getiriyor.",
    next: "İlgi alanını, eğitim geçmişini, Almanca seviyeni ve başvuru takvimini seçtiğin meslekle birlikte değerlendir.",
    link: "/almanya-ausbildung-danismanligi/",
  },
  dil: {
    title: "Sana en yakın rota: Almanca ve hazırlık planı",
    copy: "Şu an en doğru ilk adım, doğrudan okul başvurusundan önce Almanca seviyeni ve hazırlık ihtiyacını netleştirmek olabilir.",
    next: "Mevcut seviyeni ölçüp hedeflediğin eğitim rotasına göre gerçekçi bir dil ve hazırlık takvimi çıkar.",
    link: "/almanca-ozel-ders/",
  },
  karsilastirma: {
    title: "Sana en yakın rota: Önce seçenekleri karşılaştırmak",
    copy: "Şu anda tek bir eğitim yoluna bağlanmak yerine üniversite, yüksek lisans, Ausbildung ve hazırlık seçeneklerini karşılaştırman daha doğru görünüyor.",
    next: "Eğitim geçmişin, dil seviyen, bütçen, başlama tarihin ve uzun vadeli hedeflerin üzerinden seçenekleri birlikte sırala.",
    link: "/almanya-egitim-danismanligi/",
  },
};

const setupRouteTest = () => {
  const root = document.querySelector("[data-route-test]");
  if (!root) return;

  const form = root.querySelector("[data-route-test-form]");
  const questionElement = root.querySelector("[data-route-test-question]");
  const statusElement = root.querySelector("[data-route-test-status]");
  const backButton = root.querySelector("[data-route-test-back]");
  const nextButton = root.querySelector("[data-route-test-continue]");
  const progress = root.querySelector(".route-test-progress");
  const progressLabel = root.querySelector("[data-route-test-progress-label]");
  const progressPercent = root.querySelector("[data-route-test-progress-percent]");
  const progressBar = root.querySelector("[data-route-test-progress-bar]");
  const result = root.querySelector("[data-route-test-result]");
  const resultTitle = root.querySelector("[data-route-test-result-title]");
  const resultCopy = root.querySelector("[data-route-test-result-copy]");
  const resultSummary = root.querySelector("[data-route-test-summary]");
  const resultNext = root.querySelector("[data-route-test-next]");
  const resultLink = root.querySelector("[data-route-test-route-link]");
  const emailLink = root.querySelector("[data-route-test-email]");
  const restartButton = root.querySelector("[data-route-test-restart]");
  let currentIndex = 0;
  const answers = {};

  const getSelectedOption = (question) => question.options.find((option) => option.value === answers[question.id]);

  let renderedIndex = null;

  const renderQuestion = () => {
    const question = routeTestQuestions[currentIndex];
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    const optionList = document.createElement("div");

    legend.textContent = question.prompt;
    optionList.className = "route-test-option-list";
    question.options.forEach((option) => {
      const optionId = `route-test-${question.id}-${option.value}`;
      const label = document.createElement("label");
      const input = document.createElement("input");
      const card = document.createElement("span");
      label.className = "route-test-option";
      label.htmlFor = optionId;
      input.id = optionId;
      input.type = "radio";
      input.name = "route-test-answer";
      input.value = option.value;
      input.checked = option.value === answers[question.id];
      card.className = "route-test-option-card";
      card.textContent = option.label;
      label.append(input, card);
      optionList.append(label);
    });
    fieldset.append(legend, optionList);
    questionElement.replaceChildren(fieldset);
    // The new question arrives from the side you are moving towards.
    if (renderedIndex !== null && renderedIndex !== currentIndex && typeof fieldset.animate === "function") {
      const direction = currentIndex > renderedIndex ? 1 : -1;
      fieldset.animate(
        reducedMotionQuery.matches
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, transform: `translateX(${direction * 16}px)` }, { opacity: 1, transform: "none" }],
        { duration: 240, easing: easeOut },
      );
    }
    renderedIndex = currentIndex;
    statusElement.textContent = "";
    progressLabel.textContent = `${currentIndex + 1} / ${routeTestQuestions.length}`;
    const percent = Math.round(((currentIndex + 1) / routeTestQuestions.length) * 100);
    progressPercent.textContent = `%${percent}`;
    progressBar.style.transform = `scaleX(${percent / 100})`;
    backButton.disabled = currentIndex === 0;
    nextButton.textContent = currentIndex === routeTestQuestions.length - 1 ? "Sonucu gör" : "Devam et";
  };

  const calculateResult = () => {
    const scores = { universite: 0, master: 0, ausbildung: 0, dil: 0, karsilastirma: 0 };
    routeTestQuestions.forEach((question) => {
      Object.entries(getSelectedOption(question)?.scores || {}).forEach(([route, points]) => {
        scores[route] += points;
      });
    });
    return ["master", "ausbildung", "dil", "universite", "karsilastirma"].reduce(
      (best, route) => (scores[route] > scores[best] ? route : best),
      "karsilastirma",
    );
  };

  const renderResult = () => {
    const resultKey = calculateResult();
    const resultCopyData = routeTestResults[resultKey];
    const summaryIds = ["target", "education", "german", "start", "budget", "interest"];
    resultTitle.textContent = resultCopyData.title;
    resultCopy.textContent = resultCopyData.copy;
    resultNext.textContent = resultCopyData.next;
    resultLink.href = resultCopyData.link;
    resultSummary.replaceChildren(
      ...summaryIds.map((id) => {
        const question = routeTestQuestions.find((item) => item.id === id);
        const item = document.createElement("li");
        item.textContent = getSelectedOption(question)?.label || "Belirtilmedi";
        return item;
      }),
    );
    emailLink.href = "mailto:iletisim@andaykahveci.com?subject=Almanya%20Rota%20Testi";
    form.hidden = true;
    progress.hidden = true;
    result.hidden = false;
    renderedIndex = null;
    // A rare moment: let the result settle in, answers following one by one.
    if (typeof result.animate === "function") {
      const reduced = reducedMotionQuery.matches;
      result.animate(
        reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(12px) scale(0.98)" }, { opacity: 1, transform: "none" }],
        { duration: reduced ? 200 : 420, easing: easeOut },
      );
      if (!reduced) {
        resultSummary.querySelectorAll("li").forEach((item, index) => {
          item.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
            duration: 260,
            delay: 180 + index * 40,
            easing: easeOut,
            fill: "backwards",
          });
        });
      }
    }
    trackEvent("route_test_complete", { route_result: resultKey, route_test_answers: Object.keys(answers).length });
  };

  nextButton.addEventListener("click", () => {
    const question = routeTestQuestions[currentIndex];
    const selected = root.querySelector("input[name='route-test-answer']:checked");
    if (!selected) {
      statusElement.textContent = "Devam etmek için seçeneklerden birini seç.";
      return;
    }
    answers[question.id] = selected.value;
    if (currentIndex === routeTestQuestions.length - 1) {
      renderResult();
      return;
    }
    currentIndex += 1;
    renderQuestion();
  });

  backButton.addEventListener("click", () => {
    if (currentIndex === 0) return;
    currentIndex -= 1;
    renderQuestion();
  });

  restartButton.addEventListener("click", () => {
    currentIndex = 0;
    routeTestQuestions.forEach((question) => delete answers[question.id]);
    form.hidden = false;
    progress.hidden = false;
    result.hidden = true;
    renderQuestion();
    root.scrollIntoView({ behavior: reducedMotionQuery.matches ? "auto" : "smooth", block: "start" });
    trackEvent("route_test_restart");
  });

  trackEvent("route_test_start");
  renderQuestion();
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
  cta.href = "mailto:iletisim@andaykahveci.com?subject=Almanya%20Hakkinda%20Bilgi";
  cta.textContent = copy.cta;

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
    if (window.innerWidth >= 1180 && toggle.getAttribute("aria-expanded") === "true") setOpen(false);
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

const setupContactNavigation = () => {
  const contacts = {
    tr: ["İletişim", "/#iletisim"],
    de: ["Kontakt", "/de/#kontakt"],
    en: ["Contact", "/en/#contact"],
  };
  const [label, href] = contacts[pageLanguage] || contacts.tr;
  document.querySelectorAll(".site-header [data-nav]").forEach((navigation) => {
    if (navigation.querySelector("[data-contact-nav]")) return;
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    link.setAttribute("data-contact-nav", "");
    navigation.append(link);
  });
};

setupContactNavigation();
setupConsentManager();
setupPilotNotice();
setupAboutNavigation();
setupRouteTestNavigation();
setupMobileNavigation();
setupFooterBottomRows();
setupDresdenNavigation();
setupMasterNavigation();
setupDeutschlaenderLinks();
setupAnalyticsTracking();
setupRouteTest();

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

    const createLogoFallback = () => {
      const fallback = document.createElement("div");
      const initials = String(item.name || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      fallback.className = "university-card-logo university-card-logo-fallback";
      fallback.textContent = initials || "UNI";
      fallback.setAttribute("aria-hidden", "true");
      return fallback;
    };

    if (item.logoPath) {
      const logo = document.createElement("img");
      logo.className = "university-card-logo";
      logo.src = item.logoPath;
      logo.alt = "";
      logo.setAttribute("aria-hidden", "true");
      logo.loading = "lazy";
      logo.decoding = "async";
      logo.addEventListener("error", () => {
        logo.replaceWith(createLogoFallback());
      }, { once: true });
      card.classList.add("has-logo");
      card.append(logo);
    } else {
      card.classList.add("has-logo");
      card.append(createLogoFallback());
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
  documentModalExit += 1;
  documentModal.style.pointerEvents = "";
  documentModal.querySelectorAll(".document-modal__dialog, .document-modal__backdrop").forEach((element) => {
    // Reopened mid-exit: run the exit backwards from where it is instead of jumping.
    element.getAnimations().forEach((animation) => {
      if (typeof CSSAnimation !== "undefined" && animation instanceof CSSAnimation) return;
      if (animation.playState === "running") {
        animation.reverse();
        animation.finished.then(() => animation.cancel()).catch(() => {});
      } else {
        animation.cancel();
      }
    });
    element.style.pointerEvents = "";
  });
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

let documentModalExit = 0;

const closeDocumentModal = () => {
  if (!documentModal || !documentFrame || !documentModal.classList.contains("is-open")) return;
  const exit = ++documentModalExit;
  // Clicks pass through a closing viewer, so the page answers at once.
  documentModal.style.pointerEvents = "none";
  documentModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-modal-open");
  Promise.all([
    playExit(documentModal.querySelector(".document-modal__dialog"), sheetExit, 200),
    playExit(documentModal.querySelector(".document-modal__backdrop"), fadeExit, 200),
  ]).then((resets) => {
    // A reopen during the exit wins; leave that one alone.
    if (exit === documentModalExit) {
      documentModal.classList.remove("is-open");
      documentFrame.src = "";
    }
    resets.forEach((reset) => reset?.());
  });
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


// Presentation layer: header scroll edge and the home document deck.

const setupHeaderScrollEdge = () => {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    header.classList.toggle("is-scrolled", window.scrollY > 4);
  };
  window.addEventListener("scroll", () => {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  update();
};

// Springs described the way Apple does: damping ratio + response (seconds).
const springStep = (prop, dt) => {
  const { damping, response } = prop.config;
  const stiffness = (2 * Math.PI / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;
  const force = -stiffness * (prop.value - prop.target) - friction * prop.velocity;
  prop.velocity += force * dt;
  prop.value += prop.velocity * dt;
  if (Math.abs(prop.value - prop.target) < 0.01 && Math.abs(prop.velocity) < 0.01) {
    prop.value = prop.target;
    prop.velocity = 0;
    return true;
  }
  return false;
};

// Where a flick would come to rest (scroll-view deceleration).
const projectMomentum = (velocity, decelerationRate = 0.998) =>
  ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);

const setupDocumentDeck = () => {
  const stack = document.querySelector("[data-doc-stack]");
  const deck = stack?.querySelector("[data-doc-deck]");
  if (!stack || !deck) return;

  const cards = Array.from(deck.querySelectorAll(".doc-card"));
  if (cards.length < 2) return;
  const titleOut = stack.querySelector("[data-doc-title-out]");
  const metaOut = stack.querySelector("[data-doc-meta-out]");
  const previousButton = stack.querySelector("[data-doc-prev]");
  const nextButton = stack.querySelector("[data-doc-next]");
  const visibleDepth = 4;
  const fan = [
    { x: 0, y: 0, r: 0, s: 1 },
    { x: 16, y: -12, r: 3.2, s: 0.965 },
    { x: -18, y: -22, r: -4.2, s: 0.93 },
    { x: 12, y: -30, r: 6, s: 0.9 },
  ];
  const settle = { damping: 1, response: 0.42 };
  const thrown = { damping: 0.82, response: 0.45 };

  const states = new Map();
  let order = cards.slice();
  let running = false;
  let lastTime = 0;

  const deckWidth = () => deck.getBoundingClientRect().width || 320;
  const unit = () => deckWidth() / 360;

  cards.forEach((card) => {
    const make = (value = 0) => ({ value, velocity: 0, target: value, config: settle });
    states.set(card, { x: make(), y: make(), r: make(), s: make(1), flingDirection: 0, flingLayer: 0 });
    card.tabIndex = -1;
    card.addEventListener("click", (event) => event.preventDefault());
    card.addEventListener("dragstart", (event) => event.preventDefault());
  });

  const render = (card) => {
    const state = states.get(card);
    card.style.transform =
      `translate3d(${state.x.value.toFixed(2)}px, ${state.y.value.toFixed(2)}px, 0) ` +
      `rotate(${state.r.value.toFixed(3)}deg) scale(${state.s.value.toFixed(4)})`;
  };

  const layout = (config = settle) => {
    const scale = unit();
    order.forEach((card, depth) => {
      const state = states.get(card);
      const slot = fan[Math.min(depth, visibleDepth - 1)];
      card.dataset.depth = String(depth);
      card.setAttribute("aria-hidden", depth === 0 ? "false" : "true");
      // A card in flight stays above the deck until it clears the edge.
      if (state.flingDirection) {
        card.style.zIndex = String(order.length + state.flingLayer);
        card.style.opacity = "1";
        return;
      }
      card.style.zIndex = String(order.length - depth);
      card.style.opacity = depth < visibleDepth ? "1" : "0";
      if (state.dragging) return;
      state.x.target = slot.x * scale;
      state.y.target = slot.y * scale;
      state.r.target = slot.r;
      state.s.target = slot.s;
      ["x", "y", "r", "s"].forEach((key) => { state[key].config = config; });
    });
    const top = order[0];
    const index = cards.indexOf(top);
    if (titleOut) titleOut.textContent = top.dataset.docTitle || "";
    if (metaOut) metaOut.textContent = `${top.dataset.docKind || ""}, ${index + 1} / ${cards.length}`;
  };

  const jumpToTargets = () => {
    states.forEach((state, card) => {
      ["x", "y", "r", "s"].forEach((key) => {
        state[key].value = state[key].target;
        state[key].velocity = 0;
      });
      render(card);
    });
  };

  const tick = (time) => {
    const dt = Math.min(0.032, (time - lastTime) / 1000 || 0.016);
    lastTime = time;
    let busy = false;
    const width = deckWidth();
    states.forEach((state, card) => {
      if (state.dragging) return;
      // Waiting for its turn in the opening fan-out.
      if (state.holdUntil && time < state.holdUntil) {
        busy = true;
        return;
      }
      state.holdUntil = 0;
      // Integrate in small steps so stiff springs stay stable on slow frames.
      const steps = Math.ceil(dt / 0.004);
      let settled = true;
      for (let i = 0; i < steps; i += 1) {
        settled = ["x", "y", "r", "s"].map((key) => springStep(state[key], dt / steps)).every(Boolean);
      }
      // A thrown card slides back under the deck once it clears the edge.
      if (state.flingDirection && Math.abs(state.x.value) > width * 0.82) {
        state.flingDirection = 0;
        layout(thrown);
        settled = false;
      }
      if (!settled) busy = true;
      render(card);
    });
    if (busy) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  };

  const run = () => {
    if (reducedMotionQuery.matches) {
      states.forEach((state) => { state.flingDirection = 0; });
      layout();
      jumpToTargets();
      return;
    }
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(tick);
  };

  let flingLayer = 0;

  // The deck order changes the moment a card is thrown, so the caption
  // answers at once and repeated presses keep advancing.
  const throwTop = (direction, velocity = 0) => {
    const top = order[0];
    const state = states.get(top);
    order = order.slice(1).concat(top);
    if (reducedMotionQuery.matches) {
      layout();
      jumpToTargets();
      return;
    }
    flingLayer += 1;
    state.flingLayer = flingLayer;
    state.flingDirection = direction;
    state.x.target = direction * deckWidth() * 1.2;
    state.x.velocity = velocity || direction * 1800;
    state.x.config = { damping: 1, response: 0.32 };
    state.r.target = direction * 14;
    state.r.config = { damping: 1, response: 0.32 };
    layout();
    run();
  };

  const bringBack = () => {
    const last = order[order.length - 1];
    const state = states.get(last);
    order = [last].concat(order.slice(0, -1));
    if (state.flingDirection) {
      // Caught mid-flight: reverse from where it is, keeping its velocity.
      state.flingDirection = 0;
    } else if (!reducedMotionQuery.matches) {
      // Enter along the same path cards leave by: from the left.
      state.x.value = -deckWidth() * 1.15;
      state.x.velocity = 0;
      state.r.value = -14;
      state.y.value = 0;
    }
    layout();
    if (reducedMotionQuery.matches) jumpToTargets();
    run();
  };

  // Direct manipulation of the top card.
  let pointer = null;

  deck.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const top = order[0];
    if (!event.target.closest(".doc-card") || event.target.closest(".doc-card") !== top) return;
    const state = states.get(top);
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: state.x.value,
      originY: state.y.value,
      history: [{ x: event.clientX, t: event.timeStamp }],
      dragging: false,
    };
  });

  deck.addEventListener("pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (!pointer.dragging) {
      if (Math.hypot(dx, dy) < 8) return;
      // Vertical intent belongs to page scrolling.
      if (Math.abs(dy) > Math.abs(dx) && event.pointerType !== "mouse") {
        pointer = null;
        return;
      }
      pointer.dragging = true;
      deck.setPointerCapture(event.pointerId);
      const state = states.get(order[0]);
      state.dragging = true;
      order[0].classList.add("is-dragging");
    }
    const top = order[0];
    const state = states.get(top);
    state.x.value = pointer.originX + dx;
    state.y.value = pointer.originY + dy * 0.25;
    state.r.value = (pointer.originX + dx) * 0.05;
    state.s.value = 1;
    pointer.history.push({ x: event.clientX, t: event.timeStamp });
    if (pointer.history.length > 6) pointer.history.shift();
    render(top);
  });

  const endPointer = (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const wasDragging = pointer.dragging;
    const history = pointer.history;
    pointer = null;
    const top = order[0];
    const state = states.get(top);
    top.classList.remove("is-dragging");

    if (!wasDragging) {
      if (event.type === "pointerup") openDocumentModal(order, 0);
      return;
    }

    state.dragging = false;
    const first = history[0];
    const last = history[history.length - 1];
    const elapsed = Math.max(1, last.t - first.t);
    const velocity = ((last.x - first.x) / elapsed) * 1000;
    const projected = state.x.value + projectMomentum(velocity);

    if (Math.abs(projected) > deckWidth() * 0.5) {
      throwTop(Math.sign(projected), velocity);
      return;
    }
    // Not far enough: hand the finger's velocity to the return spring.
    state.x.velocity = velocity;
    ["x", "y", "r", "s"].forEach((key) => { state[key].config = thrown; });
    layout(thrown);
    run();
  };

  deck.addEventListener("pointerup", endPointer);
  deck.addEventListener("pointercancel", endPointer);

  deck.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      throwTop(-1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      bringBack();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDocumentModal(order, 0);
    }
  });

  nextButton?.addEventListener("click", () => throwTop(-1));
  previousButton?.addEventListener("click", bringBack);

  window.addEventListener("resize", () => {
    layout();
    jumpToTargets();
  });

  layout();
  jumpToTargets();
  stack.classList.add("is-live");

  // Once per session, the deck opens from a neat pile into its fan so it reads as a stack you can leaf through.
  const introKey = "sak-deck-intro-v1";
  let introSeen = true;
  try {
    introSeen = window.sessionStorage.getItem(introKey) === "1";
  } catch (_error) {
    // Without storage the deck simply starts fanned out.
  }
  if (introSeen || reducedMotionQuery.matches || !("IntersectionObserver" in window)) return;

  states.forEach((state, card) => {
    state.x.value = 0;
    state.y.value = 0;
    state.r.value = 0;
    state.s.value = 1;
    render(card);
  });

  let visible = false;
  let started = false;
  const cancelIntro = () => {
    started = true;
    states.forEach((state) => { state.holdUntil = 0; });
  };
  const startIntro = () => {
    if (started || !visible || document.body.classList.contains("is-pilot-notice-open")) return;
    started = true;
    try {
      window.sessionStorage.setItem(introKey, "1");
    } catch (_error) {
      // Not remembering only means the fan-out may play again.
    }
    const now = performance.now();
    order.forEach((card, depth) => {
      const state = states.get(card);
      ["x", "y", "r", "s"].forEach((key) => { state[key].config = { damping: 1, response: 0.5 }; });
      state.holdUntil = now + 120 + depth * 70;
    });
    run();
  };

  new IntersectionObserver((entries, observer) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) {
      startIntro();
      if (started) observer.disconnect();
    }
  }, { threshold: 0.45 }).observe(deck);

  new MutationObserver((records, observer) => {
    startIntro();
    if (started) observer.disconnect();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // Touching the deck first means the person is already ahead of the hint.
  const skipIntro = () => {
    if (started) return;
    cancelIntro();
    layout();
    jumpToTargets();
  };
  stack.addEventListener("pointerdown", skipIntro, { once: true, capture: true });
  stack.addEventListener("keydown", skipIntro, { once: true, capture: true });
};

setupHeaderScrollEdge();
setupDocumentDeck();
