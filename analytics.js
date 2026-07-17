(function () {
  "use strict";

  var CONSENT_STORAGE_KEY = "sak-consent-v1";
  var GOOGLE_ADS_CONVERSION = "AW-18308696518/j_j_CMuy_swcEMaToppE";

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  var storedConsent = null;
  try {
    storedConsent = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch (_error) {
    storedConsent = null;
  }

  var analyticsGranted = storedConsent && storedConsent.analytics === true;
  var marketingGranted = storedConsent && storedConsent.marketing === true;

  var defaultConsent = {
    analytics_storage: analyticsGranted ? "granted" : "denied",
    ad_storage: marketingGranted ? "granted" : "denied",
    ad_user_data: marketingGranted ? "granted" : "denied",
    ad_personalization: marketingGranted ? "granted" : "denied",
  };
  if (!storedConsent) defaultConsent.wait_for_update = 500;
  window.gtag("consent", "default", defaultConsent);
  window.gtag("set", "ads_data_redaction", true);
  window.gtag("set", "url_passthrough", true);
  window.gtag("js", new Date());
  window.gtag("config", "G-P7JNVHYCS2", {
    linker: {
      domains: ["sakalmanya.com.tr", "deutschlaender.com.tr"],
      accept_incoming: true,
    },
  });
  window.gtag("config", "AW-18308696518");

  window.sakUpdateGoogleConsent = function (consent) {
    var analytics = consent && consent.analytics === true;
    var marketing = consent && consent.marketing === true;
    window.gtag("consent", "update", {
      analytics_storage: analytics ? "granted" : "denied",
      ad_storage: marketing ? "granted" : "denied",
      ad_user_data: marketing ? "granted" : "denied",
      ad_personalization: marketing ? "granted" : "denied",
    });
  };

  window.gtag_report_conversion = function (url, parameters) {
    var completed = false;
    var callback = function () {
      if (completed) return;
      completed = true;
      if (typeof url !== "undefined") window.location.assign(url);
    };
    var conversionParameters = Object.assign(
      {
        send_to: GOOGLE_ADS_CONVERSION,
        event_callback: callback,
        event_timeout: 2000,
        transport_type: "beacon",
      },
      parameters || {}
    );
    window.gtag("event", "conversion", conversionParameters);
    if (typeof url !== "undefined") window.setTimeout(callback, 2100);
    return false;
  };
})();
