/*
 * Typography and layout audit for jianart.com.
 * Paste the whole IIFE into browser_cdp Runtime.evaluate with returnByValue: true.
 * Returns JSON: viewport, cssBytes, headings, type[], overflow[], smallTargets[], voids[].
 */
(() => {
  const BG = [10, 9, 8];

  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const parse = (css) => {
    const m = css.match(/[\d.]+/g) || [];
    const [r, g, b] = m.map(Number);
    const a = m.length > 3 ? Number(m[3]) : 1;
    return [0, 1, 2].map((i) => Math.round([r, g, b][i] * a + BG[i] * (1 - a)));
  };

  const contrast = (fg) => {
    const a = lum(parse(fg)) + 0.05;
    const b = lum(BG) + 0.05;
    return Math.round((Math.max(a, b) / Math.min(a, b)) * 100) / 100;
  };

  // Characters per rendered line, measured from real line boxes.
  const measure = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const lines = Array.from(r.getClientRects()).filter((x) => x.width > 1 && x.height > 1);
    const text = (el.textContent || '').trim();
    if (!lines.length || !text) return { lines: 0, chars: 0 };
    return { lines: lines.length, chars: Math.round(text.length / lines.length) };
  };

  const SELECTORS = [
    'h1', 'h1.statement', '.cta h2', '.section-heading', 'h3',
    '.hero-lede', '.cta-lede', '.about-bio p', '.feature p', '.notables-grid p',
    '.copyright', '.nav-links a', '.nav-brand span', '.btn', '.project-card-label span'
  ];

  const type = [];
  for (const sel of SELECTORS) {
    document.querySelectorAll(sel).forEach((el, i) => {
      if (i > 1) return; // first two of each kind is enough
      const s = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const m = measure(el);
      type.push({
        sel,
        text: (el.textContent || '').trim().slice(0, 42),
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        color: s.color,
        contrast: contrast(s.color),
        maxWidth: s.maxWidth,
        renderedWidth: Math.round(box.width),
        renderedLines: m.lines,
        charsPerLine: m.chars
      });
    });
  }

  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
    tag: h.tagName,
    cls: h.className || null,
    text: (h.textContent || '').trim().slice(0, 48)
  }));

  const vw = document.documentElement.clientWidth;
  const overflow = [];
  const smallTargets = [];
  const voids = [];

  document.querySelectorAll('body *').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return;
    if (b.right > vw + 1 || b.left < -1) {
      overflow.push({ tag: el.tagName, cls: el.className || null, left: Math.round(b.left), right: Math.round(b.right) });
    }
    if (el.matches('a,button,[role=button]') && b.height > 0 && b.height < 44) {
      smallTargets.push({ tag: el.tagName, cls: el.className || null, height: Math.round(b.height), text: (el.textContent || '').trim().slice(0, 24) });
    }
  });

  // Content that occupies less than 60% of its container's width leaves a large void.
  document.querySelectorAll('.container > *, .container').forEach((el) => {
    const s = getComputedStyle(el);
    const mw = parseFloat(s.maxWidth);
    if (!mw || Number.isNaN(mw)) return;
    const avail = el.parentElement ? el.parentElement.getBoundingClientRect().width : vw;
    const used = Math.round(el.getBoundingClientRect().width);
    if (avail > 0 && used / avail < 0.6) {
      voids.push({ cls: el.className || el.tagName, used, avail: Math.round(avail), fill: Math.round((used / avail) * 100) + '%' });
    }
  });

  return JSON.stringify({
    url: location.href,
    viewport: { w: vw, h: window.innerHeight, dpr: window.devicePixelRatio },
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    headings,
    type,
    overflow: overflow.slice(0, 20),
    smallTargets: smallTargets.slice(0, 20),
    voids: voids.slice(0, 20)
  }, null, 1);
})();
