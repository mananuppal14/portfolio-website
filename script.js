/* ============================================================
   script.js
   Three jobs:
     1. Smooth-scroll the sticky nav links to their sections
     2. Fade each section in as it scrolls into view
     3. Small niceties: active nav link, nav shadow, footer year

   Wrapped in an IIFE — an Immediately Invoked Function Expression:
       (function () { ... })();
   Everything declared inside stays inside, so none of these
   variables leak onto `window` and collide with other scripts.
   ============================================================ */
(function () {
  'use strict';   // opts into stricter parsing; turns silent mistakes into errors


  /* ----------------------------------------------------------
     0. "JS IS ON" FLAG
     style.css only hides .reveal elements under a `.js` parent.
     Setting this class from JS means: if this file fails to load,
     nothing is ever hidden and the page degrades gracefully.
     Done first, before anything can throw.
     ---------------------------------------------------------- */
  document.documentElement.classList.add('js');


  /* ----------------------------------------------------------
     1. SHARED HELPERS
     ---------------------------------------------------------- */

  // matchMedia lets JS read a CSS media query. Same "reduce motion"
  // preference style.css respects — we check it before animating.
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // querySelectorAll returns a NodeList (array-like, not a real array).
  // Array.prototype.slice.call(...) converts it so .forEach/.filter work everywhere.
  function toArray(nodeList) {
    return Array.prototype.slice.call(nodeList);
  }

  var navLinks = toArray(document.querySelectorAll('[data-nav-link]'));
  var sections = toArray(document.querySelectorAll('section[id]'));
  var header   = document.querySelector('.site-header');


  /* ----------------------------------------------------------
     2. SMOOTH SCROLL NAVIGATION

     CSS `scroll-behavior: smooth` already handles this, but doing it
     in JS lets us also:
       - honour prefers-reduced-motion (jump instantly instead)
       - update the URL without the browser's instant jump
       - move keyboard focus to the target, so Tab continues from
         the right place (a default-anchor behaviour that breaks
         the moment you preventDefault)
     ---------------------------------------------------------- */
  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      // getAttribute('href') gives the literal "#projects";
      // link.href would give the full absolute URL.
      var targetId = link.getAttribute('href');

      // Ignore anything that isn't a same-page anchor ("#", external URLs, ...)
      if (!targetId || targetId.charAt(0) !== '#' || targetId.length < 2) return;

      var target = document.querySelector(targetId);
      if (!target) return;   // link points at a section that doesn't exist — let the browser deal

      // Stop the browser's default instant jump; we're doing the scroll ourselves
      event.preventDefault();

      target.scrollIntoView({
        // 'smooth' animates, 'auto' jumps. CSS scroll-padding-top keeps the
        // sticky nav from covering the heading we land on.
        behavior: motionQuery.matches ? 'auto' : 'smooth',
        block: 'start'
      });

      // Keep the address bar in sync so the URL is shareable and Back works,
      // without triggering another jump the way `location.hash = ...` would.
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', targetId);
      }

      /* Focus management for keyboard + screen-reader users.
         Sections aren't focusable by default, so we give the target a
         temporary tabindex="-1" (focusable by script, skipped by Tab),
         focus it with preventScroll so focusing doesn't cancel our
         smooth scroll, then clean the attribute up on blur. */
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.addEventListener('blur', function handleBlur() {
        target.removeAttribute('tabindex');
        target.removeEventListener('blur', handleBlur);
      });
    });
  });


  /* ----------------------------------------------------------
     3. FADE-IN ON SCROLL (IntersectionObserver)

     The old way was listening to every scroll event and measuring
     element positions — expensive, and it runs hundreds of times a
     second. IntersectionObserver instead lets the browser tell us
     the moment an element crosses into view, off the main thread.
     ---------------------------------------------------------- */
  var revealItems = toArray(document.querySelectorAll('.reveal'));

  function revealAll() {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Fallback for very old browsers (and for reduce-motion users):
  // skip the animation entirely and just show everything.
  if (!('IntersectionObserver' in window) || motionQuery.matches) {
    revealAll();
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        // isIntersecting = this element is currently inside the "root" area
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');

        // Stop watching once revealed — the animation is one-shot, so keeping
        // the observer alive would just burn work. (Remove this line if you
        // want sections to fade back out when scrolled away from.)
        observer.unobserve(entry.target);
      });
    }, {
      // root: null → measure against the viewport (the default)
      root: null,

      /* rootMargin shrinks/grows the trigger area, CSS-shorthand order
         (top right bottom left). A negative bottom margin of 12% means
         "don't count it as visible until it's 12% of the screen height
         inside", so the fade starts once the section is properly on
         screen rather than the instant one pixel appears. */
      rootMargin: '0px 0px -12% 0px',

      // threshold 0.08 → fire when ~8% of the element is showing. Needed for
      // tall sections that can never be 50%+ visible on a small screen.
      threshold: 0.08
    });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }


  /* ----------------------------------------------------------
     4. ACTIVE NAV LINK
     A second observer, same idea: highlight the nav link for
     whichever section currently owns the middle of the screen.
     ---------------------------------------------------------- */
  if ('IntersectionObserver' in window && sections.length) {
    var setActive = function (id) {
      navLinks.forEach(function (link) {
        // classList.toggle(name, force) adds when force is true, removes when false
        link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
      });
    };

    var spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, {
      /* This rootMargin collapses the viewport down to a thin horizontal
         band across the middle of the screen (-45% off the top, -50% off
         the bottom). Whichever section crosses that band is "current" —
         a simple way to avoid two sections both claiming to be active. */
      rootMargin: '-45% 0px -50% 0px',
      threshold: 0
    });

    sections.forEach(function (section) { spyObserver.observe(section); });
  }


  /* ----------------------------------------------------------
     5. NAV SHADOW ON SCROLL
     Adds .is-scrolled to the header once you've left the top, so
     it only shows a border/shadow when floating over content.

     Scroll events fire very fast, so the handler does as little as
     possible: read one number, toggle one class. requestAnimationFrame
     throttles it to at most once per frame (~60/second), and
     { passive: true } promises we won't call preventDefault, which
     lets the browser scroll without waiting on this code.
     ---------------------------------------------------------- */
  if (header) {
    var ticking = false;   // "is a frame already scheduled?"

    var onScroll = function () {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(function () {
        header.classList.toggle('is-scrolled', window.scrollY > 10);
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();   // run once at load, in case the page opens already scrolled
  }


  /* ----------------------------------------------------------
     6. FOOTER YEAR
     Keeps the copyright current without you editing HTML each January.
     ---------------------------------------------------------- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

})();
