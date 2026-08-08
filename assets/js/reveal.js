(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Row-aware stagger for project cards (wide = full row, pairs = left then right) */
  var grid = document.querySelector('.project-grid');
  if (grid) {
    var pairIndex = 0;
    grid.querySelectorAll('.project-card.reveal').forEach(function (card) {
      if (card.classList.contains('wide')) {
        card.style.setProperty('--reveal-delay', '0ms');
        pairIndex = 0;
        return;
      }
      card.style.setProperty('--reveal-delay', (pairIndex % 2 === 0 ? 0 : 120) + 'ms');
      pairIndex += 1;
    });
  }

  var els = document.querySelectorAll('.reveal');
  if (els.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var pending = [];
      var flushTimer = null;
      var cascadeMs = 70;

      function flush() {
        flushTimer = null;
        pending.sort(function (a, b) {
          return a.getBoundingClientRect().top - b.getBoundingClientRect().top ||
            a.getBoundingClientRect().left - b.getBoundingClientRect().left;
        });
        var cardStep = 0;
        pending.forEach(function (el) {
          if (el.classList.contains('project-card')) {
            var base = parseFloat(getComputedStyle(el).getPropertyValue('--reveal-delay')) || 0;
            var delay = base + cardStep * cascadeMs;
            el.style.setProperty('--reveal-delay', delay + 'ms');
            cardStep += 1;
            window.setTimeout(function () {
              el.classList.add('is-settled');
            }, delay + 900);
          }
          el.classList.add('is-visible');
        });
        pending = [];
      }

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          pending.push(entry.target);
          io.unobserve(entry.target);
        });
        if (pending.length && !flushTimer) {
          flushTimer = window.setTimeout(flush, 16);
        }
      }, {
        threshold: 0.14,
        rootMargin: '0px 0px -12% 0px'
      });

      requestAnimationFrame(function () {
        els.forEach(function (el) { io.observe(el); });
      });
    }
  }

  /* Solidify nav + fade home hero title before it collides with the brand */
  var nav = document.querySelector('.nav');
  var hero = document.querySelector('main > .hero:not(.about-hero)');
  var heroTitle = hero && hero.querySelector('h1');
  if (!nav) return;

  var ticking = false;

  function update() {
    ticking = false;
    var scrolled = window.scrollY > 40;
    nav.classList.toggle('is-scrolled', scrolled);

    if (!hero || !heroTitle || reduceMotion) return;

    var navBottom = nav.getBoundingClientRect().bottom;
    var titleTop = heroTitle.getBoundingClientRect().top;
    var shouldFade = titleTop < navBottom - 4;
    hero.classList.toggle('is-fading', shouldFade);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
})();
