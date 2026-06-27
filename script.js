const yearElement = document.querySelector("[data-year]");

const whatsappNumber = "905452013570";
const whatsappMessage =
  "Merhaba Anday, andaykahveci.de sitesinden yazıyorum. Almanya eğitim danışmanlığı için ön görüşme almak istiyorum. Hedefim ve mevcut Almanca seviyem hakkında bilgi paylaşabilirim.";

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

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}
