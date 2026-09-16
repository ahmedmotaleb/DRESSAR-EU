/* Dressar product page.
   Variant selection, availability, real stock messaging, size validation and the
   mobile sticky bar. Add-to-cart submission is left to Dawn's <product-form>
   element so the existing cart drawer keeps working. */
(function () {
  'use strict';

  document.querySelectorAll('[data-dr-product]').forEach(function (root) {
    var dataEl = root.querySelector('[data-dr-variants]');
    if (!dataEl) return;

    var variants;
    try { variants = JSON.parse(dataEl.textContent); } catch (e) { return; }

    var idInput = root.querySelector('[data-dr-variant-id]');
    var submit = root.querySelector('[data-dr-submit]');
    var priceEl = root.querySelector('[data-dr-price]');
    var stockEl = root.querySelector('[data-dr-stock]');
    var skuEl = root.querySelector('[data-dr-sku]');
    var errorEl = root.querySelector('[data-dr-size-error]');
    var groups = Array.prototype.slice.call(root.querySelectorAll('[data-dr-option-group]'));
    var money = root.getAttribute('data-money-format') || '{{amount}}';

    function formatMoney(cents) {
      var value = (cents / 100).toFixed(2).split('.');
      var whole = value[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      var wholeDot = value[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return money
        .replace(/\{\{\s*amount\s*\}\}/g, whole + '.' + value[1])
        .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, whole)
        .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, wholeDot + ',' + value[1])
        .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, wholeDot);
    }

    function chosen() {
      return groups.map(function (g) {
        var picked = g.querySelector('input:checked');
        return picked ? picked.value : null;
      });
    }

    function findVariant(values) {
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        var match = true;
        for (var j = 0; j < values.length; j++) {
          if (values[j] === null || v.options[j] !== values[j]) { match = false; break; }
        }
        if (match) return v;
      }
      return null;
    }

    /* Mark options that lead to no purchasable variant, without hiding them. */
    function markAvailability(values) {
      groups.forEach(function (group, gi) {
        group.querySelectorAll('input[type="radio"]').forEach(function (input) {
          var test = values.slice();
          test[gi] = input.value;
          var reachable = variants.some(function (v) {
            for (var i = 0; i < test.length; i++) {
              if (i === gi || test[i] === null) continue;
              if (v.options[i] !== test[i]) return false;
            }
            return v.options[gi] === input.value && v.available;
          });
          input.disabled = false;
          var label = group.querySelector('label[for="' + input.id + '"]');
          if (label) label.classList.toggle('is-unavailable', !reachable);
        });
      });
    }

    function render() {
      var values = chosen();
      markAvailability(values);

      groups.forEach(function (group) {
        var out = group.querySelector('[data-dr-option-value]');
        var picked = group.querySelector('input:checked');
        if (out) out.textContent = picked ? picked.value : '';
      });

      var variant = findVariant(values);
      var incomplete = values.indexOf(null) !== -1;

      if (incomplete) {
        if (submit) submit.disabled = false;
        return;
      }

      if (!variant) {
        if (submit) {
          submit.disabled = true;
          submit.querySelector('span').textContent = submit.getAttribute('data-text-unavailable');
        }
        return;
      }

      if (idInput) idInput.value = variant.id;

      if (priceEl) {
        var html = '<span class="dr-pdp__price-now">' + formatMoney(variant.price) + '</span>';
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          html += ' <s class="dr-pdp__price-was">' + formatMoney(variant.compare_at_price) + '</s>';
        }
        priceEl.innerHTML = html;
      }

      /* The bar shows a price too, so it has to follow the variant. Without this it
         keeps the price of whichever variant happened to load first, and a shopper who
         switched size sees one figure in the bar and another above it. */
      var stickyPrice = document.querySelector('[data-dr-sticky-price]');
      if (stickyPrice) stickyPrice.textContent = formatMoney(variant.price);

      if (skuEl) skuEl.textContent = variant.sku || '';

      if (stockEl) {
        var low = variant.available && variant.inventory_management && variant.inventory_quantity > 0 && variant.inventory_quantity <= 3;
        if (low) {
          stockEl.textContent = (stockEl.getAttribute('data-template') || '').replace('[count]', variant.inventory_quantity);
          stockEl.hidden = false;
        } else {
          stockEl.hidden = true;
        }
      }

      if (submit) {
        submit.disabled = !variant.available;
        submit.querySelector('span').textContent = variant.available
          ? submit.getAttribute('data-text-add')
          : submit.getAttribute('data-text-soldout');
      }

      if (variant.featured_media_id) {
        var target = root.querySelector('[data-media-id="' + variant.featured_media_id + '"]');
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
      }

      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    root.addEventListener('change', function (e) {
      if (e.target.matches('[data-dr-option-group] input[type="radio"]')) {
        if (errorEl) errorEl.hidden = true;
        render();
      }
    });

    /* Block submission until every option is chosen, and say which one is missing. */
    var form = root.querySelector('form[action*="/cart/add"]');
    if (form) {
      form.addEventListener(
        'submit',
        function (e) {
          var values = chosen();
          var missing = values.indexOf(null);
          if (missing === -1) return;
          e.preventDefault();
          e.stopPropagation();
          if (errorEl) {
            var name = groups[missing].getAttribute('data-option-name') || '';
            errorEl.textContent = (errorEl.getAttribute('data-template') || 'Choose an option').replace('[option]', name);
            errorEl.hidden = false;
          }
          var firstInput = groups[missing].querySelector('input[type="radio"]');
          if (firstInput) firstInput.focus();
        },
        true
      );
    }

    render();
  });

  /* ---- gallery counter ----
     Meaningful only while the gallery is a swipeable strip. On the desktop editorial
     grid every image is on screen at once, so there is nothing to count; the CSS
     hides it there and the observer simply stops mattering. */
  (function () {
    var gallery = document.querySelector('[data-dr-gallery]');
    var counter = document.querySelector('[data-dr-counter-now]');
    if (!gallery || !counter || !('IntersectionObserver' in window)) return;

    var figures = Array.prototype.slice.call(gallery.querySelectorAll('[data-dr-figure]'));
    if (figures.length < 2) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var index = figures.indexOf(entry.target);
          if (index !== -1) counter.textContent = String(index + 1);
        });
      },
      { root: gallery, threshold: 0.6 }
    );
    figures.forEach(function (figure) { io.observe(figure); });
  })();

  /* ---- enlarge ----
     One overlay, filled with whichever image was tapped, rather than a second copy of
     every photograph sitting in the markup waiting to be shown. */
  (function () {
    var overlay = document.querySelector('[data-dr-zoom-overlay]');
    if (!overlay) return;
    var image = overlay.querySelector('[data-dr-zoom-image]');
    var opener = null;

    function close() {
      if (overlay.hidden) return;
      overlay.hidden = true;
      document.documentElement.classList.remove('dr-zoom-open');
      image.removeAttribute('src');
      image.removeAttribute('srcset');
      if (opener && document.contains(opener)) opener.focus();
      opener = null;
    }

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-dr-zoom]');
      if (trigger) {
        var source = trigger.querySelector('img');
        if (!source) return;
        opener = trigger;
        image.setAttribute('src', source.currentSrc || source.src);
        image.setAttribute('alt', source.getAttribute('alt') || '');
        overlay.hidden = false;
        document.documentElement.classList.add('dr-zoom-open');
        overlay.querySelector('[data-dr-zoom-close]').focus();
        return;
      }
      if (event.target.closest('[data-dr-zoom-close]') || event.target === overlay) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !overlay.hidden) close();
    });
  })();

  /* ---- size guide drawer ---- */
  (function () {
    var guide = document.querySelector('[data-dr-guide]');
    if (!guide) return;
    var panel = guide.querySelector('[data-dr-guide-panel]');
    var opener = null;

    function close() {
      if (guide.hidden) return;
      guide.hidden = true;
      document.documentElement.classList.remove('dr-guide-open');
      if (opener && document.contains(opener)) opener.focus();
      opener = null;
    }

    document.addEventListener('click', function (event) {
      var open = event.target.closest('[data-dr-guide-open]');
      if (open) {
        event.preventDefault();
        opener = open;
        guide.hidden = false;
        document.documentElement.classList.add('dr-guide-open');
        panel.focus();
        return;
      }

      if (event.target.closest('[data-dr-guide-close]')) {
        event.preventDefault();
        close();
        return;
      }

      /* Unit toggle. Both tables are in the DOM and one is hidden, because the two
         are separate measurements typed by the merchant — nothing is converted here,
         so nothing can drift by a rounding step. */
      var unit = event.target.closest('[data-dr-guide-unit]');
      if (unit) {
        var want = unit.getAttribute('data-dr-guide-unit');
        guide.querySelectorAll('[data-dr-guide-unit]').forEach(function (button) {
          button.setAttribute('aria-pressed', button === unit ? 'true' : 'false');
        });
        guide.querySelectorAll('[data-dr-guide-table]').forEach(function (table) {
          table.hidden = table.getAttribute('data-dr-guide-table') !== want;
        });
      }
    });

    document.addEventListener('keydown', function (event) {
      if (guide.hidden) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      var focusable = panel.querySelectorAll(
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
  })();

  /* ---- sticky bar add ----
     Submits the real form rather than jumping to it. With a size chosen it adds
     straight to the bag; with none the submit guard above stops it, names the missing
     option and moves focus to the grid — which is why the bar carries no size picker
     of its own. */
  document.addEventListener('click', function (event) {
    var add = event.target.closest('[data-dr-sticky-add]');
    if (!add) return;
    event.preventDefault();

    var form = document.getElementById(add.getAttribute('data-form'));
    if (!form) return;

    if (form.requestSubmit) {
      form.requestSubmit();
    } else {
      var submit = form.querySelector('[type="submit"]');
      if (submit) submit.click();
    }
  });

  /* Mobile sticky bar: show only once the real button has scrolled away. */
  var bar = document.querySelector('[data-dr-sticky]');
  var anchor = document.querySelector('[data-dr-sticky-anchor]');
  if (bar && anchor && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          bar.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
        });
      },
      { threshold: 0 }
    );
    io.observe(anchor);
  }
})();
