/* Dressar consent.
   Wraps Shopify's Customer Privacy API. Non-essential categories stay off until
   the visitor opts in; nothing here writes or reads cookies directly. */
(function () {
  'use strict';

  var banner = document.querySelector('[data-dr-consent]');
  if (!banner) return;

  var panel = banner.querySelector('[data-dr-consent-panel]');
  var openers = document.querySelectorAll('[data-dr-consent-open]');

  function api() {
    return window.Shopify && window.Shopify.customerPrivacy;
  }

  function boxes() {
    return Array.prototype.slice.call(banner.querySelectorAll('[data-dr-category]'));
  }

  function apply(consent, then) {
    var privacy = api();
    if (!privacy || typeof privacy.setTrackingConsent !== 'function') {
      if (then) then();
      return;
    }
    privacy.setTrackingConsent(consent, function () {
      if (then) then();
    });
  }

  function syncSave() {
    var save = banner.querySelector('[data-dr-save]');
    if (save) save.hidden = !panel || panel.hidden;
  }

  function hide() {
    banner.hidden = true;
    if (panel) panel.hidden = true;
    syncSave();
  }

  function show() {
    banner.hidden = false;
  }

  function acceptAll() {
    apply({ analytics: true, marketing: true, preferences: true, sale_of_data: true }, hide);
  }

  function essentialOnly() {
    apply({ analytics: false, marketing: false, preferences: false, sale_of_data: false }, hide);
  }

  function saveChoices() {
    var chosen = { analytics: false, marketing: false, preferences: false, sale_of_data: false };
    boxes().forEach(function (box) {
      var key = box.getAttribute('data-dr-category');
      if (key === 'analytics') chosen.analytics = box.checked;
      if (key === 'marketing') { chosen.marketing = box.checked; chosen.sale_of_data = box.checked; }
      if (key === 'preferences') chosen.preferences = box.checked;
    });
    apply(chosen, hide);
  }

  banner.addEventListener('click', function (e) {
    if (e.target.closest('[data-dr-accept]')) { e.preventDefault(); acceptAll(); }
    else if (e.target.closest('[data-dr-reject]')) { e.preventDefault(); essentialOnly(); }
    else if (e.target.closest('[data-dr-save]')) { e.preventDefault(); saveChoices(); }
    else if (e.target.closest('[data-dr-manage]')) {
      e.preventDefault();
      if (panel) {
        panel.hidden = !panel.hidden;
        e.target.closest('[data-dr-manage]').setAttribute('aria-expanded', String(!panel.hidden));
        syncSave();
      }
    }
  });

  /* Let people revisit the choice from anywhere — a footer link, for example. */
  openers.forEach(function (opener) {
    opener.addEventListener('click', function (e) {
      e.preventDefault();
      var privacy = api();
      if (privacy && typeof privacy.currentVisitorConsent === 'function') {
        var current = privacy.currentVisitorConsent();
        boxes().forEach(function (box) {
          var key = box.getAttribute('data-dr-category');
          box.checked = current && current[key] === 'yes';
        });
      }
      if (panel) panel.hidden = false;
      syncSave();
      show();
      var first = banner.querySelector('button, input');
      if (first) first.focus();
    });
  });

  /* Only prompt where consent is actually required; Shopify decides by region. */
  function maybeShow() {
    var privacy = api();
    var required = true;
    try {
      if (privacy && typeof privacy.shouldShowBanner === 'function') {
        required = privacy.shouldShowBanner();
      }
    } catch (e) {
      required = true;
    }
    if (required) show();
  }

  if (window.Shopify && typeof window.Shopify.loadFeatures === 'function') {
    window.Shopify.loadFeatures(
      [{ name: 'consent-tracking-api', version: '0.1' }],
      function (error) {
        if (error) { show(); return; }
        maybeShow();
      }
    );
  } else {
    show();
  }
})();
