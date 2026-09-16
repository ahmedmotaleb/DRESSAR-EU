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

  function isNumericSize(label) {
    return /^\d{1,3}$/.test(String(label).trim());
  }

  /* Values are placed in three bands: recognised apparel sizes in ladder order,
     then plain numeric sizes, then anything else — "One size", "Petite" — parked
     at the end in the order Shopify sent it.

     Ordering only the values that are actually sizes is what makes the ladder
     usable on a real catalogue. An all-or-nothing rule reads as the safer choice
     until you meet a real size filter: this shop's assortment mixes M–3XL with
     "One size", which is enough to disable the ladder entirely and leave the whole
     filter alphabetical. Sizes in size order followed by "One size" is right; it
     is the half-applied ladder that never arrives. */
  var NUMERIC_BASE = 100;
  var UNKNOWN_BASE = 2000;

  function rankOf(label, index) {
    var key = normalise(label);
    if (Object.prototype.hasOwnProperty.call(RANK, key)) return RANK[key];
    if (isNumericSize(label)) return NUMERIC_BASE + parseInt(String(label).trim(), 10);
    return UNKNOWN_BASE + index;
  }

  /* Two recognised values is the fewest that can be out of order, and requiring a
     majority keeps the ladder off a filter that merely happens to contain one
     size-shaped word. */
  function shouldOrder(labels) {
    var known = 0;
    labels.forEach(function (l) {
      if (Object.prototype.hasOwnProperty.call(RANK, normalise(l)) || isNumericSize(l)) known += 1;
    });
    return known >= 2 && known * 2 >= labels.length;
  }

  function orderFilter(details) {
    var list = details.querySelector('.mobile-facets__list, .facets__list, .facets__list--vertical');
    if (!list) return;

    var items = Array.prototype.slice.call(list.children);
    if (items.length < 2) return;

    var labels = items.map(labelOf);

    if (!shouldOrder(labels)) {
      details.classList.remove('dr-facet--sizes');
      items.forEach(function (item) { item.style.order = ''; });
      return;
    }

    details.classList.add('dr-facet--sizes');
    items.forEach(function (item, i) {
      item.style.order = String(rankOf(labels[i], i));
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
