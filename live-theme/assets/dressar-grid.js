/* Grid density.

   Remembers how many products the shopper wants across, per browser, with no
   account and nothing sent anywhere. Two independent preferences are kept —
   desktop and mobile — because someone who wants five across on a monitor still
   wants two on a phone.

   The value is written to the section wrapper rather than to the product grid
   itself. facets.js replaces #ProductGridContainer wholesale on every filter
   change, so a custom property set on the <ul> inside it would be thrown away the
   first time anyone touched a filter. The wrapper survives, and custom properties
   inherit down to the grid either way. */
(function () {
  'use strict';

  /* Two preferences, two custom properties. Because both are always applied, the
     media queries in CSS decide which one is in force — so crossing the breakpoint
     needs no JavaScript, no resize listener and no re-render. */
  var SCOPES = {
    desktop: { key: 'dressar:cols', prop: '--dr-cols' },
    mobile: { key: 'dressar:cols-mobile', prop: '--dr-cols-mobile' }
  };

  /* Storage throws outright in some privacy modes rather than returning null, so
     every read and write is guarded and the control simply stops persisting. */
  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* Preference is not remembered; the layout still changes for this visit. */
    }
  }

  function apply(root, scope, value) {
    var map = SCOPES[scope];
    if (!map) return;
    root.style.setProperty(map.prop, value);
  }

  function markPressed(group, scope, value) {
    group.querySelectorAll('[data-dr-density-set][data-scope="' + scope + '"]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-dr-density-set') === String(value) ? 'true' : 'false');
    });
  }

  function restore() {
    var root = document.querySelector('[data-dr-grid-scope]');
    if (!root) return;
    var group = document.querySelector('[data-dr-density]');

    ['desktop', 'mobile'].forEach(function (scope) {
      var stored = read(SCOPES[scope].key);
      if (!stored) return;
      apply(root, scope, stored);
      if (group) markPressed(group, scope, stored);
    });
  }

  document.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-dr-density-set]');
    if (!btn) return;
    event.preventDefault();

    var root = document.querySelector('[data-dr-grid-scope]');
    if (!root) return;

    var scope = btn.getAttribute('data-scope');
    var value = btn.getAttribute('data-dr-density-set');
    if (!SCOPES[scope]) return;

    apply(root, scope, value);
    write(SCOPES[scope].key, value);
    markPressed(btn.closest('[data-dr-density]'), scope, value);
  });

  /* Restore before first paint where possible, so the grid does not visibly jump
     from the merchant default to the shopper's choice. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restore);
  } else {
    restore();
  }
})();
