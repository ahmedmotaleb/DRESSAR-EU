/* Dressar rail — scroll-snap carousel arrows. Progressive enhancement over a scrollable track. */
(function () {
  'use strict';

  document.querySelectorAll('[data-dr-rail]').forEach(function (rail) {
    var track = rail.querySelector('[data-dr-rail-track]');
    var prev = rail.querySelector('[data-dr-rail-prev]');
    var next = rail.querySelector('[data-dr-rail-next]');
    if (!track) return;

    function step() {
      var first = track.firstElementChild;
      if (!first) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return first.getBoundingClientRect().width + gap;
    }

    function sync() {
      var max = track.scrollWidth - track.clientWidth - 2;
      var atStart = track.scrollLeft <= 2;
      var atEnd = track.scrollLeft >= max;
      if (prev) prev.disabled = atStart;
      if (next) next.disabled = atEnd || max <= 0;
    }

    function scrollBy(dir) {
      var rtl = getComputedStyle(track).direction === 'rtl';
      track.scrollBy({ left: step() * dir * (rtl ? -1 : 1), behavior: 'smooth' });
    }

    if (prev) prev.addEventListener('click', function () { scrollBy(-1); });
    if (next) next.addEventListener('click', function () { scrollBy(1); });
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    sync();
  });
})();
