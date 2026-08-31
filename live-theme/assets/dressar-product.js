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
