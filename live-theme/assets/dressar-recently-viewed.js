/* Recently viewed.

   Two jobs: remember which products this browser has looked at, and render them
   back. Nothing leaves the device and no account is involved — the list is a short
   array of product ids in localStorage.

   Rendering uses Shopify's own search endpoint with an id query, fetched back as
   this same section. That is why no product data is duplicated into the page and no
   app is needed: the server renders the same cards it would render anywhere else. */
(function () {
  'use strict';

  var KEY = 'dressar:recent';
  var KEEP = 12;

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      /* Storage is unavailable or holds something unparseable. Either way the
         feature simply does not appear, which is the correct degradation. */
      return [];
    }
  }

  function write(list) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      /* Nothing remembered this visit. */
    }
  }

  /* Record on any page carrying a product id, which is the product page. Moving an
     already-seen product back to the front keeps the order genuinely "recent"
     rather than "first seen". */
  function record() {
    var el = document.querySelector('[data-product-id]');
    if (!el) return;
    var id = el.getAttribute('data-product-id');
    if (!id) return;

    var list = read().filter(function (existing) { return String(existing) !== String(id); });
    list.unshift(id);
    write(list.slice(0, KEEP));
  }

  function render() {
    var root = document.querySelector('[data-dr-recent]');
    if (!root) return;

    var current = root.getAttribute('data-current');
    var limit = parseInt(root.getAttribute('data-limit'), 10) || 6;

    var ids = read().filter(function (id) { return String(id) !== String(current); }).slice(0, limit);
    if (!ids.length) return;

    /* The search index is not instant: a product viewed seconds ago may not come
       back yet, and one that was unpublished will never come back. Either way the
       response decides what is shown, so nothing can render a dead card. */
    var query = ids
      .map(function (id) { return 'id:' + encodeURIComponent(id); })
      .join('+OR+');

    var url =
      '/search?section_id=' + encodeURIComponent(root.getAttribute('data-section-id')) +
      '&type=product&options%5Bunavailable_products%5D=last&q=' + query;

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('Recently viewed request failed: ' + response.status);
        return response.text();
      })
      .then(function (html) {
        var parsed = new DOMParser().parseFromString(html, 'text/html');
        var grid = parsed.querySelector('ul');
        if (!grid || !grid.children.length) return;

        root.querySelector('[data-dr-recent-body]').appendChild(grid);
        root.hidden = false;
      })
      .catch(function (error) {
        /* The section stays hidden. A row that fails to load is not worth an error
           message on a product page. */
        console.error(error);
      });
  }

  function start() {
    record();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
