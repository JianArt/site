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
    const m = (css || '').match(/[\d.]+/g) || [];
    if (m.length < 3) return null;
    const [r, g, b] = m.map(Number);
    return { rgb: [r, g, b], a: m.length > 3 ? Number(m[3]) : 1 };
  };

  // Text sits on its nearest opaque ancestor background, not necessarily the
  // page background — a gold button reads as dark-on-gold, not dark-on-black.
  const backdrop = (el) => {
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const p = parse(getComputedStyle(node).backgroundColor);
      if (p && p.a >= 0.99) return p.rgb;
    }
    return BG;
  };

  const over = (css, bg) => {
    const p = parse(css);
    if (!p) return bg;
    return [0, 1, 2].map((i) => Math.round(p.rgb[i] * p.a + bg[i] * (1 - p.a)));
  };

  const contrast = (fg, el) => {
    const bg = backdrop(el);
    const a = lum(over(fg, bg)) + 0.05;
    const b = lum(bg) + 0.05;
    return Math.round((Math.max(a, b) / Math.min(a, b)) * 100) / 100;
  };

  // Characters per rendered line. Line count comes from box height over
  // line-height: range rects split on nested inline spans, which inflates the
  // count and makes long lines look short. Whitespace is collapsed so source
  // indentation is not counted as text.
  const measure = (el) => {
    const s = getComputedStyle(el);
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return { lines: 0, chars: 0 };

    const box = el.getBoundingClientRect();
    const inner = box.height - parseFloat(s.paddingTop || 0) - parseFloat(s.paddingBottom || 0);
    const lh = parseFloat(s.lineHeight);

    let lines;
    if (lh > 0 && inner > 0) {
      lines = Math.max(1, Math.round(inner / lh));
    } else {
      const r = document.createRange();
      r.selectNodeContents(el);
      const tops = new Set(
        Array.from(r.getClientRects())
          .filter((x) => x.width > 1 && x.height > 1)
          .map((x) => Math.round(x.top))
      );
      lines = Math.max(1, tops.size);
    }
    return { lines, chars: Math.round(text.length / lines) };
  };

  const SELECTORS = [
    'h1', '.about-hero .statement', '.cta h2', '.section-heading', 'h3',
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
        contrast: contrast(s.color, el),
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
  // Width-constrained blocks only, detected via `max-width` being set at all —
  // parsing it as a number silently skips computed values like `min(1080px, 100%)`.
  document.querySelectorAll('.container > *, .container').forEach((el) => {
    const s = getComputedStyle(el);
    if (s.maxWidth === 'none') return;
    if (s.display.startsWith('inline')) return;
    const avail = el.parentElement ? el.parentElement.getBoundingClientRect().width : vw;
    const used = Math.round(el.getBoundingClientRect().width);
    if (avail > 0 && used / avail < 0.6) {
      voids.push({ cls: el.className || el.tagName, maxWidth: s.maxWidth, used, avail: Math.round(avail), fill: Math.round((used / avail) * 100) + '%' });
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
