/* The native form remains usable when JavaScript is unavailable. */
(() => {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const copy = {
    tr: {
      sending: "Gönderiliyor…",
      success: "Talebin alındı. Sana e-posta ile dönüş yapacağız.",
      error: "Mesaj gönderilemedi. Bilgilerin burada duruyor; tekrar deneyebilir veya aşağıdaki adrese e-posta gönderebilirsin.",
      pending: "Form şu anda talep kabul edemiyor. Lütfen aşağıdaki e-posta adresinden bize ulaş.",
      empty: "Lütfen bu alanı doldur.",
    },
    de: {
      sending: "Wird gesendet…",
      success: "Deine Anfrage wurde angenommen. Wir melden uns per E-Mail bei dir.",
      error: "Die Nachricht konnte nicht gesendet werden. Deine Angaben bleiben erhalten. Versuche es erneut oder nutze die E-Mail-Adresse unten.",
      pending: "Das Formular kann derzeit keine Anfragen annehmen. Bitte nutze die E-Mail-Adresse unten.",
      empty: "Bitte fülle dieses Feld aus.",
    },
    en: {
      sending: "Sending…",
      success: "Your enquiry has been accepted. We will reply by email.",
      error: "Your message could not be sent. Your information is still here. Try again or use the email address below.",
      pending: "The form cannot accept enquiries right now. Please use the email address below.",
      empty: "Please fill in this field.",
    },
  }[document.documentElement.lang] || null;
  if (!copy || !window.fetch || !window.AbortController) return;

  const fields = form.querySelector("fieldset");
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector("[data-contact-status]");
  const reset = form.querySelector("[data-contact-reset]");
  const submitLabel = submit.innerHTML;
  let submitting = false;

  form.querySelectorAll('input[required]:not([type="checkbox"]), textarea[required]').forEach((input) => {
    input.addEventListener("input", () => input.setCustomValidity(input.value.trim() ? "" : copy.empty));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    const values = new FormData(form);
    for (const name of ["name", "email", "message"]) {
      const input = form.elements.namedItem(name);
      input.value = input.value.trim();
      input.setCustomValidity(input.value ? "" : copy.empty);
      values.set(name, input.value);
    }
    if (!form.reportValidity()) return;
    if (values.get("_honey")) {
      status.textContent = copy.error;
      return;
    }

    // Never include query parameters, attribution, or test answers in the submission.
    values.set("_url", `${location.origin}${location.pathname}`);
    values.set("_replyto", values.get("email"));
    submitting = true;
    form.setAttribute("aria-busy", "true");
    fields.disabled = true;
    submit.textContent = copy.sending;
    status.textContent = copy.sending;
    status.dataset.state = "sending";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch("https://formsubmit.co/ajax/iletisim@andaykahveci.com", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(values)),
        credentials: "omit",
        referrerPolicy: "strict-origin",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Submission rejected");
      const result = await response.json();
      // An activation response is not a delivered enquiry.
      if (/activat|confirm.{0,30}email|verify.{0,30}email/i.test(String(result.message || ""))) {
        status.textContent = copy.pending;
        status.dataset.state = "error";
        return;
      }
      if (result.success !== true && result.success !== "true") throw new Error("Submission not accepted");
      form.reset();
      fields.hidden = true;
      reset.hidden = false;
      status.textContent = copy.success;
      status.dataset.state = "success";
    } catch (_error) {
      status.textContent = copy.error;
      status.dataset.state = "error";
    } finally {
      window.clearTimeout(timeout);
      fields.disabled = false;
      submit.innerHTML = submitLabel;
      submitting = false;
      form.removeAttribute("aria-busy");
    }
  });

  reset.addEventListener("click", () => {
    fields.hidden = false;
    reset.hidden = true;
    status.textContent = "";
    delete status.dataset.state;
    form.elements.namedItem("name").focus();
  });
})();
