/* Dressar header — scroll state, mobile drawer, focus trap. Vanilla, no dependencies. */
(function () {
  'use strict';

  var header = document.querySelector('[data-dressar-header]');
  if (!header) return;

  /* ---- publish the header height ----
     Anything that wants to stick underneath the header — the collection toolbar, for
     one — needs to know how tall it is. Without this the toolbar sticks at top: 0 and
     disappears behind the header, which sits above it on the z axis.

     Only published when the header is genuinely sticky. The merchant can switch that
     off, and in that case the header scrolls away and the toolbar should go all the
     way to the top rather than leave a header-sized gap. The section emits the sticky
     rule on its own #shopify-section wrapper, so that is what gets measured. */
  var stickyBox = header.closest('.shopify-section') || header.parentElement;

  function publishHeight() {
    var isSticky = stickyBox && window.getComputedStyle(stickyBox).position === 'sticky';
    var height = isSticky ? Math.round(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--dr-header-height', height + 'px');
  }

  publishHeight();
  if ('ResizeObserver' in window) {
    /* The header changes height when the logo image finally loads and when the window
       crosses the breakpoint where the nav moves inline, so one measurement at load is
       not enough. */
    new ResizeObserver(publishHeight).observe(header);
  } else {
    window.addEventListener('resize', publishHeight);
  }

  /* ---- solid-on-scroll ---- */
  if (header.classList.contains('dressar-header--overlay')) {
    /* Opting in from JS means a no-script visitor keeps a solid, readable header
       and the hero is not pulled up underneath it. */
    document.body.classList.add('dr-overlay-header');

    var threshold = parseInt(header.getAttribute('data-solid-after'), 10) || 40;
    var ticking = false;

    var setState = function () {
      header.classList.toggle('is-solid', window.scrollY > threshold);
      ticking = false;
    };

    setState();
    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(setState);
      },
      { passive: true }
    );
  }

  /* ---- drawer ---- */
  var drawer = document.querySelector('[data-dressar-drawer]');
  var overlay = document.querySelector('[data-dressar-overlay]');
  var lastFocus = null;

  function focusable(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null; }
    );
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key !== 'Tab' || !drawer) return;
    var items = focusable(drawer);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.setAttribute('data-open', 'true');
    drawer.removeAttribute('aria-hidden');
    if (overlay) {
      overlay.hidden = false;
      window.requestAnimationFrame(function () { overlay.setAttribute('data-visible', 'true'); });
    }
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
    var items = focusable(drawer);
    if (items.length) items[0].focus();
  }

  function closeDrawer() {
    if (!drawer || drawer.getAttribute('data-open') !== 'true') return;
    drawer.setAttribute('data-open', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    if (overlay) {
      overlay.removeAttribute('data-visible');
      window.setTimeout(function () { overlay.hidden = true; }, 320);
    }
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-dressar-drawer-open]')) { e.preventDefault(); openDrawer(); return; }
    if (e.target.closest('[data-dressar-drawer-close]') || e.target === overlay) { e.preventDefault(); closeDrawer(); return; }

    var expand = e.target.closest('[data-dressar-expand]');
    if (expand) {
      e.preventDefault();
      var open = expand.getAttribute('aria-expanded') === 'true';
      expand.setAttribute('aria-expanded', String(!open));
      var sub = document.getElementById(expand.getAttribute('aria-controls'));
      if (sub) sub.hidden = open;
    }
  });
})();
