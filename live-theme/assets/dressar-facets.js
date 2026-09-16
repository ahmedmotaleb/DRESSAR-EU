/* Filter drawer refinements.

   Dawn's facets markup and facets.js are untouched. This only adds two things on
   top of what Shopify already renders:

     1. Apparel ordering for size filters. Search & Discovery hands filter values
        back in its own order, which for sizes is usually alphabetical — so the
        drawer reads "2XL, 3XL, L, M, XL". Nobody shops that way.

     2. The apply button says how many products the current selection will show,
        rather than just "Apply".

   Both are re-applied after every filter change, because facets.js replaces the
   filter list with freshly rendered HTML each time. */
(function () {
  'use strict';

  /* Written as a ladder rather than a comparator so the intent is legible, and so
     the equivalent spellings sit on the same rung: XXL and 2XL are one size, and a
     merchant may have typed either. */
  var LADDER = [
    ['4XS'], ['3XS', 'XXXS'], ['2XS', 'XXS'], ['XS'], ['S'], ['M'], ['L'], ['XL'],
    ['2XL', 'XXL'], ['3XL', 'XXXL'], ['4XL', 'XXXXL'], ['5XL'], ['6XL']
  ];

  var RANK = {};
  LADDER.forEach(function (rung, i) {
    rung.forEach(function (name) { RANK[name] = i; });
  });

  function normalise(text) {
    return String(text || '')
      .toUpperCase()
      .replace(/[\s\-_.]/g, '')
      .replace(/SIZE/g, '');
  }

  function labelOf(item) {
    var el = item.querySelector('.facet-checkbox__text-label');
    if (el) return el.textContent;
    var input = item.querySelector('input[type="checkbox"]');
    return input ? input.value : '';
  }

  /* Only reorder when every value is recognisable, and only within one scheme.
     A filter holding "One size", or a mix of "S" and "38", is left exactly as
     Shopify sent it — a half-applied ladder is worse than none. */
  function schemeFor(labels) {
    if (!labels.length) return null;

    var allAlpha = labels.every(function (l) { return Object.prototype.hasOwnProperty.call(RANK, normalise(l)); });
    if (allAlpha) return 'alpha';

    var allNumeric = labels.every(function (l) { return /^\d{1,3}$/.test(String(l).trim()); });
    if (allNumeric) return 'numeric';

    return null;
  }

  function orderFilter(details) {
    var list = details.querySelector('.mobile-facets__list, .facets__list, .facets__list--vertical');
    if (!list) return;

    var items = Array.prototype.slice.call(list.children);
    if (items.length < 2) return;

    var labels = items.map(labelOf);
    var scheme = schemeFor(labels);

    if (!scheme) {
      details.classList.remove('dr-facet--sizes');
      items.forEach(function (item) { item.style.order = ''; });
      return;
    }

    details.classList.add('dr-facet--sizes');
    items.forEach(function (item, i) {
      var value = scheme === 'alpha' ? RANK[normalise(labels[i])] : parseInt(labels[i], 10);
      item.style.order = String(value);
    });
  }

  /* The count is Dawn's and is rewritten on every filter change, so the button is
     rebuilt from it rather than from a number cached at load. */
  function labelApplyButton(root) {
    var toolbar = document.querySelector('[data-dr-facets-show-label]');
    if (!toolbar) return;
    var prefix = toolbar.getAttribute('data-dr-facets-show-label');
    if (!prefix) return;

    var count = root.querySelector('.mobile-facets__count');
    var button = root.querySelector('.mobile-facets__footer .button--primary');
    if (!count || !button) return;

    var text = count.textContent.trim();
    if (!text) return;

    /* Written only when it actually differs. The observer below watches this same
       subtree for childList changes, and assigning textContent replaces the text
       node even when the string is identical — so an unconditional write would
       retrigger the observer on every frame, forever. */
    var next = prefix + ' ' + text;
    if (button.textContent.trim() !== next) button.textContent = next;
  }

  function apply() {
    var root = document.getElementById('FacetFiltersFormMobile');
    if (!root) return;
    root.querySelectorAll('.js-filter').forEach(orderFilter);
    labelApplyButton(root);
  }

  function watch() {
    var root = document.getElementById('FacetFiltersFormMobile');
    if (!root) return;

    apply();

    /* facets.js swaps the filter list and the count for server-rendered HTML on
       every change, which wipes both the ordering and the button text. Observing
       the form is simpler and more robust than trying to hook its internals. */
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        apply();
      });
    }).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();
