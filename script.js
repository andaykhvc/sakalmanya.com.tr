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
const universityCards = Array.from(document.querySelectorAll("[data-university-grid] .university-card"));

if (universityFilters && universityCards.length) {
  const filterCards = () => {
    const values = Object.fromEntries(
      Array.from(universityFilters.querySelectorAll("[data-filter]")).map((field) => [field.dataset.filter, field.value])
    );

    universityCards.forEach((card) => {
      const matchesState = !values.state || card.dataset.state === values.state;
      const matchesType = !values.type || card.dataset.type === values.type;
      const matchesGermanCourse = !values.germanCourse || card.dataset.germanCourse === values.germanCourse;
      const matchesLevel = !values.level || card.dataset.level?.includes(values.level);
      const matchesUniAssist = !values.uniAssist || card.dataset.uniAssist === values.uniAssist;

      card.hidden = !(matchesState && matchesType && matchesGermanCourse && matchesLevel && matchesUniAssist);
    });
  };

  universityFilters.addEventListener("change", filterCards);
  filterCards();
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
