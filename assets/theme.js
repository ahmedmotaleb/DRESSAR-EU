/* Dressar Ireland — UI behaviour (nav, drawers, search, accordions, variants) */
(function () {
  'use strict';

  var overlay = document.querySelector('[data-overlay]');
  var openPanel = null;
  var lastFocus = null;

  function focusables(el) {
    return Array.prototype.filter.call(
      el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'),
      function (n) { return n.offsetParent !== null; }
    );
  }

  function trap(e) {
    if (!openPanel || e.key !== 'Tab') return;
    var items = focusables(openPanel);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openPanelEl(el) {
    if (!el) return;
    lastFocus = document.activeElement;
    closePanel(true);
    openPanel = el;
    el.setAttribute('data-open', 'true');
    el.removeAttribute('hidden');
    if (overlay) { overlay.hidden = false; requestAnimationFrame(function () { overlay.setAttribute('data-visible', 'true'); }); }
    document.body.style.overflow = 'hidden';
    var f = focusables(el);
    if (f.length) f[0].focus();
    document.addEventListener('keydown', trap);
  }

  function closePanel(silent) {
    document.querySelectorAll('[data-panel][data-open="true"]').forEach(function (el) {
      el.setAttribute('data-open', 'false');
    });
    if (overlay) {
      overlay.removeAttribute('data-visible');
      window.setTimeout(function () { if (!openPanel) overlay.hidden = true; }, 300);
    }
    document.body.style.overflow = '';
    document.removeEventListener('keydown', trap);
    openPanel = null;
    if (!silent && lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open-panel]');
    if (opener) {
      e.preventDefault();
      openPanelEl(document.querySelector(opener.getAttribute('data-open-panel')));
      return;
    }
    if (e.target.closest('[data-close-panel]') || e.target === overlay) {
      e.preventDefault();
      closePanel();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openPanel) closePanel();
  });

  window.DressarPanels = { open: openPanelEl, close: closePanel };

  /* ---------- accordions ---------- */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.accordion__trigger');
    if (!trigger) return;
    var expanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!expanded));
    var panel = document.getElementById(trigger.getAttribute('aria-controls'));
    if (panel) panel.hidden = expanded;
  });

  /* ---------- mobile nav submenu toggles ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-submenu-toggle]');
    if (!t) return;
    e.preventDefault();
    var sub = t.parentElement.querySelector('.mobile-nav__sub');
    if (!sub) return;
    var open = t.getAttribute('aria-expanded') === 'true';
    t.setAttribute('aria-expanded', String(!open));
    sub.hidden = open;
  });

  /* ---------- quantity steppers ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-qty]');
    if (!btn) return;
    var input = btn.parentElement.querySelector('input');
    if (!input) return;
    var step = btn.getAttribute('data-qty') === 'up' ? 1 : -1;
    var min = parseInt(input.getAttribute('min') || '1', 10);
    var next = Math.max(min, (parseInt(input.value, 10) || min) + step);
    input.value = next;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* ---------- sort select auto-submit ---------- */
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-auto-submit]')) {
      var form = e.target.closest('form');
      if (form) form.submit();
    }
  });

  /* ---------- variant selection ---------- */
  function money(cents) {
    var fmt = (window.Dressar && window.Dressar.moneyFormat) || '€{{amount}}';
    var value = (cents / 100).toFixed(2);
    var parts = value.split('.');
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fmt
      .replace(/\{\{\s*amount\s*\}\}/g, whole + '.' + parts[1])
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, whole)
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + parts[1])
      .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  }
  window.DressarMoney = money;

  document.querySelectorAll('[data-product-form]').forEach(function (form) {
    var dataEl = document.getElementById(form.getAttribute('data-variants'));
    if (!dataEl) return;

    var variants;
    try { variants = JSON.parse(dataEl.textContent); } catch (err) { return; }

    var idInput = form.querySelector('[name="id"]');
    var submit = form.querySelector('[data-add-button]');
    var priceEl = document.querySelector('[data-product-price]');
    var stockEl = document.querySelector('[data-product-stock]');
    var skuEl = document.querySelector('[data-product-sku]');

    function selected() {
      return Array.prototype.map.call(
        form.querySelectorAll('input[type="radio"]:checked'),
        function (i) { return i.value; }
      );
    }

    function match(values) {
      for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        if (v.options.length === values.length && v.options.every(function (o, idx) { return o === values[idx]; })) return v;
      }
      return null;
    }

    function updateAvailability(values) {
      form.querySelectorAll('.variant-group').forEach(function (group, gi) {
        group.querySelectorAll('input[type="radio"]').forEach(function (input) {
          var test = values.slice();
          test[gi] = input.value;
          var exists = variants.some(function (v) {
            for (var i = 0; i <= gi; i++) { if (v.options[i] !== test[i]) return false; }
            return v.available;
          });
          input.disabled = !exists;
        });
      });
    }

    function render() {
      var values = selected();
      var variant = match(values);

      updateAvailability(values);

      form.querySelectorAll('.variant-group').forEach(function (group) {
        var out = group.querySelector('.selected');
        var checked = group.querySelector('input:checked');
        if (out && checked) out.textContent = checked.value;
      });

      if (!variant) {
        if (submit) { submit.disabled = true; submit.textContent = window.Dressar.strings.unavailable; }
        return;
      }

      if (idInput) idInput.value = variant.id;

      if (priceEl) {
        var html = '<span class="' + (variant.compare_at_price > variant.price ? 'price__sale' : '') + '">' + money(variant.price) + '</span>';
        if (variant.compare_at_price > variant.price) {
          html += ' <s class="price__compare">' + money(variant.compare_at_price) + '</s>';
        }
        priceEl.innerHTML = html;
      }

      if (skuEl) skuEl.textContent = variant.sku || '';

      if (stockEl) {
        if (variant.available && variant.inventory_management && variant.inventory_quantity > 0 && variant.inventory_quantity <= 5) {
          stockEl.textContent = stockEl.getAttribute('data-low-template').replace('[count]', variant.inventory_quantity);
          stockEl.classList.add('product__stock--low');
          stockEl.hidden = false;
        } else {
          stockEl.hidden = true;
        }
      }

      if (submit) {
        submit.disabled = !variant.available;
        submit.textContent = variant.available ? window.Dressar.strings.addToCart : window.Dressar.strings.soldOut;
      }

      if (history.replaceState && variant.id) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        history.replaceState({}, '', url.toString());
      }
    }

    form.addEventListener('change', function (e) {
      if (e.target.matches('input[type="radio"]')) render();
    });

    render();
  });
})();
