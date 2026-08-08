(function () {
  var els = document.querySelectorAll('.reveal');
  if (els.length) {
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

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

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
