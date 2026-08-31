/* Dressar hero — background film. Vanilla, no dependencies.

   The poster image is the LCP element and is always painted. The film is only
   attached once we know which composition to fetch, so exactly one file is
   downloaded rather than both, and a visitor who prefers reduced motion (or has
   no JS) simply keeps the still. */
(function () {
  'use strict';

  var films = document.querySelectorAll('[data-dr-hero-video]');
  if (!films.length) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  Array.prototype.forEach.call(films, function (film) {
    var breakpoint = parseInt(film.getAttribute('data-breakpoint'), 10) || 750;
    var isSmall = window.matchMedia('(max-width: ' + (breakpoint - 1) + 'px)').matches;
    var src = isSmall ? film.getAttribute('data-src-mobile') : film.getAttribute('data-src-desktop');
    if (!src) src = film.getAttribute('data-src-desktop');
    if (!src) return;

    /* Set muted as a property, not just an attribute: some browsers only honour
       the property when deciding whether autoplay is allowed. */
    film.muted = true;
    film.addEventListener('playing', function () { film.setAttribute('data-playing', 'true'); }, { once: true });

    film.src = src;
    var started = film.play();
    if (started && started.catch) {
      /* Autoplay refused (data saver, battery saver, OS policy). The poster is
         already on screen, so there is nothing to recover from. */
      started.catch(function () {});
    }
  });
})();
