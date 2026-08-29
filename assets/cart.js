/* Dressar Ireland — AJAX cart (add, change, drawer render, free-delivery meter) */
(function () {
  'use strict';

  var D = window.Dressar || {};
  var routes = D.routes || {};

  function money(c) { return window.DressarMoney ? window.DressarMoney(c) : '€' + (c / 100).toFixed(2); }

  function request(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.description || data.message || 'Cart error');
        return data;
      });
    });
  }

  function getCart() {
    return fetch(routes.cart_url + '.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function renderShipBar(cart) {
    var bar = document.querySelector('[data-ship-bar]');
    if (!bar) return;
    var threshold = parseInt(D.freeShippingThreshold, 10) || 0;
    if (!threshold) { bar.hidden = true; return; }
    bar.hidden = false;
    var remaining = threshold - cart.total_price;
    var text = bar.querySelector('.ship-bar__text');
    var fill = bar.querySelector('.ship-bar__fill');
    if (remaining > 0) {
      text.textContent = (D.strings.freeShippingProgress || '').replace('[amount]', money(remaining));
    } else {
      text.textContent = D.strings.freeShippingReached || '';
    }
    fill.style.width = Math.min(100, (cart.total_price / threshold) * 100) + '%';
  }

  function renderDrawer(cart) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = cart.item_count;
      el.setAttribute('data-count', cart.item_count);
    });

    var body = document.querySelector('[data-cart-items]');
    var foot = document.querySelector('[data-cart-foot]');
    if (!body) return;

    if (!cart.item_count) {
      body.innerHTML =
        '<div class="cart-empty">' +
        '<p>' + escapeHtml(D.strings.cartEmpty) + '</p>' +
        '<a class="btn btn--outline" href="' + escapeHtml(routes.cart_url.replace('/cart', '/collections/all')) + '">' +
        'Continue shopping</a></div>';
      if (foot) foot.hidden = true;
      return;
    }

    if (foot) foot.hidden = false;

    body.innerHTML =
      '<div class="ship-bar" data-ship-bar><p class="ship-bar__text"></p><div class="ship-bar__track"><div class="ship-bar__fill"></div></div></div>' +
      '<ul class="line-items">' +
      cart.items.map(function (item, i) {
        var img = item.image
          ? '<img src="' + escapeHtml(item.image.replace(/(\.[a-z]+)(\?|$)/i, '_200x$1$2')) + '" alt="' + escapeHtml(item.product_title) + '" loading="lazy" width="76" height="114">'
          : '';
        var variantLine = item.variant_title && item.variant_title !== 'Default Title'
          ? '<p class="line-item__variant">' + escapeHtml(item.variant_title) + '</p>' : '';
        return (
          '<li class="line-item">' +
          '<div class="line-item__media">' + img + '</div>' +
          '<div>' +
          '<a class="line-item__title" href="' + escapeHtml(item.url) + '">' + escapeHtml(item.product_title) + '</a>' +
          variantLine +
          '<div class="line-item__row">' +
          '<div class="qty">' +
          '<button type="button" data-qty="down" aria-label="Decrease quantity">&minus;</button>' +
          '<input type="number" min="0" value="' + item.quantity + '" data-line="' + (i + 1) + '" aria-label="Quantity">' +
          '<button type="button" data-qty="up" aria-label="Increase quantity">+</button>' +
          '</div>' +
          '<span>' + money(item.final_line_price) + '</span>' +
          '</div>' +
          '<button type="button" class="line-item__remove" data-remove="' + (i + 1) + '">Remove</button>' +
          '</div>' +
          '</li>'
        );
      }).join('') +
      '</ul>';

    var totalEl = document.querySelector('[data-cart-total]');
    if (totalEl) totalEl.textContent = money(cart.total_price);

    renderShipBar(cart);
  }

  function refresh() { return getCart().then(renderDrawer); }

  function change(line, quantity) {
    return request(routes.cart_change_url + '.js', { line: line, quantity: quantity }).then(renderDrawer);
  }

  /* add to cart */
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[action*="/cart/add"]');
    if (!form || form.hasAttribute('data-no-ajax')) return;
    e.preventDefault();

    var btn = form.querySelector('[type="submit"]');
    var original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    var fd = new FormData(form);
    var payload = { items: [{ id: fd.get('id'), quantity: parseInt(fd.get('quantity') || '1', 10) }] };

    request(routes.cart_add_url + '.js', payload)
      .then(function () { return refresh(); })
      .then(function () {
        if (window.DressarPanels) window.DressarPanels.open(document.querySelector('[data-cart-drawer]'));
      })
      .catch(function (err) {
        var msg = form.querySelector('[data-form-error]');
        if (msg) { msg.textContent = err.message; msg.hidden = false; }
        else window.alert(err.message);
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      });
  });

  /* quantity + remove inside drawer */
  document.addEventListener('change', function (e) {
    var input = e.target.closest('[data-line]');
    if (!input) return;
    change(parseInt(input.getAttribute('data-line'), 10), parseInt(input.value, 10) || 0);
  });

  document.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-remove]');
    if (!rm) return;
    e.preventDefault();
    change(parseInt(rm.getAttribute('data-remove'), 10), 0);
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('[data-cart-items]')) refresh();
  });
})();
