const yearElement = document.querySelector("[data-year]");

const whatsappNumber = "905452013570";
const whatsappMessage =
  "Merhaba Anday, sakalmanya.com.tr üzerinden yazıyorum. Almanya eğitim danışmanlığı veya Almanca özel ders için ön görüşme almak istiyorum. Hedefim ve mevcut Almanca seviyem hakkında bilgi paylaşabilirim.";

document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
  link.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
});

const floatingWhatsappMessages = {
  tr: "Merhaba, Almanya süreci hakkında bilgi almak istiyorum.",
  de: "Hallo, ich möchte Informationen zum Deutschland-Prozess erhalten.",
  en: "Hello, I would like to get information about the Germany process.",
};

const pageLanguage = document.documentElement.lang || "tr";

const mobileNavigationCopy = {
  tr: {
    menu: "Menüyü aç",
    close: "Menüyü kapat",
    navigation: "Mobil menü",
    cta: "Ücretsiz ön görüşme al",
    language: "Dil seçimi",
    links: [
      ["Ana Sayfa", "/"],
      ["Hizmetler", "/hizmetler/"],
      ["Üniversiteler", "/universite-tanitimlari/"],
      ["Almanya’da Eğitim", "/almanya-egitim-danismanligi/"],
      ["Başarılarımız", "/#basarilar"],
      ["Hakkımızda", "/#hakkimda"],
      ["Sık Sorulan Sorular", "/sss/"],
      ["İletişim", "/#iletisim"],
    ],
  },
  de: {
    menu: "Menü öffnen",
    close: "Menü schließen",
    navigation: "Mobile Navigation",
    cta: "Kostenloses Erstgespräch",
    language: "Sprachauswahl",
    links: [
      ["Startseite", "/de/"],
      ["Leistungen", "/de/leistungen/"],
      ["Universitäten", "/de/universitaeten/"],
      ["Erfolge", "/de/#erfolge"],
      ["Über mich", "/de/#ueber-mich"],
      ["FAQ", "/de/faq/"],
      ["Kontakt", "/de/#kontakt"],
    ],
  },
  en: {
    menu: "Open menu",
    close: "Close menu",
    navigation: "Mobile navigation",
    cta: "Get a free consultation",
    language: "Language selection",
    links: [
      ["Home", "/en/"],
      ["Services", "/en/services/"],
      ["Universities", "/en/universities/"],
      ["Success Stories", "/en/#success-stories"],
      ["About", "/en/#about"],
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
  const drawerSocials = document.querySelector(".site-footer .social-links")?.cloneNode(true);
  const drawerId = "mobile-navigation-drawer";
  let previouslyFocused = null;
  let closeTimer = null;

  controls.className = "mobile-nav-controls";
  languageSwitcher.classList.add("header-language-switcher");
  toggle.className = "mobile-menu-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", copy.menu);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", drawerId);
  toggle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
  controls.append(languageSwitcher, toggle);
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
    const targetPath = target.pathname.replace(/\/+$/, "/") || "/";
    const exactSection = target.hash && currentPath === targetPath && window.location.hash === target.hash;
    const routeMatch = !target.hash && (currentPath === targetPath || (targetPath !== "/" && currentPath.startsWith(targetPath)));
    link.href = href;
    link.textContent = label;
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

  if (activeLanguage) activeLanguage.setAttribute("data-active-language", "");
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

setupMobileNavigation();
setupFooterBottomRows();

const floatingWhatsapp = document.createElement("a");
floatingWhatsapp.className = "floating-whatsapp";
floatingWhatsapp.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
  floatingWhatsappMessages[pageLanguage] || floatingWhatsappMessages.tr
)}`;
floatingWhatsapp.target = "_blank";
floatingWhatsapp.rel = "noopener noreferrer";
floatingWhatsapp.setAttribute("aria-label", "WhatsApp");
floatingWhatsapp.innerHTML = `
  <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path d="M16.04 3.2A12.67 12.67 0 0 0 5.32 22.6L3.2 28.8l6.4-2.04A12.66 12.66 0 1 0 16.04 3.2Zm0 23.05c-2.1 0-4.06-.62-5.7-1.7l-.4-.26-3.77 1.2 1.23-3.64-.27-.42a10.26 10.26 0 1 1 8.91 4.82Zm5.82-7.68c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.72.16-.21.32-.82 1.03-1.01 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57-.94-.84-1.58-1.88-1.76-2.2-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.36-.26-.62-.52-.53-.72-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.08 1.31 3.29c.16.21 2.27 3.46 5.5 4.85.77.33 1.37.53 1.84.68.77.24 1.47.21 2.02.13.62-.09 1.88-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"/>
  </svg>
  <span>WhatsApp</span>
`;
document.body.appendChild(floatingWhatsapp);

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
    const params = new URLSearchParams({ page: String(universityPage), limit: "12" });
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
    loadUniversities({ reset: true }).catch(() => {
      universityLoadMore.hidden = true;
      setUniversityMessage(activeUniversityCopy.error);
    });
  });

  universityLoadMore.addEventListener("click", () => {
    if (!hasMoreUniversities) return;
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
