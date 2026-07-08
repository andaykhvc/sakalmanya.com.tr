const yearElement = document.querySelector("[data-year]");

const whatsappNumber = "905452013570";
const whatsappMessage =
  "Merhaba Anday, sakalmanya.com.tr üzerinden yazıyorum. Almanya eğitim danışmanlığı veya Almanca özel ders için ön görüşme almak istiyorum. Hedefim ve mevcut Almanca seviyem hakkında bilgi paylaşabilirim.";

document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
  link.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
});

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
