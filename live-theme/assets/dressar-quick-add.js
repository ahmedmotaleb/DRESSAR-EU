/* Dressar quick add.

   A "+" on a card fetches that one product through the Section Rendering API and
   drops the result into a sheet that already exists on the page. Nothing about any
   other product is loaded, and a twenty-four product grid ships no variant data.

   The add itself is Dawn's. The fetched markup contains Dawn's <product-form> around
   a real product form, so once it is in the document Dawn performs the add, renders
   the cart sections and opens the cart drawer. There is no cart code here at all. */
(function () {
  'use strict';

  var SECTION = 'dressar-quick-add';
  var sheet = null;
  var opener = null;
  var watcher = null;

  function init() {
    sheet = document.querySelector('[data-dr-sheet]');
    return !!sheet;
  }

  function body() { return sheet.querySelector('[data-dr-sheet-body]'); }
  function panel() { return sheet.querySelector('[data-dr-sheet-panel]'); }
  function errorEl() { return sheet.querySelector('[data-dr-sheet-error]'); }

  function busy(link, on) {
    link.classList.toggle('is-loading', on);
    var spin = link.querySelector('.dr-card__quick-spinner');
    if (spin) spin.hidden = !on;
    link.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function close() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.documentElement.classList.remove('dr-sheet-open');
    /* Stop watching before the node it observes is thrown away, or the observer sits
       holding a detached subtree for the life of the page. */
    if (watcher) {
      watcher.disconnect();
      watcher = null;
    }
    body().innerHTML = '';
    errorEl().hidden = true;
    /* Focus goes back to the control that opened the sheet. Without this it lands on
       <body> and a keyboard user restarts from the top of the page. */
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  }

  function open() {
    sheet.hidden = false;
    document.documentElement.classList.add('dr-sheet-open');
    panel().focus();
  }

  /* Dawn tells us the request finished by putting `hidden` back on the spinner in its
     .finally(). Reading that is more robust than reaching for Dawn's pub/sub globals,
     which are script-scoped consts rather than properties of window. If the error
     wrapper is still hidden when it settles, the add worked and the cart drawer is
     already opening over us, so the sheet gets out of the way. */
  function watchSubmit(scope) {
    var spinner = scope.querySelector('.loading__spinner');
    var errWrap = scope.querySelector('.product-form__error-message-wrapper');
    if (!spinner) return;

    var wasLoading = false;
    if (watcher) watcher.disconnect();
    var observer = new MutationObserver(function () {
      var loading = !spinner.classList.contains('hidden');
      if (loading) {
        wasLoading = true;
        return;
      }
      if (!wasLoading) return;
      wasLoading = false;
      var failed = errWrap && !errWrap.hasAttribute('hidden');
      if (!failed) {
        observer.disconnect();
        close();
      }
    });
    observer.observe(spinner, { attributes: true, attributeFilter: ['class'] });
    watcher = observer;
  }

  function fill(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var payload = doc.querySelector('[data-dr-qa-payload]');
    if (!payload) return null;

    body().innerHTML = payload.outerHTML;
    var mounted = body().querySelector('[data-dr-qa-payload]');

    var label = sheet.getAttribute('data-label-add');
    var addLabel = mounted.querySelector('[data-dr-qa-add-label]');
    if (label && addLabel) addLabel.textContent = label;

    /* The size heading belongs above the grid but its wording is a merchant setting on
       the sheet, so it is inserted here rather than baked into the fetched section. */
    var sizes = mounted.querySelector('[data-dr-qa-sizes]');
    if (sizes) {
      var heading = document.createElement('p');
      heading.className = 'dr-qa__label';
      heading.textContent = sheet.getAttribute('data-label-size') || '';
      sizes.parentNode.insertBefore(heading, sizes);
    }

    watchSubmit(mounted);
    return mounted;
  }

  /* Deliberately not cached. The payload carries which sizes are in stock, and a
     response held for the length of a session would go on offering a size that sold
     out minutes ago. A request per open is cheap; being wrong about stock is not. */
  function load(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Quick add request failed: ' + r.status);
      return r.text();
    });
  }

  function start(link) {
    var productUrl = link.getAttribute('data-product-url') || link.getAttribute('href');
    if (!productUrl) return;
    var url = productUrl.split('?')[0] + '?section_id=' + SECTION;

    opener = link;
    busy(link, true);

    load(url)
      .then(function (html) {
        var mounted = fill(html);
        if (!mounted) throw new Error('Quick add payload missing');

        if (mounted.getAttribute('data-single') === 'true') {
          /* No choice to make, so no sheet: the form is already in the document and
             Dawn's element has upgraded, so submitting it adds the item directly. */
          var form = mounted.querySelector('form');
          if (form) {
            if (form.requestSubmit) {
              form.requestSubmit();
            } else {
              form.querySelector('[type="submit"]').click();
            }
          }
          return;
        }
        open();
      })
      .catch(function (error) {
        /* Never strand the shopper on a dead "+". The link's href is the product page,
           so falling through to it is exactly where they were trying to get. */
        console.error(error);
        window.location.href = productUrl;
      })
      .finally(function () {
        busy(link, false);
      });
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-dr-quick]');
    if (link) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (!sheet && !init()) return;
      event.preventDefault();
      start(link);
      return;
    }

    if (sheet && event.target.closest('[data-dr-sheet-close]')) {
      event.preventDefault();
      close();
    }
  });

  /* A size is never chosen for the shopper. Pressing Add without one says so, points
     at the grid and moves focus there, rather than quietly picking whatever is left. */
  document.addEventListener(
    'submit',
    function (event) {
      if (!sheet || sheet.hidden) return;
      var form = event.target;
      if (!sheet.contains(form)) return;

      var sizes = form.querySelector('[data-dr-qa-sizes]');
      if (!sizes) return;
      if (sizes.querySelector('input[type="radio"]:checked')) return;

      event.preventDefault();
      event.stopPropagation();

      var message = errorEl();
      message.textContent = sheet.getAttribute('data-label-error') || '';
      message.hidden = false;
      sizes.classList.add('is-invalid');

      var first = sizes.querySelector('input[type="radio"]:not(:disabled)');
      if (first) first.focus();
    },
    true
  );

  document.addEventListener('change', function (event) {
    if (!sheet || sheet.hidden) return;
    if (!event.target.matches('[data-dr-qa-sizes] input[type="radio"]')) return;
    errorEl().hidden = true;
    var sizes = event.target.closest('[data-dr-qa-sizes]');
    if (sizes) sizes.classList.remove('is-invalid');
  });

  document.addEventListener('keydown', function (event) {
    if (!sheet || sheet.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    /* Focus trap. Queried on every Tab rather than cached, because the contents are
       injected after the sheet is built and change with each product. */
    var focusable = panel().querySelectorAll(
      'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  init();
})();
