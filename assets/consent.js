/* Dressar Ireland — GDPR consent banner.
   Wraps Shopify's Customer Privacy API so tracking is off until the visitor opts in.
   Reference: https://shopify.dev/docs/api/customer-privacy */
(function () {
  'use strict';

  var KEY = 'dressar_consent_v1';
  var banner = document.querySelector('[data-cookie-banner]');
  if (!banner) return;

  function stored() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function persist(value) {
    try { window.localStorage.setItem(KEY, value); } catch (e) { /* private mode */ }
  }

  function apply(granted) {
    var api = window.Shopify && window.Shopify.customerPrivacy;
    if (api && typeof api.setTrackingConsent === 'function') {
      api.setTrackingConsent(
        {
          analytics: granted,
          marketing: granted,
          preferences: granted,
          sale_of_data: granted
        },
        function () { /* consent recorded by Shopify */ }
      );
    }
  }

  function hide() {
    banner.hidden = true;
  }

  function decide(granted) {
    persist(granted ? 'granted' : 'denied');
    apply(granted);
    hide();
  }

  banner.addEventListener('click', function (e) {
    if (e.target.closest('[data-consent-accept]')) decide(true);
    if (e.target.closest('[data-consent-decline]')) decide(false);
  });

  var prior = stored();
  if (prior === 'granted') { apply(true); return; }
  if (prior === 'denied') { apply(false); return; }

  /* Only prompt visitors whose region requires it; Shopify tells us. */
  function maybeShow() {
    var api = window.Shopify && window.Shopify.customerPrivacy;
    var required = true;
    try {
      if (api && typeof api.shouldShowBanner === 'function') required = api.shouldShowBanner();
    } catch (e) { required = true; }
    if (required) banner.hidden = false;
  }

  if (window.Shopify && window.Shopify.loadFeatures) {
    window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }], function (err) {
      if (err) { banner.hidden = false; return; }
      maybeShow();
    });
  } else {
    banner.hidden = false;
  }
})();
