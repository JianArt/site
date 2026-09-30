window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag('js', new Date());
gtag('config', 'G-9888HFYBES');

(function () {
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (/^mailto:/i.test(href)) {
      gtag('event', 'contact', { method: 'email', link_text: link.textContent.trim() });
    } else if (link.host === 'maps.jianart.com') {
      gtag('event', 'visit_maps');
    } else if (link.classList.contains('project-card')) {
      var cards = Array.prototype.slice.call(document.querySelectorAll('.project-card'));
      gtag('event', 'select_work', {
        work: link.pathname.split('/').filter(Boolean).pop(),
        position: cards.indexOf(link) + 1
      });
    }
  });

  if (!/\/designs\//.test(location.pathname)) return;
  var marks = [25, 50, 75, 100];
  var ticking = false;
  function measure() {
    ticking = false;
    var doc = document.documentElement;
    var seen = (window.scrollY + window.innerHeight) / doc.scrollHeight * 100;
    while (marks.length && seen >= marks[0] - 1) {
      gtag('event', 'read_depth', { percent: marks.shift() });
    }
    if (!marks.length) window.removeEventListener('scroll', onScroll);
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(measure); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();
