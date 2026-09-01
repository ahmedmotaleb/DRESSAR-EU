/* Dressar product card behaviour: colour swatches, the "+n" overflow control and the
   wishlist hook.

   One listener on the document, not one per card. A 24-product grid with five colours
   each would otherwise attach 120 listeners, and the grid is replaced wholesale every
   time a filter changes — so per-card listeners would leak on every filter click too.
   Delegation survives the swap for free. */
(function () {
  'use strict';

  function card(el) {
    return el.closest('[data-dr-card]');
  }

  /* Swap the card over to the colour the shopper picked. Only what a card actually
     shows is updated — image, title, price, link. Anything else (sizes, description)
     belongs to the product page, which the link now points at. */
  function applySwatch(swatch) {
    var root = card(swatch);
    if (!root) return;

    var url = swatch.getAttribute('data-url');
    var img = root.querySelector('[data-dr-card-img]');
    var src = swatch.getAttribute('data-img');

    if (img && src) {
      img.setAttribute('src', src);
      var srcset = swatch.getAttribute('data-srcset');
      if (srcset) img.setAttribute('srcset', srcset);
      img.setAttribute('alt', swatch.getAttribute('data-alt') || '');
      root.classList.add('dr-card--swapped');
    }

    var titleEl = root.querySelector('[data-dr-card-title]');
    if (titleEl) titleEl.textContent = swatch.getAttribute('data-title') || titleEl.textContent;

    var link = root.querySelector('[data-dr-card-link]');
    if (link && url) link.setAttribute('href', url);

    var now = root.querySelector('[data-dr-price-now]');
    if (now) now.textContent = swatch.getAttribute('data-price') || now.textContent;

    /* The compare-at is per colour: one colour can be reduced while another is not,
       so the strike-through is added and removed rather than merely re-filled. */
    var priceWrap = root.querySelector('[data-dr-card-price]');
    var was = root.querySelector('[data-dr-price-was]');
    var compare = swatch.getAttribute('data-compare');
    if (compare && priceWrap) {
      if (!was) {
        was = document.createElement('s');
        was.className = 'dr-card__price-was';
        was.setAttribute('data-dr-price-was', '');
        priceWrap.appendChild(was);
      }
      was.textContent = compare;
    } else if (was) {
      was.remove();
    }

    var label = root.querySelector('[data-dr-colour-name]');
    if (label) label.textContent = swatch.getAttribute('data-colour') || label.textContent;

    var quick = root.querySelector('[data-dr-quick]');
    if (quick && url) {
      quick.setAttribute('href', url);
      quick.setAttribute('data-product-url', url);
    }
    if (url) root.setAttribute('data-product-url', url);

    root.querySelectorAll('[data-dr-swatch]').forEach(function (other) {
      other.classList.toggle('is-current', other === swatch);
      if (other === swatch) {
        other.setAttribute('aria-current', 'true');
      } else {
        other.removeAttribute('aria-current');
      }
    });
  }

  document.addEventListener('click', function (event) {
    var more = event.target.closest('[data-dr-swatch-more]');
    if (more) {
      event.preventDefault();
      var group = more.closest('[data-dr-swatches]');
      if (group) {
        group.classList.add('is-expanded');
        more.setAttribute('aria-expanded', 'true');
        var first = group.querySelector('.dr-swatch--overflow');
        if (first) first.focus();
      }
      return;
    }

    var swatch = event.target.closest('[data-dr-swatch]');
    if (swatch) {
      /* Modified clicks are the shopper asking for a new tab or window. Let the
         browser do exactly that against the real href instead of hijacking it. */
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      applySwatch(swatch);
      return;
    }

    var wish = event.target.closest('[data-dr-wishlist]');
    if (wish) {
      event.preventDefault();
      /* No storage and no visual "saved" state, because nothing on this store can
         remember it. The event is the integration point: a wishlist app listens for
         it and is then responsible for both persistence and the pressed state. */
      wish.dispatchEvent(
        new CustomEvent('dressar:wishlist', {
          bubbles: true,
          detail: {
            productId: wish.getAttribute('data-product-id'),
            handle: wish.getAttribute('data-product-handle')
          }
        })
      );
    }
  });

  /* Keyboard parity: swatches are links, so Enter already activates them, but the
     overflow control and arrow-key movement across a swatch group are not free. */
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    var swatch = event.target.closest('[data-dr-swatch]');
    if (!swatch) return;
    var group = swatch.closest('[data-dr-swatches]');
    if (!group) return;
    var visible = Array.prototype.filter.call(
      group.querySelectorAll('[data-dr-swatch]'),
      function (el) { return el.offsetParent !== null; }
    );
    var i = visible.indexOf(swatch);
    if (i === -1) return;
    event.preventDefault();
    var next = event.key === 'ArrowRight' ? i + 1 : i - 1;
    if (next < 0) next = visible.length - 1;
    if (next >= visible.length) next = 0;
    visible[next].focus();
  });
})();
