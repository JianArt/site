(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'dot-links';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var gap = 16;
  var origin = gap / 2;
  var links = [];
  var maxLinksNormal = 64;
  var maxLinksFinale = 80;
  var maxLinks = maxLinksNormal;
  var cols = 0;
  var rows = 0;
  var w = 0;
  var h = 0;
  var dpr = 1;
  var lastLayoutW = 0;
  var lastSpawn = 0;
  var nextSpawnIn = 0;
  var running = true;
  var start = performance.now();
  var recentTypes = [];
  var showActive = false;
  var actsSinceFinale = 0;
  var finaleActive = false;
  var finaleUntil = 0;
  var postFinale = false;
  var stage = {
    left: 0, top: 0, right: 0, bottom: 0,
    width: 0, height: 0,
    cx: 0, cy: 0,
    ready: false
  };
  var actCenter = null;
  var lockedCenter = null;
  var actPlaylist = [];

  function shuffleInPlace(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function syncViewport() {
    var vv = window.visualViewport;
    w = Math.max(1, Math.round((vv && vv.width) || window.innerWidth));
    h = Math.max(1, Math.round((vv && vv.height) || window.innerHeight));
    var nextGap = w < 480 ? 12 : w < 800 ? 14 : 16;
    if (nextGap !== gap) {
      gap = nextGap;
      origin = gap / 2;
    }
  }

  function resetActsForReflow() {
    links.length = 0;
    actCenter = null;
    lockedCenter = null;
    showActive = false;
    finaleActive = false;
    postFinale = false;
    actPlaylist = [];
    maxLinks = maxLinksNormal;
    nextSpawnIn = 180;
    lastSpawn = performance.now();
  }
  var parallaxFactor = 0.4;
  var parallaxY = 0;

  function updateParallax() {
    var sy = window.scrollY || document.documentElement.scrollTop || 0;
    parallaxY = -sy * parallaxFactor;
    document.documentElement.style.setProperty('--parallax-y', parallaxY + 'px');
  }

  function findHero() {
    return document.querySelector('main > .hero') ||
      document.querySelector('main .hero') ||
      document.querySelector('main > section.container');
  }

  function updateStage() {
    var hero = findHero();
    var nav = document.querySelector('.nav');
    if (!hero) {
      stage.ready = false;
      lockedCenter = null;
      return;
    }

    var hr = hero.getBoundingClientRect();
    var title = hero.querySelector('h1');
    var titleBox = title ? title.getBoundingClientRect() : null;
    var navBottom = nav ? nav.getBoundingClientRect().bottom : 0;

    /* Full-viewport width; vertical band stays between nav and title */
    var fieldTop = Math.max(hr.top, navBottom) + (w < 480 ? 10 : 16);
    var fieldBottom = titleBox
      ? Math.min(titleBox.top - (w < 480 ? 12 : 20), hr.bottom - 8)
      : hr.bottom - 24;
    var fieldH = Math.max(0, fieldBottom - fieldTop);

    /* Narrow screens: shorter aspect so charts keep usable height */
    var aspectMin = w < 480 ? 1.5 : w < 800 ? 1.85 : 2.4;
    var minH = w < 480 ? 44 : 52;
    stage.left = 0;
    stage.right = w;
    stage.width = w;
    stage.height = Math.min(fieldH * 0.9, Math.max(minH, stage.width / aspectMin));
    if (fieldH > 0) {
      /* All viewports: occupy ~40% of the viewport within the hero band */
      var bandTarget = h * 0.4;
      stage.height = Math.max(minH, Math.min(fieldH * 0.94, bandTarget));
    }
    if (stage.height > fieldH * 0.92 && fieldH > 0) {
      stage.height = Math.max(minH * 0.85, fieldH * 0.92);
    }
    stage.cx = w / 2;
    stage.cy = (fieldTop + fieldBottom) / 2;
    stage.top = stage.cy - stage.height / 2;
    stage.bottom = stage.cy + stage.height / 2;

    stage.ready =
      stage.height > (w < 480 ? 36 : 44) &&
      stage.width > 80 &&
      stage.bottom > 16 &&
      stage.top < h - 16;

    /* Keep center frozen while an act is on screen — prevents vertical jitter */
    if (stage.ready && !(links.length > 0 && lockedCenter)) {
      var col = Math.round((stage.cx - origin) / gap);
      var row = Math.round((stage.cy - origin) / gap);
      lockedCenter = {
        col: col,
        row: row,
        x: origin + col * gap,
        y: origin + row * gap
      };
    } else if (!stage.ready) {
      lockedCenter = null;
    }
  }

  function resize() {
    var prevW = lastLayoutW;
    var prevGap = gap;
    syncViewport();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / gap) + 2;
    rows = Math.ceil(h / gap) + 2;
    updateStage();

    /* Reflow acts when layout meaningfully changes */
    if (prevW && (Math.abs(w - prevW) > 20 || prevGap !== gap)) {
      resetActsForReflow();
    }
    lastLayoutW = w;
  }

  function inStage(x, y) {
    if (!stage.ready) return false;
    return x >= stage.left && x <= stage.right && y >= stage.top && y <= stage.bottom;
  }

  function stageFalloff(x, y) {
    if (!stage.ready) return 0;
    if (!inStage(x, y)) return 0;
    /* Soft elliptical vignette — keep side axes readable (no CSS mask) */
    var dx = (x - stage.cx) / Math.max(1, stage.width * 0.62);
    var dy = (y - stage.cy) / Math.max(1, stage.height * 0.62);
    var r = Math.sqrt(dx * dx + dy * dy);
    var vig = 1;
    if (r > 0.55) {
      var t = Math.min(1, (r - 0.55) / 0.7);
      vig = Math.max(0.42, Math.pow(1 - t, 1.35));
    }
    /* Extra soft clip at the stage top/bottom only */
    var padY = Math.min(28, stage.height * 0.14);
    var fy = 1;
    if (y < stage.top + padY) fy = (y - stage.top) / padY;
    else if (y > stage.bottom - padY) fy = (stage.bottom - y) / padY;
    return Math.max(0, Math.min(1, vig * Math.max(0, Math.min(1, fy))));
  }

  function inBounds(col, row, drift) {
    var p = gridPoint(col, row);
    return inStage(p.x, p.y);
  }

  function liveCenter(drift) {
    return lockedCenter;
  }

  function gridPoint(col, row, drift) {
    return {
      x: origin + col * gap,
      y: origin + row * gap
    };
  }

  function resolvePoint(ox, oy, drift, scale, center) {
    var c = center || liveCenter();
    if (!c) return { x: -9999, y: -9999 };
    var s = scale == null ? 1 : scale;
    return gridPoint(c.col + Math.round(ox * s), c.row + Math.round(oy * s));
  }

  function driftAt(now) {
    return 0;
  }

  function randInt(min, max) {
    if (max < min) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* Varied series heights — walk, independent, or jump modes */
  function randomSeriesYs(count, minY, maxY) {
    var ys = [];
    if (maxY < minY) {
      for (var z = 0; z < count; z++) ys.push(minY);
      return ys;
    }
    var mode = Math.random();
    var y = randInt(minY, maxY);
    for (var i = 0; i < count; i++) {
      if (mode < 0.33) {
        y = randInt(minY, maxY);
      } else if (mode < 0.66) {
        y = Math.max(minY, Math.min(maxY, y + pick([-3, -2, -1, 1, 2, 3])));
      } else {
        if (Math.random() < 0.25) y = randInt(minY, maxY);
        else y = Math.max(minY, Math.min(maxY, y + pick([-2, -1, 0, 0, 1, 2])));
      }
      ys.push(y);
    }
    /* Occasionally reverse or shuffle local runs for more surprise */
    if (Math.random() < 0.2) ys.reverse();
    return ys;
  }

  function markSeriesPoints(points, now, delay, chance) {
    var next = delay;
    if (!points || !points.length) return next;

    function markAt(i, peak) {
      addLink(points[i].col, points[i].row, points[i].col, points[i].row, now, next, {
        peak: peak != null ? peak : (0.5 + Math.random() * 0.12),
        point: true
      });
      next += 8 + Math.floor(Math.random() * 18);
    }

    /* Always mark endpoints first so the right side never goes missing */
    markAt(0, 0.58);
    if (points.length > 1) markAt(points.length - 1, 0.58);

    for (var i = 1; i < points.length - 1; i++) {
      if (Math.random() > chance) continue;
      markAt(i);
    }
    return next;
  }

  function addLink(col1, row1, col2, row2, now, delay, opts) {
    if (links.length >= maxLinks) return false;
    opts = opts || {};
    if (col1 === col2 && row1 === row2 && !opts.point) return false;
    if (!actCenter) return false;
    var c = actCenter;
    var peakBase = opts.peak != null ? opts.peak : 0.42;
    var link = {
      ox1: col1 - c.col,
      oy1: row1 - c.row,
      ox2: col2 - c.col,
      oy2: row2 - c.row,
      refSpanW: c.metrics.spanW,
      refSpanH: c.metrics.spanH,
      born: now + (delay || 0),
      life: opts.life || (5600 + Math.random() * 2200),
      peak: peakBase * (0.9 + Math.random() * 0.25),
      drawEnd: opts.drawEnd || (0.2 + Math.random() * 0.1),
      fadeStart: opts.fadeStart || (0.72 + Math.random() * 0.1),
      curve: opts.curve || null,
      arcLift: opts.arcLift || 0,
      finale: !!opts.finale,
      weight: opts.weight || 1,
      point: !!opts.point
    };
    if (opts.curve === 'catmull' && opts.prev && opts.next) {
      link.ox0 = opts.prev.col - c.col;
      link.oy0 = opts.prev.row - c.row;
      link.ox3 = opts.next.col - c.col;
      link.oy3 = opts.next.row - c.row;
    }
    links.push(link);
    return true;
  }

  function stageCells(drift) {
    var c = liveCenter();
    if (!c || !stage.ready) {
      return {
        minCol: 0, maxCol: 10, minRow: 0, maxRow: 8,
        width: 10, height: 8, spanW: 8, spanH: 4, radius: 3, radiusX: 4, radiusY: 2,
        cx: 5, cy: 4
      };
    }

    /* Pin cell grid to full stage width — landscape on desktop, taller on mobile */
    var minCol = Math.ceil((stage.left - origin) / gap);
    var maxCol = Math.floor((stage.right - origin) / gap);
    var minRow = Math.ceil((stage.top - origin) / gap);
    var maxRow = Math.floor((stage.bottom - origin) / gap);
    if (maxCol <= minCol) maxCol = minCol + Math.max(6, Math.floor(w / gap) - 1);
    if (maxRow <= minRow) maxRow = minRow + 3;

    var width = maxCol - minCol;
    var height = maxRow - minRow;
    var halfW = Math.max(4, Math.floor(width / 2));
    var halfH = Math.max(2, Math.floor(height / 2));
    var cellAspect = w < 480 ? 1.45 : w < 800 ? 1.8 : 2.2;
    if (halfW / Math.max(1, halfH) < cellAspect) {
      halfH = Math.max(2, Math.floor(halfW / cellAspect));
    }
    var spanW = Math.max(6, width);
    var spanH = Math.max(3, Math.min(halfH * 2, Math.floor(spanW / cellAspect)));
    halfH = Math.max(2, Math.floor(spanH / 2));
    height = halfH * 2;
    spanH = height;
    minRow = c.row - halfH;
    maxRow = c.row + halfH;
    var radiusX = Math.max(3, Math.floor(spanW / 2));
    var radiusY = Math.max(2, Math.floor(spanH / 2));
    var radius = Math.min(radiusX, radiusY);

    return {
      minCol: minCol,
      maxCol: maxCol,
      minRow: minRow,
      maxRow: maxRow,
      width: spanW,
      height: height,
      spanW: spanW,
      spanH: spanH,
      radius: radius,
      radiusX: radiusX,
      radiusY: radiusY,
      cx: c.col,
      cy: c.row
    };
  }

  function beginAct(drift) {
    updateStage();
    /* Force a fresh center lock at the start of each act */
    if (stage.ready) {
      var col = Math.round((stage.cx - origin) / gap);
      var row = Math.round((stage.cy - origin) / gap);
      lockedCenter = {
        col: col,
        row: row,
        x: origin + col * gap,
        y: origin + row * gap
      };
    }
    var s = stageCells();
    actCenter = { col: s.cx, row: s.cy, metrics: s };
    return actCenter;
  }

  function randomAnchor(drift) {
    if (!stage.ready) return null;
    var s = actCenter ? actCenter.metrics : stageCells(drift);
    var hub = actCenter || { col: s.cx, row: s.cy };
    for (var tries = 0; tries < 20; tries++) {
      var col = hub.col + randInt(-1, 1);
      var row = hub.row + randInt(-1, 1);
      if (inBounds(col, row, drift)) return { col: col, row: row, metrics: s };
    }
    if (inBounds(s.cx, s.cy, drift)) return { col: s.cx, row: s.cy, metrics: s };
    return null;
  }

  function originForChart(drift) {
    var s = actCenter ? actCenter.metrics : stageCells(drift);
    var hub = actCenter || { col: s.cx, row: s.cy };
    var col = s.minCol;
    var row = hub.row + Math.floor(s.spanH / 2);
    if (!inBounds(col, row, drift)) {
      col = s.minCol;
      row = s.maxRow - 1;
    }
    if (!inBounds(col, row, drift)) return null;
    return { col: col, row: row, metrics: s };
  }

  /* Evenly space columns across [startCol, endCol] — no leftover gap on the right */
  function evenCol(startCol, endCol, i, count) {
    if (count <= 1) return startCol;
    return startCol + Math.round(i * (endCol - startCol) / (count - 1));
  }

  function evenRow(startRow, endRow, i, count) {
    if (count <= 1) return startRow;
    return startRow + Math.round(i * (endRow - startRow) / (count - 1));
  }

  /* Full-width series — always flush from padded edges with even spacing */
  function seriesLayout(drift, minPts, maxPts, density) {
    var s = actCenter ? actCenter.metrics : stageCells(drift);
    var hub = actCenter || { col: s.cx, row: s.cy };
    var baseRow = hub.row + Math.floor(s.spanH / 2);
    if (!inBounds(hub.col, baseRow, drift)) {
      baseRow = s.maxRow - 1;
    }
    if (!inBounds(hub.col, baseRow, drift)) return null;

    /* Inset 1 col from each edge so endpoints sit inside the soft falloff */
    var edgePad = (s.maxCol - s.minCol) > 10 ? 1 : 0;
    var startCol = s.minCol + edgePad;
    var endCol = s.maxCol - edgePad;
    var spanUsed = Math.max(1, endCol - startCol);
    var fitMax = Math.min(maxPts, spanUsed + 1);
    var fitMin = Math.min(minPts, fitMax);
    /* Mobile: higher density divisor → fewer points under the link budget */
    var dens = density || 1.15;
    if (w < 480) dens *= 1.35;
    else if (w < 800) dens *= 1.15;
    var pts = Math.max(fitMin, Math.min(fitMax, Math.round(spanUsed / dens) + 1));
    /* Approximate step for callers that still read it — spacing itself uses evenCol */
    var step = Math.max(1, Math.round(spanUsed / Math.max(1, pts - 1)));

    return {
      startCol: startCol,
      endCol: endCol,
      baseRow: baseRow,
      pts: pts,
      step: step,
      spanUsed: spanUsed,
      metrics: s,
      hub: hub,
      colAt: function (i) { return evenCol(startCol, endCol, i, pts); }
    };
  }

  function withRaisedBudget(n, fn) {
    var prev = maxLinks;
    maxLinks = Math.max(maxLinks, n);
    var result = fn();
    maxLinks = prev;
    return result;
  }

  /* Prefer alternating silhouettes so consecutive acts don't look alike */
  function buildSilhouettePlaylist(catalog) {
    var pool = catalog.slice();
    shuffleInPlace(pool);
    var ordered = [];
    var lastSil = recentTypes.length
      ? (catalog.filter(function (c) { return c.name === recentTypes[recentTypes.length - 1]; })[0] || {}).sil
      : null;
    while (pool.length) {
      var idx = 0;
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].sil !== lastSil) { idx = i; break; }
      }
      var next = pool.splice(idx, 1)[0];
      ordered.push(next);
      lastSil = next.sil;
    }
    return ordered;
  }

  function sortClockwise(hub, nodes) {
    return nodes.slice().sort(function (a, b) {
      return Math.atan2(a.row - hub.row, a.col - hub.col) -
        Math.atan2(b.row - hub.row, b.col - hub.col);
    });
  }

  function spokeCandidates(radius) {
    var r = radius;
    var mid = Math.max(2, Math.round(r * 0.72));
    var near = Math.max(1, Math.round(r * 0.45));
    return [
      [r, 0], [-r, 0], [0, r], [0, -r],
      [r, r], [r, -r], [-r, r], [-r, -r],
      [r, mid], [r, -mid], [-r, mid], [-r, -mid],
      [mid, r], [mid, -r], [-mid, r], [-mid, -r],
      [r, near], [-r, near], [near, r], [near, -r],
      [-near, r], [-near, -r], [r, -near], [-r, -near]
    ];
  }

  function withArc(opts, lift) {
    opts = opts || {};
    opts.curve = 'arc';
    opts.arcLift = lift != null ? lift : pick([-18, -26, -34, 18, 26, 34]);
    return opts;
  }

  function withCatmull(opts, prev, next) {
    opts = opts || {};
    opts.curve = 'catmull';
    opts.prev = prev;
    opts.next = next;
    return opts;
  }

  /* —— Network forms —— */

  function spawnTree(now, drift) {
    var s = stageCells(drift);
    var root = { col: s.cx, row: s.minRow + Math.max(1, Math.floor(s.height * 0.12)) };
    if (!inBounds(root.col, root.row, drift)) root = randomAnchor(drift);
    if (!root) return false;

    var levelGap = Math.max(3, Math.round(s.spanH / 3));
    var leafSpread = Math.max(3, Math.round(s.spanW / 4));
    var delay = 0;
    var mid = [];
    var midCount = 3;
    for (var i = 0; i < midCount; i++) {
      var mc = Math.round(root.col + (i - 1) * leafSpread);
      var mr = root.row + levelGap;
      if (!inBounds(mc, mr, drift)) continue;
      addLink(root.col, root.row, mc, mr, now, delay, withArc({ peak: 0.45 }, pick([-20, -28, 16])));
      mid.push({ col: mc, row: mr });
      delay += 70;
    }
    if (mid.length < 2) return false;
    for (var m = 0; m < mid.length; m++) {
      var parent = mid[m];
      var kids = 3;
      var kidSpread = Math.max(2, Math.round(leafSpread * 0.7));
      for (var k = 0; k < kids; k++) {
        var kc = Math.round(parent.col + (k - 1) * kidSpread);
        var kr = parent.row + levelGap;
        if (!inBounds(kc, kr, drift)) continue;
        addLink(parent.col, parent.row, kc, kr, now, delay, withArc({ peak: 0.38 }, pick([-16, -24, 14])));
        delay += 55;
      }
    }
    return true;
  }

  function spawnArcDiagram(now, drift) {
    /* Nodes on a baseline; true arc curves between them */
    var s = stageCells(drift);
    var startCol = s.minCol;
    var endCol = s.maxCol;
    var spanUsed = Math.max(1, endCol - startCol);
    var count = Math.max(7, Math.min(w < 480 ? 10 : 14, Math.round(spanUsed / 3) + 1));
    var step = Math.max(2, Math.floor(spanUsed / Math.max(1, count - 1)));
    count = Math.floor(spanUsed / step) + 1;
    var row = Math.min(s.maxRow, s.cy + Math.floor(s.spanH * 0.35));
    var nodes = [];
    var delay = 0;
    for (var i = 0; i < count; i++) {
      var c = evenCol(startCol, endCol, i, count);
      nodes.push({ col: c, row: row });
    }
    addLink(nodes[0].col, row, nodes[nodes.length - 1].col, row, now, delay, { peak: 0.2 });
    delay += 20;
    for (var n = 0; n < nodes.length; n++) {
      addLink(nodes[n].col, nodes[n].row, nodes[n].col, nodes[n].row, now, delay, { peak: 0.5, point: true });
      delay += 8;
    }
    var arcsMade = 0;
    var tries = Math.min(14, count * 2);
    return withRaisedBudget(72, function () {
      for (var t = 0; t < tries; t++) {
        var a = randInt(0, nodes.length - 1);
        var b = randInt(0, nodes.length - 1);
        if (Math.abs(b - a) < 2) continue;
        var lo = Math.min(a, b);
        var hi = Math.max(a, b);
        var liftPx = -Math.max(14, Math.min(42, (hi - lo) * 6 + 10));
        addLink(
          nodes[lo].col, nodes[lo].row,
          nodes[hi].col, nodes[hi].row,
          now, delay,
          withArc({ peak: 0.42 }, liftPx)
        );
        delay += 18;
        arcsMade++;
      }
      return arcsMade >= 4;
    });
  }

  function spawnForceCluster(now, drift) {
    var s = stageCells(drift);
    var hubs = [
      { col: s.cx - Math.floor(s.spanW * 0.22), row: s.cy },
      { col: s.cx + Math.floor(s.spanW * 0.22), row: s.cy },
      { col: s.cx, row: s.cy - Math.floor(s.spanH * 0.2) }
    ].filter(function (h) { return inBounds(h.col, h.row, drift); });
    if (hubs.length < 2) return false;

    var delay = 0;
    var spokeR = Math.max(4, Math.round(s.radius * 0.7));
    for (var h = 0; h < hubs.length - 1; h++) {
      addLink(hubs[h].col, hubs[h].row, hubs[h + 1].col, hubs[h + 1].row, now, delay,
        withArc({ peak: 0.4 }, pick([-24, -32, 22])));
      delay += 80;
    }
    if (hubs.length === 3) {
      addLink(hubs[0].col, hubs[0].row, hubs[2].col, hubs[2].row, now, delay,
        withArc({ peak: 0.32 }, pick([-20, 18])));
      delay += 70;
    }
    for (var i = 0; i < hubs.length; i++) {
      var hub = hubs[i];
      var spokes = sortClockwise(hub, spokeCandidates(spokeR).map(function (o) {
        return { col: hub.col + o[0], row: hub.row + o[1] };
      }).filter(function (p) { return inBounds(p.col, p.row, drift); }));
      var n = Math.min(spokes.length, randInt(7, 11));
      for (var sp = 0; sp < n; sp++) {
        var spokeOpts = { peak: 0.38 };
        if (Math.random() < 0.55) spokeOpts = withArc(spokeOpts, pick([-14, -22, 14, 22]));
        addLink(hub.col, hub.row, spokes[sp].col, spokes[sp].row, now, delay, spokeOpts);
        delay += 40;
      }
    }
    return true;
  }

  function spawnFlow(now, drift) {
    var s = stageCells(drift);
    var cur = {
      col: s.cx - Math.floor(s.spanW / 2),
      row: s.cy
    };
    if (!inBounds(cur.col, cur.row, drift)) cur = randomAnchor(drift);
    if (!cur) return false;

    var delay = 0;
    var steps = Math.max(5, Math.round(s.spanW / 2.2));
    var stepX = Math.max(2, Math.round(s.spanW / steps));
    var ok = 0;
    for (var i = 0; i < steps; i++) {
      var next = {
        col: cur.col + stepX,
        row: cur.row + pick([-2, -1, 0, 0, 1, 2])
      };
      if (!inBounds(next.col, next.row, drift)) break;
      addLink(cur.col, cur.row, next.col, next.row, now, delay,
        withArc({ peak: 0.42 }, pick([-16, -24, 16, 24])));
      delay += 55;
      ok++;
      if (Math.random() > 0.3) {
        var side = {
          col: cur.col + pick([0, 1]),
          row: cur.row + pick([-3, -4, 3, 4])
        };
        if (inBounds(side.col, side.row, drift)) {
          addLink(cur.col, cur.row, side.col, side.row, now, delay,
            withArc({ peak: 0.28 }, pick([-28, -36, 28, 36])));
          delay += 35;
        }
      }
      cur = next;
    }
    return ok >= 4;
  }

  function spawnBipartite(now, drift) {
    var s = stageCells(drift);
    var leftCount = Math.max(4, Math.min(6, Math.round(s.spanH / 2)));
    var rightCount = leftCount;
    var colGap = s.spanW;
    var rowGap = Math.max(2, Math.floor(s.spanH / (leftCount - 1)));
    var leftCol = s.cx - Math.floor(colGap / 2);
    var rightCol = s.cx + Math.floor(colGap / 2);
    var topRow = s.cy - Math.floor(((leftCount - 1) * rowGap) / 2);
    var left = [];
    var right = [];
    for (var i = 0; i < leftCount; i++) {
      var lr = topRow + i * rowGap;
      if (inBounds(leftCol, lr, drift)) left.push({ col: leftCol, row: lr });
      if (inBounds(rightCol, lr, drift)) right.push({ col: rightCol, row: lr });
    }
    if (left.length < 3 || right.length < 3) return false;
    var delay = 0;
    var matches = Math.max(7, left.length + 3);
    var used = {};
    var made = 0;
    while (made < matches) {
      var L = pick(left);
      var R = pick(right);
      var id = L.row + '>' + R.row;
      if (used[id]) { if (Object.keys(used).length > 20) break; continue; }
      used[id] = true;
      addLink(L.col, L.row, R.col, R.row, now, delay, {
        peak: 0.38,
        curve: 'arc',
        arcLift: pick([-22, -32, -40, 18, 28, 36])
      });
      delay += 45;
      made++;
    }
    return made >= 4;
  }

  function spawnSankey(now, drift) {
    var s = stageCells(drift);
    var leftN = Math.max(3, Math.min(5, Math.round(s.spanH / 2.2)));
    var midN = Math.max(3, Math.min(5, leftN + randInt(0, 1)));
    var rightN = Math.max(3, Math.min(5, leftN + randInt(-1, 1)));
    var useFour = false;
    var colL = s.minCol;
    var colR = s.maxCol;
    var colM = s.cx;
    var colM2 = s.cx + Math.floor(s.spanW / 6);
    var spanH = s.spanH;

    function column(col, count) {
      var nodes = [];
      var gapR = count > 1 ? Math.max(2, Math.floor(spanH / (count - 1))) : 0;
      var top = s.cy - Math.floor(((count - 1) * gapR) / 2);
      for (var i = 0; i < count; i++) {
        var r = top + i * gapR;
        if (inBounds(col, r, drift)) nodes.push({ col: col, row: r });
      }
      return nodes;
    }

    var left = column(colL, leftN);
    var mid = column(useFour ? s.cx - Math.floor(s.spanW / 6) : colM, midN);
    var mid2 = useFour ? column(colM2, Math.max(3, midN - 1)) : null;
    var right = column(colR, rightN);
    if (left.length < 2 || mid.length < 2 || right.length < 2) return false;
    if (useFour && (!mid2 || mid2.length < 2)) {
      mid2 = null;
      useFour = false;
      mid = column(colM, midN);
      if (mid.length < 2) return false;
    }

    var delay = 0;
    var made = 0;

    function flowBetween(from, to, chance) {
      var used = {};
      for (var i = 0; i < from.length; i++) {
        var targets = 1;
        for (var t = 0; t < targets; t++) {
          if (Math.random() > chance) continue;
          var dest = to[Math.min(to.length - 1, Math.max(0, i + randInt(-1, 1)))];
          var id = from[i].row + '>' + dest.col + ':' + dest.row;
          if (used[id]) continue;
          used[id] = true;
          addLink(from[i].col, from[i].row, dest.col, dest.row, now, delay, {
            peak: 0.46,
            drawEnd: 0.3
          });
          delay += 48;
          made++;
        }
      }
    }

    function spine(nodes, peak) {
      for (var v = 0; v < nodes.length - 1; v++) {
        addLink(nodes[v].col, nodes[v].row, nodes[v + 1].col, nodes[v + 1].row, now, delay, { peak: peak });
        delay += 16;
      }
    }

    spine(left, 0.12);
    spine(mid, 0.1);
    if (mid2) spine(mid2, 0.1);
    spine(right, 0.12);

    if (useFour && mid2) {
      flowBetween(left, mid, 0.95);
      flowBetween(mid, mid2, 0.9);
      flowBetween(mid2, right, 0.9);
    } else {
      flowBetween(left, mid, 0.95);
      flowBetween(mid, right, 0.9);
    }
    return made >= 5;
  }

  function spawnSunburst(now, drift) {
    var s = stageCells(drift);
    var hub = { col: s.cx, row: s.cy };
    if (!inBounds(hub.col, hub.row, drift)) hub = randomAnchor(drift);
    if (!hub) return false;
    var radius = s.radius;
    var nodes = sortClockwise(hub, spokeCandidates(radius).map(function (o) {
      return { col: hub.col + o[0], row: hub.row + o[1] };
    }).filter(function (p) { return inBounds(p.col, p.row, drift); }));
    if (nodes.length < 6) return false;
    var delay = 0;
    for (var sp = 0; sp < nodes.length; sp++) {
      var spokeOpts = { peak: 0.48 };
      if (Math.random() < 0.4) spokeOpts = withArc(spokeOpts, pick([-12, -18, 12, 18]));
      addLink(hub.col, hub.row, nodes[sp].col, nodes[sp].row, now, delay, spokeOpts);
      delay += 45;
    }
    for (var n = 0; n < nodes.length; n++) {
      var a = nodes[n];
      var b = nodes[(n + 1) % nodes.length];
      var dx = a.col - b.col;
      var dy = a.row - b.row;
      if (Math.sqrt(dx * dx + dy * dy) < radius * 1.45) {
        addLink(a.col, a.row, b.col, b.row, now, delay, withArc({ peak: 0.3 }, pick([-16, -22, 16, 22])));
        delay += 35;
      }
    }
    return true;
  }

  function spawnBarChart(now, drift) {
    var originN = originForChart(drift);
    if (!originN) return false;
    var s = originN.metrics;
    var bars = Math.max(6, Math.min(10, Math.round(s.spanW / 1.6)));
    var maxH = s.spanH;
    var step = Math.max(2, Math.floor(s.spanW / (bars - 1)));
    var delay = 0;
    var endCol = originN.col + (bars - 1) * step;
    if (!inBounds(endCol, originN.row, drift)) return false;

    addLink(originN.col, originN.row, endCol, originN.row, now, delay, { peak: 0.3 });
    delay += 50;

    for (var i = 0; i < bars; i++) {
      var c = originN.col + i * step;
      var ht = randInt(Math.max(2, Math.floor(maxH * 0.2)), maxH);
      if (!inBounds(c, originN.row - ht, drift)) continue;
      addLink(c, originN.row, c, originN.row - ht, now, delay, { peak: 0.5 });
      delay += 50;
    }
    return true;
  }

  function spawnVarianceChart(now, drift) {
    var s = stageCells(drift);
    var startCol = s.minCol;
    var endCol = s.maxCol;
    var spanUsed = Math.max(1, endCol - startCol);
    /* Keep link budget under maxLinks while spanning full width */
    var pts = Math.max(5, Math.min(7, Math.round(spanUsed / 4) + 1));
    var step = Math.max(1, Math.floor(spanUsed / Math.max(1, pts - 1)));
    pts = Math.floor(spanUsed / step) + 1;
    if (pts > 7) {
      pts = 7;
      step = Math.max(1, Math.floor(spanUsed / (pts - 1)));
    }
    startCol = s.minCol;

    var meanRow = s.cy;
    var minR = s.minRow + 1;
    var maxR = s.maxRow - 1;
    var maxSpread = Math.max(2, Math.min(Math.floor(s.spanH / 2), meanRow - minR, maxR - meanRow));
    var delay = 0;
    var means = [];
    var highs = [];
    var lows = [];

    var meanYs = randomSeriesYs(pts, minR + 2, maxR - 2);
    for (var i = 0; i < pts; i++) {
      var c = evenCol(startCol, endCol, i, pts);
      if (!inBounds(c, meanRow, drift)) continue;

      var mean = meanYs[i];
      var spread = randInt(Math.max(2, Math.floor(maxSpread * 0.3)), maxSpread);
      var hi = Math.max(minR, mean - spread);
      var lo = Math.min(maxR, mean + Math.max(1, Math.floor(spread * (0.45 + Math.random() * 0.55))));
      means.push({ col: c, row: mean });
      highs.push({ col: c, row: hi });
      lows.push({ col: c, row: lo });
    }
    if (means.length < 4) return false;

    /* Baseline axis — full series width */
    var baseY = Math.min(maxR, lows[lows.length - 1].row + 1);
    addLink(means[0].col, baseY, means[means.length - 1].col, baseY, now, delay, { peak: 0.18 });
    delay += 30;

    /* Mean line */
    for (var m = 0; m < means.length - 1; m++) {
      addLink(means[m].col, means[m].row, means[m + 1].col, means[m + 1].row, now, delay, { peak: 0.55 });
      delay += 28;
    }

    /* Upper / lower band */
    for (var u = 0; u < highs.length - 1; u++) {
      addLink(highs[u].col, highs[u].row, highs[u + 1].col, highs[u + 1].row, now, delay, { peak: 0.3 });
      delay += 22;
    }
    for (var l = 0; l < lows.length - 1; l++) {
      addLink(lows[l].col, lows[l].row, lows[l + 1].col, lows[l + 1].row, now, delay, { peak: 0.3 });
      delay += 22;
    }

    /* Whiskers + caps at each sample */
    for (var wi = 0; wi < means.length; wi++) {
      addLink(highs[wi].col, highs[wi].row, lows[wi].col, lows[wi].row, now, delay, { peak: 0.42 });
      if (inBounds(highs[wi].col - 1, highs[wi].row, drift) && inBounds(highs[wi].col + 1, highs[wi].row, drift)) {
        addLink(highs[wi].col - 1, highs[wi].row, highs[wi].col + 1, highs[wi].row, now, delay + 10, { peak: 0.36 });
      }
      if (inBounds(lows[wi].col - 1, lows[wi].row, drift) && inBounds(lows[wi].col + 1, lows[wi].row, drift)) {
        addLink(lows[wi].col - 1, lows[wi].row, lows[wi].col + 1, lows[wi].row, now, delay + 14, { peak: 0.36 });
      }
      delay += 32;
    }
    return true;
  }

  function spawnConfidenceBands(now, drift) {
    /* Estimate line with upper/lower confidence envelopes + soft rib fills */
    var layout = seriesLayout(drift, 8, 14, 1.05 + Math.random() * 0.35);
    if (!layout) return false;
    var s = layout.metrics;
    var minY = layout.baseRow - s.spanH;
    var maxY = layout.baseRow - 1;
    if (maxY <= minY + 2) return false;

    var delay = 0;
    var means = [];
    var highs = [];
    var lows = [];
    var ys = randomSeriesYs(layout.pts, minY + 2, maxY - 2);
    var maxSpread = Math.max(2, Math.floor(s.spanH * 0.45));

    for (var i = 0; i < layout.pts; i++) {
      var c = layout.colAt(i);
      var mean = ys[i];
      /* Confidence width drifts slowly — wider uncertainty at the edges sometimes */
      var edge = i / Math.max(1, layout.pts - 1);
      var flare = 0.65 + Math.abs(edge - 0.5) * 0.9 + Math.random() * 0.25;
      var spread = Math.max(1, Math.round(maxSpread * (0.28 + flare * 0.35)));
      var hi = Math.max(minY, mean - spread);
      var lo = Math.min(maxY, mean + spread);
      means.push({ col: c, row: mean });
      highs.push({ col: c, row: hi });
      lows.push({ col: c, row: lo });
    }
    if (means.length < 4) return false;

    addLink(means[0].col, layout.baseRow, means[means.length - 1].col, layout.baseRow, now, delay, { peak: 0.16 });
    delay += 18;

    /* Upper / lower CI outlines */
    for (var u = 0; u < highs.length - 1; u++) {
      addLink(highs[u].col, highs[u].row, highs[u + 1].col, highs[u + 1].row, now, delay, {
        peak: 0.28 + Math.random() * 0.06
      });
      delay += 16 + Math.floor(Math.random() * 10);
    }
    for (var l = 0; l < lows.length - 1; l++) {
      addLink(lows[l].col, lows[l].row, lows[l + 1].col, lows[l + 1].row, now, delay, {
        peak: 0.28 + Math.random() * 0.06
      });
      delay += 16 + Math.floor(Math.random() * 10);
    }

    /* Estimate (mean) line through the band */
    for (var m = 0; m < means.length - 1; m++) {
      addLink(means[m].col, means[m].row, means[m + 1].col, means[m + 1].row, now, delay, {
        peak: 0.54 + Math.random() * 0.08,
        weight: 1.15
      });
      delay += 20 + Math.floor(Math.random() * 12);
    }

    /* Soft vertical ribs to read as a filled confidence band */
    for (var r = 0; r < means.length; r++) {
      if (Math.random() < 0.2) continue;
      addLink(highs[r].col, highs[r].row, lows[r].col, lows[r].row, now, delay, {
        peak: 0.2 + Math.random() * 0.08,
        drawEnd: 0.2
      });
      delay += 10 + Math.floor(Math.random() * 10);
    }

    markSeriesPoints(means, now, delay, 0.4 + Math.random() * 0.35);
    return true;
  }

  function spawnViolinChart(now, drift) {
    var s = stageCells(drift);
    var count = s.spanW >= 14 ? randInt(2, 3) : 1;
    var delay = 0;
    var made = 0;
    var slotW = Math.floor(s.spanW / count);

    for (var v = 0; v < count; v++) {
      var centerCol = s.cx - Math.floor(s.spanW / 2) + Math.floor((v + 0.5) * slotW);
      var top = s.cy - Math.floor(s.spanH / 2);
      var bottom = s.cy + Math.floor(s.spanH / 2);
      var steps = Math.max(8, Math.min(16, bottom - top + 1));
      var maxHalf = Math.max(2, Math.floor(slotW * 0.35));
      var left = [];
      var right = [];

      for (var i = 0; i < steps; i++) {
        var t = i / Math.max(1, steps - 1);
        /* Density bulge — wider mid, tapered ends (classic violin) */
        var bulge = Math.sin(Math.PI * t);
        bulge = Math.pow(bulge, 0.85) * (0.75 + Math.random() * 0.35);
        if (t < 0.12 || t > 0.88) bulge *= 0.35;
        var half = Math.max(1, Math.round(maxHalf * bulge));
        var row = top + Math.round(t * (bottom - top));
        var lc = centerCol - half;
        var rc = centerCol + half;
        if (!inBounds(lc, row, drift) || !inBounds(rc, row, drift)) continue;
        left.push({ col: lc, row: row });
        right.push({ col: rc, row: row });
      }
      if (left.length < 5) continue;

      /* Center spine */
      if (inBounds(centerCol, left[0].row, drift) && inBounds(centerCol, left[left.length - 1].row, drift)) {
        addLink(centerCol, left[0].row, centerCol, left[left.length - 1].row, now, delay, { peak: 0.28 });
        delay += 30;
        made++;
      }

      /* Left / right outlines */
      for (var L = 0; L < left.length - 1; L++) {
        addLink(left[L].col, left[L].row, left[L + 1].col, left[L + 1].row, now, delay,
          withArc({ peak: 0.48 }, pick([-8, -12, 8])));
        delay += 22;
        made++;
      }
      for (var R = 0; R < right.length - 1; R++) {
        addLink(right[R].col, right[R].row, right[R + 1].col, right[R + 1].row, now, delay,
          withArc({ peak: 0.48 }, pick([8, 12, -8])));
        delay += 22;
        made++;
      }

      /* Width ribs — mirrored density samples */
      for (var rib = 1; rib < left.length - 1; rib += 2) {
        addLink(left[rib].col, left[rib].row, right[rib].col, right[rib].row, now, delay, { peak: 0.3 });
        delay += 28;
        made++;
      }

      /* Median tick */
      var mid = left[Math.floor(left.length / 2)];
      var midR = right[Math.floor(right.length / 2)];
      if (mid && midR) {
        addLink(mid.col, mid.row, midR.col, midR.row, now, delay, { peak: 0.55, weight: 1.2 });
        delay += 40;
        made++;
      }
    }

    return made >= 10;
  }

  function spawnDnaChart(now, drift) {
    /* Twin helix across the full stage — straight segments + base-pair rungs */
    return withRaisedBudget(88, function () {
      var s = stageCells(drift);
      var startCol = s.minCol;
      var endCol = s.maxCol;
      var spanUsed = Math.max(1, endCol - startCol);
      var len = Math.max(8, Math.min(w < 480 ? 14 : 22, spanUsed + 1));
      var step = Math.max(1, Math.floor(spanUsed / Math.max(1, len - 1)));
      len = Math.floor(spanUsed / step) + 1;
      var amp = Math.max(2, Math.min(Math.floor(s.spanH / 2), Math.round(s.spanH * 0.42)));
      var cycles = 1.4 + Math.random() * 1.4;
      var phase = Math.random() * Math.PI * 2;
      var delay = 0;
      var strandA = [];
      var strandB = [];

      for (var i = 0; i < len; i++) {
        var t = i / Math.max(1, len - 1);
        var angle = phase + t * Math.PI * 2 * cycles;
        var c = evenCol(startCol, endCol, i, len);
        var rowA = s.cy + Math.round(Math.sin(angle) * amp);
        var rowB = s.cy + Math.round(Math.sin(angle + Math.PI) * amp);
        rowA = Math.max(s.minRow, Math.min(s.maxRow, rowA));
        rowB = Math.max(s.minRow, Math.min(s.maxRow, rowB));
        strandA.push({ col: c, row: rowA });
        strandB.push({ col: c, row: rowB });
      }
      if (strandA.length < 6) return false;

      for (var a = 0; a < strandA.length - 1; a++) {
        addLink(strandA[a].col, strandA[a].row, strandA[a + 1].col, strandA[a + 1].row, now, delay, {
          peak: 0.48 + Math.random() * 0.08
        });
        delay += 16 + Math.floor(Math.random() * 14);
      }
      for (var b = 0; b < strandB.length - 1; b++) {
        addLink(strandB[b].col, strandB[b].row, strandB[b + 1].col, strandB[b + 1].row, now, delay, {
          peak: 0.48 + Math.random() * 0.08
        });
        delay += 16 + Math.floor(Math.random() * 14);
      }

      /* Base-pair rungs — every other, no random skips */
      for (var r = 0; r < strandA.length; r += 2) {
        if (strandA[r].col === strandB[r].col && strandA[r].row === strandB[r].row) continue;
        addLink(strandA[r].col, strandA[r].row, strandB[r].col, strandB[r].row, now, delay, {
          peak: 0.34 + Math.random() * 0.1,
          drawEnd: 0.18
        });
        delay += 14 + Math.floor(Math.random() * 16);
      }

      markSeriesPoints(strandA, now, delay, 0.35);
      markSeriesPoints(strandB, now, delay + 40, 0.35);
      return true;
    });
  }

  function spawnSlopeChart(now, drift) {
    var s = stageCells(drift);
    var left = s.minCol + Math.max(1, Math.floor(s.spanW * 0.12));
    var right = s.maxCol - Math.max(1, Math.floor(s.spanW * 0.12));
    var top = s.minRow + 1;
    var bottom = s.maxRow - 1;
    var n = Math.max(5, Math.min(10, bottom - top));
    var delay = 0;
    addLink(left, top, left, bottom, now, delay, { peak: 0.18 });
    addLink(right, top, right, bottom, now, delay + 10, { peak: 0.18 });
    delay += 24;
    var made = 0;
    for (var i = 0; i < n; i++) {
      var y0 = randInt(top, bottom);
      var y1 = randInt(top, bottom);
      addLink(left, y0, right, y1, now, delay, { peak: 0.42 + Math.random() * 0.12 });
      delay += 16;
      addLink(left, y0, left, y0, now, delay, { peak: 0.5, point: true });
      addLink(right, y1, right, y1, now, delay + 6, { peak: 0.5, point: true });
      delay += 14;
      made++;
    }
    return made >= 4;
  }

  function spawnHorizonChart(now, drift) {
    var s = stageCells(drift);
    var bands = Math.max(2, Math.min(4, Math.floor(s.spanH / 3)));
    var bandH = Math.max(2, Math.floor(s.spanH / bands));
    var top = s.cy - Math.floor(s.spanH / 2);
    var delay = 0;
    var made = 0;
    var layout = seriesLayout(drift, 8, 14, 1.2);
    if (!layout) return false;
    for (var b = 0; b < bands; b++) {
      var lo = top + b * bandH;
      var hi = lo + bandH - 1;
      var ys = randomSeriesYs(layout.pts, lo, hi);
      var pts = [];
      for (var i = 0; i < layout.pts; i++) {
        var c = layout.colAt(i);
        pts.push({ col: c, row: ys[i] });
      }
      addLink(pts[0].col, hi, pts[pts.length - 1].col, hi, now, delay, { peak: 0.12 });
      delay += 10;
      for (var p = 0; p < pts.length - 1; p++) {
        addLink(pts[p].col, pts[p].row, pts[p + 1].col, pts[p + 1].row, now, delay, { peak: 0.4 });
        delay += 12;
        made++;
      }
    }
    return made >= 6;
  }

  function spawnBumpChart(now, drift) {
    var s = stageCells(drift);
    var layout = seriesLayout(drift, 6, 10, 1.4);
    if (!layout) return false;
    var lanes = Math.max(4, Math.min(7, s.spanH));
    var top = layout.baseRow - s.spanH;
    var delay = 0;
    var series = Math.max(3, Math.min(5, lanes - 1));
    var ranks = [];
    for (var sIdx = 0; sIdx < series; sIdx++) {
      ranks[sIdx] = [];
      var r = randInt(0, lanes - 1);
      for (var i = 0; i < layout.pts; i++) {
        r = Math.max(0, Math.min(lanes - 1, r + pick([-1, -1, 0, 0, 1, 1])));
        ranks[sIdx].push(r);
      }
    }
    for (var si = 0; si < series; si++) {
      for (var i = 0; i < layout.pts - 1; i++) {
        var c0 = layout.colAt(i);
        var c1 = layout.colAt(i + 1);
        var y0 = top + ranks[si][i];
        var y1 = top + ranks[si][i + 1];
        addLink(c0, y0, c1, y1, now, delay, { peak: 0.44 });
        delay += 14;
      }
    }
    return true;
  }

  function spawnSparklines(now, drift) {
    var s = stageCells(drift);
    var rows = Math.max(3, Math.min(5, Math.floor(s.spanH / 2)));
    var band = Math.max(2, Math.floor(s.spanH / rows));
    var top = s.cy - Math.floor(s.spanH / 2);
    var delay = 0;
    var made = 0;
    var pts = Math.max(8, Math.min(14, Math.round(s.spanW / 1.5)));
    var step = Math.max(1, Math.floor(s.spanW / Math.max(1, pts - 1)));
    for (var r = 0; r < rows; r++) {
      var lo = top + r * band;
      var hi = lo + band - 1;
      var mid = Math.round((lo + hi) / 2);
      var ys = randomSeriesYs(pts, lo, hi);
      var startCol = s.minCol;
      for (var i = 0; i < pts - 1; i++) {
        var c0 = evenCol(startCol, s.maxCol, i, pts);
        var c1 = evenCol(startCol, s.maxCol, i + 1, pts);
        addLink(c0, ys[i], c1, ys[i + 1], now, delay, { peak: 0.42 });
        delay += 10;
        made++;
      }
      addLink(s.minCol, mid, s.maxCol, mid, now, delay, { peak: 0.1 });
      delay += 12;
    }
    return made >= 6;
  }

  function spawnDotPlot(now, drift) {
    var s = stageCells(drift);
    var rows = Math.max(5, Math.min(9, s.spanH));
    var step = Math.max(1, Math.floor(s.spanH / Math.max(1, rows - 1)));
    rows = Math.floor(s.spanH / step) + 1;
    var startRow = s.cy - Math.floor(((rows - 1) * step) / 2);
    var baseCol = s.minCol;
    var delay = 0;
    addLink(baseCol, startRow, baseCol, startRow + (rows - 1) * step, now, delay, { peak: 0.2 });
    delay += 16;
    addLink(baseCol, startRow + (rows - 1) * step, s.maxCol, startRow + (rows - 1) * step, now, delay, { peak: 0.16 });
    delay += 18;
    for (var i = 0; i < rows; i++) {
      var r = startRow + i * step;
      var tip = baseCol + randInt(Math.floor(s.spanW * 0.2), s.spanW);
      if (tip > s.maxCol) tip = s.maxCol;
      addLink(baseCol, r, tip, r, now, delay, { peak: 0.28, drawEnd: 0.15 });
      delay += 10;
      addLink(tip, r, tip, r, now, delay, { peak: 0.55, point: true });
      delay += 14;
    }
    return true;
  }

  function spawnDumbbell(now, drift) {
    var s = stageCells(drift);
    var rows = Math.max(4, Math.min(8, s.spanH));
    var step = Math.max(1, Math.floor(s.spanH / Math.max(1, rows - 1)));
    rows = Math.floor(s.spanH / step) + 1;
    var startRow = s.cy - Math.floor(((rows - 1) * step) / 2);
    var delay = 0;
    for (var i = 0; i < rows; i++) {
      var r = startRow + i * step;
      var a = s.minCol + randInt(0, Math.floor(s.spanW * 0.45));
      var b = s.minCol + randInt(Math.floor(s.spanW * 0.5), s.spanW);
      if (b > s.maxCol) b = s.maxCol;
      if (a >= b) { var tmp = a; a = Math.max(s.minCol, b - 3); b = tmp; }
      addLink(a, r, b, r, now, delay, { peak: 0.4 });
      delay += 12;
      addLink(a, r, a, r, now, delay, { peak: 0.55, point: true });
      addLink(b, r, b, r, now, delay + 6, { peak: 0.55, point: true });
      delay += 16;
    }
    return true;
  }

  function spawnRadarChart(now, drift) {
    var s = stageCells(drift);
    var hub = { col: s.cx, row: s.cy };
    var spokes = Math.max(5, Math.min(8, 4 + Math.floor(s.spanW / 6)));
    var rx = Math.max(4, Math.floor(s.spanW * 0.48));
    var ry = Math.max(2, Math.floor(s.spanH * 0.42));
    var delay = 0;
    var ring = [];
    for (var i = 0; i < spokes; i++) {
      var ang = (Math.PI * 2 * i) / spokes - Math.PI / 2;
      var c = hub.col + Math.round(Math.cos(ang) * rx);
      var r = hub.row + Math.round(Math.sin(ang) * ry);
      c = Math.max(s.minCol, Math.min(s.maxCol, c));
      r = Math.max(s.minRow, Math.min(s.maxRow, r));
      ring.push({ col: c, row: r });
      addLink(hub.col, hub.row, c, r, now, delay, { peak: 0.18 });
      delay += 12;
    }
    var poly = [];
    for (var p = 0; p < spokes; p++) {
      var t = 0.35 + Math.random() * 0.55;
      poly.push({
        col: Math.round(hub.col + (ring[p].col - hub.col) * t),
        row: Math.round(hub.row + (ring[p].row - hub.row) * t)
      });
    }
    for (var j = 0; j < poly.length; j++) {
      var a = poly[j];
      var b = poly[(j + 1) % poly.length];
      addLink(a.col, a.row, b.col, b.row, now, delay, { peak: 0.5 });
      delay += 16;
    }
    markSeriesPoints(poly, now, delay, 0.7);
    return true;
  }

  function spawnEdgeBundle(now, drift) {
    /* Hierarchical spines into a shared trunk, then fan out */
    var s = stageCells(drift);
    var trunk = { col: s.cx, row: s.cy };
    var leftN = 4 + Math.floor(Math.random() * 3);
    var rightN = 4 + Math.floor(Math.random() * 3);
    var delay = 0;
    var made = 0;
    function fan(side, count) {
      var col = side < 0 ? s.minCol : s.maxCol;
      for (var i = 0; i < count; i++) {
        var r = s.minRow + Math.round((i / Math.max(1, count - 1)) * s.spanH);
        var mid = { col: Math.round((col + trunk.col) / 2), row: Math.round((r + trunk.row) / 2) };
        addLink(col, r, mid.col, mid.row, now, delay, { peak: 0.36 });
        delay += 10;
        addLink(mid.col, mid.row, trunk.col, trunk.row, now, delay, { peak: 0.4 });
        delay += 12;
        addLink(col, r, col, r, now, delay, { peak: 0.5, point: true });
        delay += 10;
        made++;
      }
    }
    fan(-1, leftN);
    fan(1, rightN);
    addLink(trunk.col, trunk.row, trunk.col, trunk.row, now, delay, { peak: 0.58, point: true });
    return made >= 6;
  }

  function spawnChord(now, drift) {
    var s = stageCells(drift);
    var hub = { col: s.cx, row: s.cy };
    var n = Math.max(6, Math.min(10, 5 + Math.floor(s.spanW / 5)));
    var rx = Math.max(4, Math.floor(s.spanW * 0.48));
    var ry = Math.max(2, Math.floor(s.spanH * 0.42));
    var nodes = [];
    var delay = 0;
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n;
      var c = Math.max(s.minCol, Math.min(s.maxCol, hub.col + Math.round(Math.cos(ang) * rx)));
      var r = Math.max(s.minRow, Math.min(s.maxRow, hub.row + Math.round(Math.sin(ang) * ry)));
      nodes.push({ col: c, row: r });
    }
    for (var a = 0; a < nodes.length; a++) {
      var b = (a + 1) % nodes.length;
      addLink(nodes[a].col, nodes[a].row, nodes[b].col, nodes[b].row, now, delay, { peak: 0.22 });
      delay += 12;
    }
    var chords = Math.min(10, n);
    for (var k = 0; k < chords; k++) {
      var i0 = randInt(0, n - 1);
      var i1 = (i0 + randInt(2, Math.max(2, Math.floor(n / 2)))) % n;
      addLink(nodes[i0].col, nodes[i0].row, nodes[i1].col, nodes[i1].row, now, delay, { peak: 0.4 });
      delay += 16;
    }
    markSeriesPoints(nodes, now, delay, 0.8);
    return true;
  }

  function spawnAlluvial(now, drift) {
    return withRaisedBudget(80, function () {
    var s = stageCells(drift);
    var cols = [s.minCol, Math.round((s.minCol + s.cx) / 2), s.cx, Math.round((s.cx + s.maxCol) / 2), s.maxCol];
    var delay = 0;
    var made = 0;
    var nodes = [];
    for (var ci = 0; ci < cols.length; ci++) {
      var count = 3 + (ci % 2);
      var gapR = Math.max(1, Math.floor(s.spanH / Math.max(1, count - 1)));
      var top = s.cy - Math.floor(((count - 1) * gapR) / 2);
      nodes[ci] = [];
      for (var i = 0; i < count; i++) {
        nodes[ci].push({ col: cols[ci], row: top + i * gapR });
        addLink(cols[ci], top + i * gapR, cols[ci], top + i * gapR, now, delay, { peak: 0.45, point: true });
        delay += 8;
      }
    }
    for (var c = 0; c < cols.length - 1; c++) {
      for (var i = 0; i < nodes[c].length; i++) {
        var dest = nodes[c + 1][Math.min(nodes[c + 1].length - 1, i + randInt(-1, 1))];
        addLink(nodes[c][i].col, nodes[c][i].row, dest.col, dest.row, now, delay, { peak: 0.4 });
        delay += 16;
        made++;
      }
    }
    return made >= 6;
    });
  }

  function spawnHeatGrid(now, drift) {
    var s = stageCells(drift);
    var colsN = Math.max(6, Math.min(12, Math.round(s.spanW / 3)));
    var rowsN = Math.max(3, Math.min(6, Math.round(s.spanH / 2)));
    var delay = 0;
    var made = 0;
    for (var r = 0; r < rowsN; r++) {
      var row = evenRow(s.minRow, s.maxRow, r, rowsN);
      addLink(s.minCol, row, s.maxCol, row, now, delay, { peak: 0.18 });
      delay += 10;
      made++;
    }
    for (var c = 0; c < colsN; c++) {
      var col = evenCol(s.minCol, s.maxCol, c, colsN);
      addLink(col, s.minRow, col, s.maxRow, now, delay, { peak: 0.18 });
      delay += 10;
      made++;
    }
    for (var i = 0; i < Math.min(12, colsN * rowsN / 2); i++) {
      var cc = evenCol(s.minCol, s.maxCol, randInt(0, colsN - 1), colsN);
      var rr = evenRow(s.minRow, s.maxRow, randInt(0, rowsN - 1), rowsN);
      addLink(cc, rr, cc, rr, now, delay, { peak: 0.5, point: true });
      delay += 10;
    }
    return made >= 6;
  }

  function spawnContour(now, drift) {
    return withRaisedBudget(72, function () {
    var s = stageCells(drift);
    var hub = { col: s.cx, row: s.cy };
    var rings = Math.max(3, Math.min(w < 480 ? 3 : 5, Math.floor(s.spanH / 2)));
    var delay = 0;
    var made = 0;
    for (var ri = 1; ri <= rings; ri++) {
      var t = ri / rings;
      /* Wide elliptical ribbons for the landscape stage */
      var rx = Math.max(2, Math.round((s.spanW / 2) * (0.55 + t * 0.45)));
      var ry = Math.max(2, Math.round((s.spanH / 2) * t));
      var steps = Math.max(8, Math.min(w < 480 ? 10 : 16, rx));
      var pts = [];
      for (var i = 0; i < steps; i++) {
        var ang = (Math.PI * 2 * i) / steps;
        pts.push({
          col: Math.max(s.minCol, Math.min(s.maxCol, hub.col + Math.round(Math.cos(ang) * rx))),
          row: Math.max(s.minRow, Math.min(s.maxRow, hub.row + Math.round(Math.sin(ang) * ry)))
        });
      }
      for (var p = 0; p < pts.length; p++) {
        var a = pts[p];
        var b = pts[(p + 1) % pts.length];
        addLink(a.col, a.row, b.col, b.row, now, delay, { peak: 0.34 + t * 0.12 });
        delay += 8;
        made++;
      }
    }
    return made >= 8;
    });
  }

  function spawnVoronoi(now, drift) {
    /* Approximate Voronoi: seed sites + nearest-neighbor edge mesh */
    var s = stageCells(drift);
    var seeds = Math.max(6, Math.min(12, Math.round((s.spanW * s.spanH) / 20)));
    var sites = [];
    var delay = 0;
    for (var i = 0; i < seeds * 3 && sites.length < seeds; i++) {
      var c = randInt(s.minCol, s.maxCol);
      var r = randInt(s.minRow, s.maxRow);
      var ok = true;
      for (var j = 0; j < sites.length; j++) {
        if (Math.abs(sites[j].col - c) + Math.abs(sites[j].row - r) < 2) { ok = false; break; }
      }
      if (ok) sites.push({ col: c, row: r });
    }
    if (sites.length < 4) return false;
    var made = 0;
    for (var a = 0; a < sites.length; a++) {
      var dists = [];
      for (var b = 0; b < sites.length; b++) {
        if (a === b) continue;
        var dx = sites[a].col - sites[b].col;
        var dy = sites[a].row - sites[b].row;
        dists.push({ i: b, d: dx * dx + dy * dy });
      }
      dists.sort(function (u, v) { return u.d - v.d; });
      for (var k = 0; k < Math.min(3, dists.length); k++) {
        var o = sites[dists[k].i];
        if (a > dists[k].i) continue;
        addLink(sites[a].col, sites[a].row, o.col, o.row, now, delay, { peak: 0.36 });
        delay += 14;
        made++;
      }
    }
    markSeriesPoints(sites, now, delay, 0.9);
    return made >= 4;
  }

  function spawnConstellation(now, drift) {
    var s = stageCells(drift);
    var stars = Math.max(10, Math.min(22, Math.round((s.spanW * s.spanH) / 10)));
    var pts = [];
    var delay = 0;
    for (var i = 0; i < stars * 3 && pts.length < stars; i++) {
      var c = randInt(s.minCol, s.maxCol);
      var r = randInt(s.minRow, s.maxRow);
      pts.push({ col: c, row: r });
    }
    for (var p = 0; p < pts.length; p++) {
      addLink(pts[p].col, pts[p].row, pts[p].col, pts[p].row, now, delay, {
        peak: 0.45 + Math.random() * 0.2,
        point: true
      });
      delay += 8;
    }
    var strokes = Math.min(8, Math.floor(pts.length / 2));
    for (var sIdx = 0; sIdx < strokes; sIdx++) {
      var a = pts[randInt(0, pts.length - 1)];
      var b = pts[randInt(0, pts.length - 1)];
      if (a.col === b.col && a.row === b.row) continue;
      addLink(a.col, a.row, b.col, b.row, now, delay, { peak: 0.34 });
      delay += 16;
    }
    return pts.length >= 8;
  }

  function spawnSpectrogram(now, drift) {
    var s = stageCells(drift);
    var startCol = s.minCol;
    var endCol = s.maxCol;
    var spanUsed = Math.max(1, endCol - startCol);
    var bins = Math.max(16, Math.min(40, spanUsed + 1));
    var step = Math.max(1, Math.floor(spanUsed / Math.max(1, bins - 1)));
    bins = Math.floor(spanUsed / step) + 1;
    var base = s.maxRow;
    var maxH = Math.max(3, s.spanH);
    var delay = 0;
    var prevMax = maxLinks;
    maxLinks = Math.max(maxLinks, 90);
    addLink(startCol, base, endCol, base, now, delay, { peak: 0.16 });
    delay += 14;
    for (var i = 0; i < bins; i++) {
      var c = evenCol(startCol, endCol, i, bins);
      var ht = randInt(1, maxH);
      /* Occasional harmonic stack */
      var layers = Math.random() < 0.25 ? 2 : 1;
      for (var L = 0; L < layers; L++) {
        var h2 = Math.max(1, Math.floor(ht * (1 - L * 0.35)));
        addLink(c, base, c, base - h2, now, delay, { peak: 0.4 - L * 0.08, drawEnd: 0.12 });
        delay += 6;
      }
    }
    maxLinks = prevMax;
    return true;
  }

  function spawnSoundWave(now, drift) {
    /* Oscilloscope waveform — center rail, oscillating trace, optional mirror stems */
    var s = stageCells(drift);
    var startCol = s.minCol;
    var endCol = s.maxCol;
    var spanUsed = Math.max(1, endCol - startCol);
    var mid = s.cy;
    var amp = Math.max(2, Math.floor(s.spanH / 2));
    var pts = Math.max(16, Math.min(36, spanUsed + 1));
    var step = Math.max(1, Math.floor(spanUsed / Math.max(1, pts - 1)));
    pts = Math.floor(spanUsed / step) + 1;
    var cycles = 2.5 + Math.random() * 3.5;
    var phase = Math.random() * Math.PI * 2;
    var delay = 0;
    var prevMax = maxLinks;
    maxLinks = Math.max(maxLinks, 88);

    addLink(startCol, mid, endCol, mid, now, delay, { peak: 0.16 });
    delay += 14;

    var points = [];
    for (var i = 0; i < pts; i++) {
      var t = i / Math.max(1, pts - 1);
      var c = evenCol(startCol, endCol, i, pts);
      /* Carrier + quieter harmonic for a richer audio look */
      var wave =
        Math.sin(phase + t * Math.PI * 2 * cycles) * 0.7 +
        Math.sin(phase * 1.7 + t * Math.PI * 2 * cycles * 2.2) * 0.3;
      /* Soft amplitude envelope so it breathes like a real clip */
      var env = 0.45 + 0.55 * Math.sin(Math.PI * t);
      var row = mid + Math.round(wave * amp * env);
      row = Math.max(s.minRow, Math.min(s.maxRow, row));
      points.push({ col: c, row: row });
    }

    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, {
        peak: 0.5 + Math.random() * 0.08
      });
      delay += 8 + Math.floor(Math.random() * 8);
    }

    /* Mirrored sample stems — classic waveform density */
    for (var v = 0; v < points.length; v += 1 + (Math.random() < 0.35 ? 1 : 0)) {
      if (points[v].row === mid) continue;
      addLink(points[v].col, mid, points[v].col, points[v].row, now, delay, {
        peak: 0.28,
        drawEnd: 0.14
      });
      delay += 6;
    }

    markSeriesPoints(points, now, delay, 0.3 + Math.random() * 0.25);
    maxLinks = prevMax;
    return points.length >= 8;
  }

  function spawnQQPlot(now, drift) {
    var s = stageCells(drift);
    var delay = 0;
    addLink(s.minCol, s.maxRow, s.maxCol, s.maxRow, now, delay, { peak: 0.16 });
    addLink(s.minCol, s.maxRow, s.minCol, s.minRow, now, delay + 8, { peak: 0.16 });
    delay += 20;
    /* Diagonal reference */
    addLink(s.minCol, s.maxRow, s.maxCol, s.minRow, now, delay, { peak: 0.22 });
    delay += 18;
    var n = Math.max(8, Math.min(16, Math.round(s.spanW / 2)));
    for (var i = 0; i < n; i++) {
      var t = i / Math.max(1, n - 1);
      var c = Math.round(s.minCol + t * s.spanW);
      var ideal = Math.round(s.maxRow - t * s.spanH);
      var r = Math.max(s.minRow, Math.min(s.maxRow, ideal + randInt(-2, 2)));
      addLink(c, r, c, r, now, delay, { peak: 0.52, point: true });
      delay += 12;
    }
    return true;
  }

  function spawnControlChart(now, drift) {
    var layout = seriesLayout(drift, 8, 16, 1.1);
    if (!layout) return false;
    var s = layout.metrics;
    var minY = layout.baseRow - s.spanH;
    var maxY = layout.baseRow - 1;
    var mid = Math.round((minY + maxY) / 2);
    var ucl = Math.max(minY, mid - Math.max(2, Math.floor(s.spanH * 0.35)));
    var lcl = Math.min(maxY, mid + Math.max(2, Math.floor(s.spanH * 0.35)));
    var delay = 0;
    addLink(layout.startCol, layout.baseRow, layout.endCol, layout.baseRow, now, delay, { peak: 0.14 });
    delay += 12;
    addLink(layout.startCol, mid, layout.endCol, mid, now, delay, { peak: 0.2 });
    delay += 12;
    addLink(layout.startCol, ucl, layout.endCol, ucl, now, delay, { peak: 0.18 });
    delay += 10;
    addLink(layout.startCol, lcl, layout.endCol, lcl, now, delay, { peak: 0.18 });
    delay += 16;
    var ys = randomSeriesYs(layout.pts, ucl + 1, lcl - 1);
    var points = [];
    for (var i = 0; i < layout.pts; i++) {
      var c = layout.colAt(i);
      /* Occasional point outside control limits */
      var row = Math.random() < 0.12 ? (Math.random() < 0.5 ? ucl - 1 : lcl + 1) : ys[i];
      row = Math.max(minY, Math.min(maxY, row));
      points.push({ col: c, row: row });
    }
    delay = markSeriesPoints(points, now, delay, 0.55);
    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, { peak: 0.5 });
      delay += 16;
    }
    return true;
  }

  function spawnLineChart(now, drift) {
    var layout = seriesLayout(drift, 8, 18, 0.9 + Math.random() * 0.5);
    if (!layout) return false;
    var s = layout.metrics;
    var delay = 0;
    var minY = layout.baseRow - s.spanH;
    var maxY = layout.baseRow - 1;
    var ys = randomSeriesYs(layout.pts, minY, maxY);
    var points = [];
    for (var i = 0; i < layout.pts; i++) {
      var c = layout.colAt(i);
      points.push({ col: c, row: ys[i] });
    }
    if (points.length < 4) return false;

    /* Pin dots before segments so the right endpoint can't be budget-dropped */
    delay = markSeriesPoints(points, now, delay, 0.45 + Math.random() * 0.4);

    addLink(points[0].col, layout.baseRow, points[points.length - 1].col, layout.baseRow, now, delay, { peak: 0.2 });
    delay += 28 + Math.floor(Math.random() * 20);

    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, {
        peak: 0.45 + Math.random() * 0.12
      });
      delay += 24 + Math.floor(Math.random() * 24);
    }
    return true;
  }

  function spawnStepChart(now, drift) {
    var layout = seriesLayout(drift, 7, 16, 1.0 + Math.random() * 0.5);
    if (!layout) return false;
    var s = layout.metrics;
    var delay = 0;
    var minY = layout.baseRow - s.spanH;
    var maxY = layout.baseRow - 1;
    var ys = randomSeriesYs(layout.pts, minY, maxY);
    var points = [];
    for (var i = 0; i < layout.pts; i++) {
      var c = layout.colAt(i);
      points.push({ col: c, row: ys[i] });
    }
    if (points.length < 4) return false;

    delay = markSeriesPoints(points, now, delay, 0.5 + Math.random() * 0.35);

    addLink(points[0].col, layout.baseRow, points[points.length - 1].col, layout.baseRow, now, delay, { peak: 0.2 });
    delay += 24 + Math.floor(Math.random() * 18);

    /* Classic step: hold level, then jump — horizontal then vertical */
    for (var p = 0; p < points.length - 1; p++) {
      var a = points[p];
      var b = points[p + 1];
      if (a.row !== b.row) {
        addLink(a.col, a.row, b.col, a.row, now, delay, { peak: 0.48 + Math.random() * 0.08 });
        delay += 20 + Math.floor(Math.random() * 16);
        addLink(b.col, a.row, b.col, b.row, now, delay, { peak: 0.46 + Math.random() * 0.08 });
        delay += 16 + Math.floor(Math.random() * 14);
      } else {
        addLink(a.col, a.row, b.col, b.row, now, delay, { peak: 0.5 });
        delay += 24 + Math.floor(Math.random() * 16);
      }
    }
    return true;
  }

  function spawnTreemap(now, drift) {
    var s = stageCells(drift);
    var left = s.minCol;
    var right = s.maxCol;
    var top = s.cy - Math.floor(s.spanH / 2);
    var bottom = s.cy + Math.floor(s.spanH / 2);
    if (!inBounds(left, top, drift) || !inBounds(right, bottom, drift)) return false;

    var delay = 0;
    var made = 0;
    var before = links.length;

    function edge(c1, r1, c2, r2, peak) {
      if (!inBounds(c1, r1, drift) || !inBounds(c2, r2, drift)) return;
      if (addLink(c1, r1, c2, r2, now, delay, { peak: peak })) {
        delay += 22;
        made++;
      }
    }

    function frame(c0, r0, c1, r1, peak) {
      edge(c0, r0, c1, r0, peak);
      edge(c1, r0, c1, r1, peak);
      edge(c1, r1, c0, r1, peak);
      edge(c0, r1, c0, r0, peak);
    }

    /* Outer tile */
    frame(left, top, right, bottom, 0.48);

    /* Slice-and-dice partitions — weighted cuts for uneven leaf sizes */
    function partition(c0, r0, c1, r1, depth) {
      var w = c1 - c0;
      var h = r1 - r0;
      if (depth <= 0 || w < 3 || h < 2 || links.length >= maxLinks - 2) return;

      var vertical = w >= h * 1.15;
      if (vertical && w >= 3) {
        var ratio = 0.28 + Math.random() * 0.44;
        var cut = c0 + Math.max(2, Math.min(w - 2, Math.round(w * ratio)));
        edge(cut, r0, cut, r1, 0.42 - depth * 0.04);
        partition(c0, r0, cut, r1, depth - 1);
        partition(cut, r0, c1, r1, depth - 1);
      } else if (h >= 3) {
        var ratioH = 0.28 + Math.random() * 0.44;
        var cutR = r0 + Math.max(2, Math.min(h - 2, Math.round(h * ratioH)));
        edge(c0, cutR, c1, cutR, 0.42 - depth * 0.04);
        partition(c0, r0, c1, cutR, depth - 1);
        partition(c0, cutR, c1, r1, depth - 1);
      }
    }

    partition(left, top, right, bottom, 3);

    /* Soft accent dots in a few leaf centers for value weight */
    var accents = [
      { c: left + Math.floor((right - left) * 0.22), r: top + Math.floor((bottom - top) * 0.35) },
      { c: left + Math.floor((right - left) * 0.62), r: top + Math.floor((bottom - top) * 0.28) },
      { c: left + Math.floor((right - left) * 0.72), r: top + Math.floor((bottom - top) * 0.68) }
    ];
    for (var a = 0; a < accents.length; a++) {
      if (!inBounds(accents[a].c, accents[a].r, drift)) continue;
      if (addLink(accents[a].c, accents[a].r, accents[a].c, accents[a].r, now, delay, {
        peak: 0.4, point: true
      })) {
        delay += 30;
        made++;
      }
    }

    return links.length > before && made >= 5;
  }

  function spawnMultiLine(now, drift) {
    var s = stageCells(drift);
    var pts = Math.max(8, Math.min(14, Math.round(s.spanW / 1.5)));
    var step = Math.max(1, Math.floor(s.spanW / (pts - 1)));
    var startCol = s.cx - Math.floor(((pts - 1) * step) / 2);
    var delay = 0;
    var made = 0;
    var y = s.cy + randInt(-Math.floor(s.spanH / 4), Math.floor(s.spanH / 4));
    var points = [];
    for (var i = 0; i < pts; i++) {
      y = Math.max(s.cy - Math.floor(s.spanH / 2), Math.min(s.cy + Math.floor(s.spanH / 2), y + pick([-2, -1, 0, 1, 2])));
      var c = evenCol(startCol, startCol + (pts - 1) * step, i, pts);
      if (!inBounds(c, y, drift)) break;
      points.push({ col: c, row: y });
    }
    if (points.length < 4) return false;
    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay,
        withArc({ peak: 0.48 }, pick([-16, -22, 16, 22])));
      delay += 36;
      made++;
    }
    return made >= 4;
  }

  function spawnWaveCurves(now, drift) {
    var s = stageCells(drift);
    var pts = Math.max(10, Math.min(18, s.spanW));
    var step = Math.max(1, Math.floor(s.spanW / (pts - 1)));
    var startCol = s.cx - Math.floor(((pts - 1) * step) / 2);
    var amp = Math.max(2, Math.floor(s.spanH / 2.4));
    var delay = 0;
    var made = 0;
    var phase = Math.random() * Math.PI * 2;
    var cycles = 1.2 + Math.random() * 1.4;
    var points = [];
    for (var i = 0; i < pts; i++) {
      var t = i / Math.max(1, pts - 1);
      var c = startCol + i * step;
      var row = s.cy + Math.round(Math.sin(t * Math.PI * 2 * cycles + phase) * amp);
      if (!inBounds(c, row, drift)) continue;
      points.push({ col: c, row: row });
    }
    if (points.length < 5) return false;
    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay,
        withArc({ peak: 0.48 }, pick([-12, -18, 12, 18])));
      delay += 28;
      made++;
    }
    return made >= 5;
  }

  function spawnParallelCoords(now, drift) {
    return withRaisedBudget(72, function () {
    var s = stageCells(drift);
    var startCol = s.minCol;
    var endCol = s.maxCol;
    var spanUsed = Math.max(1, endCol - startCol);
    var axes = Math.max(4, Math.min(w < 480 ? 5 : 7, Math.round(spanUsed / 4) + 1));
    var step = Math.max(2, Math.floor(spanUsed / Math.max(1, axes - 1)));
    axes = Math.floor(spanUsed / step) + 1;
    var top = s.minRow;
    var bottom = s.maxRow;
    var delay = 0;
    var made = 0;
    var axisCols = [];

    for (var a = 0; a < axes; a++) {
      var c = evenCol(startCol, endCol, a, axes);
      axisCols.push(c);
      addLink(c, top, c, bottom, now, delay, { peak: 0.16 });
      delay += 14;
      made++;
    }
    if (axisCols.length < 3) return false;

    var series = w < 480 ? 2 : (2 + Math.floor(Math.random() * 3));
    for (var sIdx = 0; sIdx < series; sIdx++) {
      var points = [];
      for (var i = 0; i < axisCols.length; i++) {
        points.push({ col: axisCols[i], row: randInt(top + 1, bottom - 1) });
      }
      for (var p = 0; p < points.length - 1; p++) {
        addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, {
          peak: 0.42 + Math.random() * 0.1
        });
        delay += 18;
        made++;
      }
      markSeriesPoints(points, now, delay, 0.35);
    }
    return made >= 6;
    });
  }

  function spawnScatter(now, drift) {
    var s = stageCells(drift);
    var halfH = Math.floor(s.spanH / 2);
    var dots = Math.max(14, Math.min(36, Math.round((s.spanW * s.spanH) / 6)));
    var delay = 0;
    var made = 0;
    var used = {};

    for (var i = 0; i < dots * 3 && made < dots; i++) {
      var c = randInt(s.minCol, s.maxCol);
      var r = s.cy + randInt(-halfH, halfH);
      var id = c + ',' + r;
      if (used[id] || !inBounds(c, r, drift)) continue;
      used[id] = true;
      addLink(c, r, c, r, now, delay, {
        point: true,
        peak: 0.55 + Math.random() * 0.25,
        life: 4800 + Math.random() * 2800,
        drawEnd: 0.12,
        fadeStart: 0.7
      });
      delay += 28;
      made++;
    }
    return made >= 10;
  }

  function spawnStreets(now, drift) {
    var s = stageCells(drift);
    var minC = s.cx - Math.floor(s.spanW / 2);
    var maxC = s.cx + Math.floor(s.spanW / 2);
    var minR = s.cy - Math.floor(s.spanH / 2);
    var maxR = s.cy + Math.floor(s.spanH / 2);
    var delay = 0;
    var made = 0;

    function seg(c0, r0, c1, r1, peak, curved) {
      if (!inBounds(c0, r0, drift) || !inBounds(c1, r1, drift)) return false;
      if (c0 === c1 && r0 === r1) return false;
      var opts = { peak: peak || 0.4, drawEnd: 0.24 };
      if (curved) opts = withArc(opts, pick([-12, -18, 12, 18, -22, 22]));
      if (addLink(c0, r0, c1, r1, now, delay, opts)) {
        delay += 32;
        made++;
        return true;
      }
      return false;
    }

    /* Primary avenues — long, slightly wandering horizontals */
    var avenueCount = Math.max(3, Math.min(5, Math.round(s.spanH / 3)));
    var avenues = [];
    for (var a = 0; a < avenueCount; a++) {
      var row = minR + Math.round(((a + 0.5) / avenueCount) * (maxR - minR));
      row += randInt(-1, 1);
      var cols = [];
      var c = minC;
      while (c <= maxC) {
        cols.push({ col: c, row: row + (cols.length % 5 === 0 ? pick([-1, 0, 0, 1]) : 0) });
        c += randInt(2, 4);
      }
      for (var i = 0; i < cols.length - 1; i++) {
        seg(cols[i].col, cols[i].row, cols[i + 1].col, cols[i + 1].row, 0.48, Math.random() < 0.35);
      }
      avenues.push(cols);
    }

    /* Cross streets — vertical connectors with irregular spacing */
    var streetCount = Math.max(4, Math.min(7, Math.round(s.spanW / 3)));
    for (var st = 0; st < streetCount; st++) {
      var col = minC + Math.round(((st + 0.4) / streetCount) * (maxC - minC));
      col += randInt(-1, 1);
      var r = minR + randInt(0, 2);
      while (r < maxR - 1) {
        var nextR = Math.min(maxR, r + randInt(2, 5));
        var wobble = pick([-1, 0, 0, 1]);
        seg(col, r, col + wobble, nextR, 0.36, Math.random() < 0.4);
        col = col + wobble;
        r = nextR;
      }
    }

    /* Diagonal connectors — alley shortcuts / angled roads */
    var diagonals = randInt(4, 8);
    for (var d = 0; d < diagonals; d++) {
      var dc = randInt(minC + 1, maxC - 2);
      var dr = randInt(minR + 1, maxR - 2);
      var len = randInt(3, 6);
      var dirC = pick([-1, 1]);
      var dirR = pick([-1, 1]);
      seg(dc, dr, dc + dirC * len, dr + dirR * Math.max(2, Math.floor(len * 0.7)), 0.32, true);
    }

    /* Short blocks / cul-de-sac stubs off avenues */
    for (var av = 0; av < avenues.length; av++) {
      var path = avenues[av];
      for (var p = 1; p < path.length - 1; p += randInt(2, 3)) {
        var stubLen = randInt(2, 4);
        var stubDir = pick([-1, 1]);
        seg(path[p].col, path[p].row, path[p].col, path[p].row + stubDir * stubLen, 0.3, false);
      }
    }

    return made >= 12;
  }

  function spawnFunnel(now, drift) {
    var s = stageCells(drift);
    var tiers = Math.max(4, Math.min(6, Math.round(s.spanH / 2)));
    var width = s.spanW;
    var topRow = s.cy - Math.floor(s.spanH / 2);
    var delay = 0;
    var prev = null;
    for (var t = 0; t < tiers; t++) {
      var wTier = Math.max(3, width - t * Math.max(2, Math.round(width / (tiers + 1))));
      var c0 = s.cx - Math.floor(wTier / 2);
      var c1 = c0 + wTier;
      var r = topRow + t * Math.max(2, Math.floor(s.spanH / (tiers - 1)));
      if (!inBounds(c0, r, drift) || !inBounds(c1, r, drift)) break;
      addLink(c0, r, c1, r, now, delay, { peak: 0.44 });
      delay += 55;
      if (prev) {
        addLink(prev.c0, prev.r, c0, r, now, delay, withArc({ peak: 0.3 }, pick([-18, -26])));
        addLink(prev.c1, prev.r, c1, r, now, delay + 25, withArc({ peak: 0.3 }, pick([18, 26])));
        delay += 50;
      }
      prev = { c0: c0, c1: c1, r: r };
    }
    return !!prev;
  }

  function spawnAreaChart(now, drift) {
    var layout = seriesLayout(drift, 6, 12, 1.1 + Math.random() * 0.5);
    if (!layout) return false;
    var s = layout.metrics;
    var delay = 0;
    var minY = layout.baseRow - s.spanH;
    var maxY = layout.baseRow - 1;
    var ys = randomSeriesYs(layout.pts, minY, maxY);
    var points = [];
    for (var i = 0; i < layout.pts; i++) {
      var c = layout.colAt(i);
      points.push({ col: c, row: ys[i] });
    }
    if (points.length < 4) return false;

    delay = markSeriesPoints(points, now, delay, 0.35 + Math.random() * 0.4);

    addLink(points[0].col, layout.baseRow, points[points.length - 1].col, layout.baseRow, now, delay, { peak: 0.2 });
    delay += 24 + Math.floor(Math.random() * 16);
    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, {
        peak: 0.44 + Math.random() * 0.1
      });
      delay += 22 + Math.floor(Math.random() * 18);
    }
    for (var v = 0; v < points.length; v++) {
      addLink(points[v].col, points[v].row, points[v].col, layout.baseRow, now, delay, { peak: 0.22 + Math.random() * 0.08 });
      delay += 18 + Math.floor(Math.random() * 14);
    }
    return true;
  }

  function spawnDonut(now, drift) {
    var s = stageCells(drift);
    var hub = { col: s.cx, row: s.cy };
    if (!inBounds(hub.col, hub.row, drift)) return false;
    var radius = s.radius;
    var nodes = sortClockwise(hub, spokeCandidates(radius).map(function (o) {
      return { col: hub.col + o[0], row: hub.row + o[1] };
    }).filter(function (p) { return inBounds(p.col, p.row, drift); }));
    if (nodes.length < 6) return false;
    var delay = 0;
    for (var sp = 0; sp < nodes.length; sp++) {
      addLink(hub.col, hub.row, nodes[sp].col, nodes[sp].row, now, delay, { peak: 0.44 });
      delay += 40;
    }
    for (var n = 0; n < nodes.length; n++) {
      var a = nodes[n];
      var b = nodes[(n + 1) % nodes.length];
      var dx = a.col - b.col;
      var dy = a.row - b.row;
      if (Math.sqrt(dx * dx + dy * dy) < radius * 1.55) {
        addLink(a.col, a.row, b.col, b.row, now, delay, {
          peak: 0.36,
          curve: 'arc',
          arcLift: pick([-16, -22, -28, 16, 22, 28])
        });
        delay += 35;
      }
    }
    /* Extra long-span arcs across the ring */
    for (var skip = 2; skip <= 3; skip++) {
      for (var j = 0; j < nodes.length; j++) {
        if (Math.random() > 0.55) continue;
        var c0 = nodes[j];
        var c1 = nodes[(j + skip) % nodes.length];
        addLink(c0.col, c0.row, c1.col, c1.row, now, delay, {
          peak: 0.32,
          curve: 'arc',
          arcLift: pick([-24, -34, 24, 34])
        });
        delay += 40;
      }
    }
    return true;
  }

  function spawnHistogram(now, drift) {
    var s = actCenter ? actCenter.metrics : stageCells(drift);
    var startCol = s.minCol;
    var endCol = s.maxCol;
    var spanUsed = Math.max(1, endCol - startCol);
    var baseRow = Math.min(s.maxRow, s.cy + Math.floor(s.spanH / 2));
    if (!inBounds(startCol, baseRow, drift)) baseRow = s.maxRow;
    var maxH = Math.max(3, Math.min(s.spanH, Math.max(1, baseRow - s.minRow)));
    var delay = 0;

    /* Need room for a stem on every step across the full baseline */
    var prevMax = maxLinks;
    maxLinks = Math.max(maxLinks, 96);

    var step = Math.max(w < 480 ? 2 : 2, Math.round(spanUsed / (w < 480 ? 14 : w < 800 ? 24 : 36)));
    var bins = Math.floor(spanUsed / step) + 1;

    addLink(startCol, baseRow, endCol, baseRow, now, delay, { peak: 0.28 });
    delay += 24;

    var heights = randomSeriesYs(bins, Math.max(2, Math.floor(maxH * 0.2)), maxH);
    if (Math.random() < 0.5) {
      for (var hi = 0; hi < heights.length; hi++) {
        heights[hi] = randInt(Math.max(2, Math.floor(maxH * 0.15)), maxH);
      }
    }

    var made = 0;
    for (var i = 0; i < bins; i++) {
      var c = evenCol(startCol, endCol, i, bins);
      var ht = heights[i];
      var tip = Math.max(s.minRow, baseRow - ht);
      addLink(c, baseRow, c, tip, now, delay, {
        peak: 0.48 + Math.random() * 0.1,
        drawEnd: 0.12 + Math.random() * 0.08,
        fadeStart: 0.7 + Math.random() * 0.08
      });
      delay += 8 + Math.floor(Math.random() * 12);
      if (Math.random() < 0.85) {
        addLink(c, tip, c, tip, now, delay, { peak: 0.52 + Math.random() * 0.1, point: true });
        delay += 6 + Math.floor(Math.random() * 10);
      }
      made++;
    }

    maxLinks = prevMax;
    return made >= 8;
  }

  function spawnLollipopH(now, drift) {
    var s = stageCells(drift);
    var baseCol = s.minCol;
    var endCol = s.maxCol;
    var maxW = Math.max(5, endCol - baseCol);
    var top = s.cy - Math.floor(s.spanH / 2);
    var bottom = s.cy + Math.floor(s.spanH / 2);
    var rows = Math.max(4, Math.min(w < 480 ? 6 : 9, bottom - top + 1));
    var step = Math.max(1, Math.floor((bottom - top) / Math.max(1, rows - 1)));
    rows = Math.floor((bottom - top) / step) + 1;
    var startRow = s.cy - Math.floor(((rows - 1) * step) / 2);
    var endRow = startRow + (rows - 1) * step;
    var delay = 0;

    if (!inBounds(baseCol, startRow, drift) || !inBounds(baseCol, endRow, drift)) return false;

    /* Category axis (left) + full-width value axis (bottom) */
    addLink(baseCol, startRow, baseCol, endRow, now, delay, { peak: 0.28 });
    delay += 22;
    addLink(baseCol, endRow, endCol, endRow, now, delay, { peak: 0.22 });
    delay += 26;

    /* Lengths in [0.2, 1] of full width — longest always hits the right edge */
    var lengths = [];
    var maxLen = 0;
    for (var i = 0; i < rows; i++) {
      var raw = 0.22 + Math.random() * 0.78;
      lengths.push(raw);
      if (raw > maxLen) maxLen = raw;
    }

    var made = 0;
    for (var j = 0; j < rows; j++) {
      var r = startRow + j * step;
      var len = Math.max(3, Math.round((lengths[j] / maxLen) * maxW));
      var tip = baseCol + len;
      if (tip > endCol) tip = endCol;
      if (j === 0) tip = endCol; /* guarantee full-width read */
      addLink(baseCol, r, tip, r, now, delay, {
        peak: 0.52,
        drawEnd: 0.16,
        fadeStart: 0.72
      });
      delay += 18;
      addLink(tip, r, tip, r, now, delay, { peak: 0.58, point: true });
      delay += 14;
      made++;
    }
    return made >= 4;
  }

  function spawnForceNetwork(now, drift) {
    var s = stageCells(drift);
    var minC = s.minCol;
    var maxC = s.maxCol;
    var minR = s.minRow;
    var maxR = s.maxRow;
    var area = Math.max(1, (maxC - minC) * Math.max(1, maxR - minR));
    var n = Math.max(8, Math.min(18, Math.round(area / 14)));
    var nodes = [];
    var delay = 0;
    var prevMax = maxLinks;
    maxLinks = Math.max(maxLinks, 64);

    for (var i = 0; i < n; i++) {
      nodes.push({
        col: randInt(minC, maxC),
        row: randInt(minR, maxR),
        vx: 0,
        vy: 0
      });
    }

    /* Build a sparse graph — each node links to 1–3 nearest neighbors */
    var edges = [];
    var edgeKey = {};
    function addEdge(a, b) {
      if (a === b) return;
      var lo = Math.min(a, b);
      var hi = Math.max(a, b);
      var id = lo + ':' + hi;
      if (edgeKey[id]) return;
      edgeKey[id] = true;
      edges.push([lo, hi]);
    }

    for (var a = 0; a < nodes.length; a++) {
      var dists = [];
      for (var b = 0; b < nodes.length; b++) {
        if (a === b) continue;
        var dx = nodes[a].col - nodes[b].col;
        var dy = nodes[a].row - nodes[b].row;
        dists.push({ i: b, d: dx * dx + dy * dy });
      }
      dists.sort(function (u, v) { return u.d - v.d; });
      var linksN = 1 + Math.floor(Math.random() * 3);
      for (var k = 0; k < Math.min(linksN, dists.length); k++) {
        addEdge(a, dists[k].i);
      }
    }
    /* A few long-range bridges for that force-graph look */
    for (var br = 0; br < Math.min(3, Math.floor(n / 4)); br++) {
      addEdge(randInt(0, n - 1), randInt(0, n - 1));
    }

    /* Lightweight force relaxation (repulsion + edge springs + centering) */
    var cx = (minC + maxC) / 2;
    var cy = (minR + maxR) / 2;
    var iters = 28 + Math.floor(Math.random() * 12);
    for (var t = 0; t < iters; t++) {
      for (var i0 = 0; i0 < nodes.length; i0++) {
        nodes[i0].vx *= 0.6;
        nodes[i0].vy *= 0.6;
      }
      for (var i1 = 0; i1 < nodes.length; i1++) {
        for (var j1 = i1 + 1; j1 < nodes.length; j1++) {
          var rx = nodes[i1].col - nodes[j1].col;
          var ry = nodes[i1].row - nodes[j1].row;
          var dist2 = rx * rx + ry * ry + 0.1;
          var dist = Math.sqrt(dist2);
          var force = 2.8 / dist2;
          var fx = (rx / dist) * force;
          var fy = (ry / dist) * force;
          nodes[i1].vx += fx;
          nodes[i1].vy += fy;
          nodes[j1].vx -= fx;
          nodes[j1].vy -= fy;
        }
      }
      for (var e = 0; e < edges.length; e++) {
        var na = nodes[edges[e][0]];
        var nb = nodes[edges[e][1]];
        var ex = nb.col - na.col;
        var ey = nb.row - na.row;
        var ed = Math.sqrt(ex * ex + ey * ey) + 0.1;
        var ideal = 2.4 + Math.random() * 0.6;
        var pull = (ed - ideal) * 0.08;
        var px = (ex / ed) * pull;
        var py = (ey / ed) * pull;
        na.vx += px;
        na.vy += py;
        nb.vx -= px;
        nb.vy -= py;
      }
      for (var i2 = 0; i2 < nodes.length; i2++) {
        nodes[i2].vx += (cx - nodes[i2].col) * 0.02;
        nodes[i2].vy += (cy - nodes[i2].row) * 0.02;
        nodes[i2].col = Math.max(minC, Math.min(maxC, nodes[i2].col + nodes[i2].vx));
        nodes[i2].row = Math.max(minR, Math.min(maxR, nodes[i2].row + nodes[i2].vy));
      }
    }

    /* Snap to grid cells */
    for (var i3 = 0; i3 < nodes.length; i3++) {
      nodes[i3].col = Math.round(nodes[i3].col);
      nodes[i3].row = Math.round(nodes[i3].row);
      nodes[i3].col = Math.max(minC, Math.min(maxC, nodes[i3].col));
      nodes[i3].row = Math.max(minR, Math.min(maxR, nodes[i3].row));
    }

    var made = 0;
    for (var ei = 0; ei < edges.length; ei++) {
      var aN = nodes[edges[ei][0]];
      var bN = nodes[edges[ei][1]];
      if (aN.col === bN.col && aN.row === bN.row) continue;
      addLink(aN.col, aN.row, bN.col, bN.row, now, delay, {
        peak: 0.36 + Math.random() * 0.12,
        drawEnd: 0.18 + Math.random() * 0.1
      });
      delay += 14 + Math.floor(Math.random() * 16);
      made++;
    }

    for (var ni = 0; ni < nodes.length; ni++) {
      addLink(nodes[ni].col, nodes[ni].row, nodes[ni].col, nodes[ni].row, now, delay, {
        peak: 0.52 + Math.random() * 0.12,
        point: true
      });
      delay += 10 + Math.floor(Math.random() * 12);
    }

    maxLinks = prevMax;
    return made >= 5;
  }

  function spawnFinance(now, drift) {
    /* Price line + volume stems — classic market chart */
    var layout = seriesLayout(drift, 7, 12, 1.25 + Math.random() * 0.3);
    if (!layout) return false;
    var s = layout.metrics;
    var delay = 0;
    var prevMax = maxLinks;
    maxLinks = Math.max(maxLinks, 72);

    var priceFloor = layout.baseRow - Math.max(3, Math.floor(s.spanH * 0.35));
    var minY = s.minRow + 1;
    var maxY = Math.max(minY + 2, priceFloor - 1);
    var ys = randomSeriesYs(layout.pts, minY, maxY);
    var points = [];
    for (var i = 0; i < layout.pts; i++) {
      var c = layout.colAt(i);
      points.push({ col: c, row: ys[i] });
    }
    if (points.length < 4) {
      maxLinks = prevMax;
      return false;
    }

    delay = markSeriesPoints(points, now, delay, 0.5);

    addLink(points[0].col, layout.baseRow, points[points.length - 1].col, layout.baseRow, now, delay, { peak: 0.18 });
    delay += 16;

    /* Soft mid guide (like a moving-average level) */
    var guide = Math.round((minY + maxY) / 2);
    addLink(points[0].col, guide, points[points.length - 1].col, guide, now, delay, { peak: 0.14 });
    delay += 14;

    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, {
        peak: 0.52 + Math.random() * 0.08
      });
      delay += 18 + Math.floor(Math.random() * 12);
    }

    /* Volume bars first (before point accents) so they never get dropped */
    var volMax = Math.max(2, layout.baseRow - priceFloor - 1);
    for (var v = 0; v < points.length; v++) {
      var vh = randInt(1, volMax);
      var tip = layout.baseRow - vh;
      if (tip >= layout.baseRow) tip = layout.baseRow - 1;
      addLink(points[v].col, layout.baseRow, points[v].col, tip, now, delay, {
        peak: 0.36 + Math.random() * 0.1,
        drawEnd: 0.12
      });
      delay += 8;
      addLink(points[v].col, tip, points[v].col, tip, now, delay, {
        peak: 0.48,
        point: true
      });
      delay += 8;
    }

    maxLinks = prevMax;
    return true;
  }

  function spawnHealth(now, drift) {
    /* Vitals band + pulse / ECG-style trace */
    var s = stageCells(drift);
    var startCol = s.minCol;
    var endCol = s.maxCol;
    var spanUsed = Math.max(1, endCol - startCol);
    var mid = s.cy;
    var amp = Math.max(2, Math.floor(s.spanH / 2.4));
    var bandTop = mid - Math.max(1, Math.floor(amp * 0.45));
    var bandBot = mid + Math.max(1, Math.floor(amp * 0.45));
    var delay = 0;

    addLink(startCol, s.maxRow, endCol, s.maxRow, now, delay, { peak: 0.16 });
    delay += 16;
    /* Healthy range band */
    addLink(startCol, bandTop, endCol, bandTop, now, delay, { peak: 0.18 });
    delay += 14;
    addLink(startCol, bandBot, endCol, bandBot, now, delay, { peak: 0.18 });
    delay += 18;

    var pts = Math.max(12, Math.min(28, spanUsed + 1));
    var step = Math.max(1, Math.floor(spanUsed / Math.max(1, pts - 1)));
    pts = Math.floor(spanUsed / step) + 1;
    var points = [];
    var phase = Math.floor(Math.random() * 5);
    for (var i = 0; i < pts; i++) {
      var c = evenCol(startCol, endCol, i, pts);
      var beat = (i + phase) % 5;
      var row = mid;
      if (beat === 1) row = mid - amp;
      else if (beat === 2) row = mid + Math.max(1, Math.floor(amp * 0.55));
      else if (beat === 3) row = mid - Math.max(1, Math.floor(amp * 0.25));
      else row = mid + pick([-1, 0, 0, 1]);
      row = Math.max(s.minRow, Math.min(s.maxRow - 1, row));
      points.push({ col: c, row: row });
    }

    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, {
        peak: 0.5 + Math.random() * 0.1
      });
      delay += 14 + Math.floor(Math.random() * 12);
    }
    markSeriesPoints(points, now, delay, 0.25 + Math.random() * 0.25);
    return points.length >= 8;
  }

  function spawnTelemetry(now, drift) {
    /* Multi-channel strip chart — stacked sensor streams */
    var s = stageCells(drift);
    var startCol = s.minCol;
    var endCol = s.maxCol;
    var spanUsed = Math.max(1, endCol - startCol);
    var channels = w < 480 ? 2 : (s.spanH >= 8 ? 3 : 2);
    var band = Math.max(2, Math.floor(s.spanH / channels));
    var top = s.cy - Math.floor(s.spanH / 2);
    var delay = 0;
    var made = 0;
    var pts = Math.max(6, Math.min(w < 480 ? 9 : 12, Math.round(spanUsed / (w < 480 ? 2.2 : 1.6)) + 1));
    var step = Math.max(1, Math.floor(spanUsed / Math.max(1, pts - 1)));
    pts = Math.floor(spanUsed / step) + 1;

    for (var ch = 0; ch < channels; ch++) {
      var lo = top + ch * band;
      var hi = lo + band - 1;
      var mid = Math.round((lo + hi) / 2);
      /* Channel rail */
      addLink(startCol, mid, endCol, mid, now, delay, { peak: 0.12 });
      delay += 12;

      var ys = randomSeriesYs(pts, lo, hi);
      var points = [];
      for (var i = 0; i < pts; i++) {
        var c = evenCol(startCol, endCol, i, pts);
        points.push({ col: c, row: ys[i] });
      }
      for (var p = 0; p < points.length - 1; p++) {
        addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, {
          peak: 0.42 + ch * 0.04 + Math.random() * 0.08
        });
        delay += 12 + Math.floor(Math.random() * 10);
        made++;
      }
      if (Math.random() < 0.6) markSeriesPoints(points, now, delay, 0.2);
      delay += 16;
    }
    return made >= 6;
  }

  function spawnGuilloche(now, drift) {
    var s = stageCells(drift);
    var hub = { col: s.cx, row: s.cy };
    if (!inBounds(hub.col, hub.row, drift)) return false;
    var delay = 0;
    var made = 0;
    var maxRX = Math.max(5, s.radiusX || Math.floor(s.spanW / 2));
    var maxRY = Math.max(3, s.radiusY || Math.floor(s.spanH / 2));
    var prevMax = maxLinks;
    maxLinks = Math.max(maxLinks, 80);

    function ringPoints(rx, ry, count, phase) {
      var pts = [];
      for (var i = 0; i < count; i++) {
        var a = phase + (Math.PI * 2 * i) / count;
        var c = hub.col + Math.round(Math.cos(a) * rx);
        var r = hub.row + Math.round(Math.sin(a) * ry);
        if (inBounds(c, r, drift)) pts.push({ col: c, row: r });
      }
      return pts;
    }

    function strokeClosed(pts, peak, lift) {
      if (pts.length < 5) return;
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i];
        var b = pts[(i + 1) % pts.length];
        addLink(a.col, a.row, b.col, b.row, now, delay, withArc({ peak: peak }, lift));
        delay += 16;
        made++;
      }
    }

    /* Concentric elliptical guilloche — one clear motif */
    var rings = Math.max(3, Math.min(4, maxRY));
    for (var ri = 0; ri < rings; ri++) {
      var t = (ri + 1) / rings;
      var rx = Math.max(3, Math.round(maxRX * t));
      var ry = Math.max(2, Math.round(maxRY * t));
      var count = Math.max(10, Math.min(20, rx * 3));
      var phase = (ri % 2) * (Math.PI / count);
      var pts = ringPoints(rx, ry, count, phase);
      strokeClosed(pts, 0.36 + ri * 0.04, pick([-10, -14, 10, 14]));
    }

    maxLinks = prevMax;
    return made >= 10;
  }

  function spawnFireworkBurst(now, drift, delayBase, asFinale) {
    if (!actCenter) return 0;
    var s = actCenter.metrics;
    /* Anchor in the header center — a composed crest, not scattered pops */
    var hubCol = actCenter.col;
    var hubRow = actCenter.row;
    if (!inBounds(hubCol, hubRow, drift)) {
      hubCol = s.cx;
      hubRow = s.cy;
    }

    var rx = Math.max(5, s.radiusX || Math.floor(s.spanW / 2));
    var ry = Math.max(3, s.radiusY || Math.floor(s.spanH / 2));
    var rays = randInt(10, 14);
    var delay = delayBase || 0;
    var life = (asFinale ? 9000 : 7800) + Math.random() * 2400;
    var added = 0;
    var tips = [];
    var phase = Math.random() * 0.12;

    for (var i = 0; i < rays; i++) {
      var angle = phase + (Math.PI * 2 * i) / rays;
      var scale = 0.82 + Math.random() * 0.18;
      var tipCol = hubCol + Math.round(Math.cos(angle) * rx * scale);
      var tipRow = hubRow + Math.round(Math.sin(angle) * ry * scale);
      if (!inBounds(tipCol, tipRow, drift)) continue;
      tips.push({ col: tipCol, row: tipRow, angle: angle });

      /* Long, soft champagne arcs from the hub — elliptical bloom */
      if (addLink(hubCol, hubRow, tipCol, tipRow, now, delay, {
        peak: asFinale ? 0.48 : 0.4,
        life: life,
        drawEnd: 0.28 + Math.random() * 0.1,
        fadeStart: 0.72 + Math.random() * 0.08,
        curve: 'arc',
        arcLift: pick([-1, 1]) * gap * randInt(2, 4),
        finale: !!asFinale,
        weight: 0.9
      })) added++;

      /* Jewel tip — a single soft point, no sparkle clutter */
      addLink(tipCol, tipRow, tipCol, tipRow, now, delay + 80, {
        point: true,
        peak: asFinale ? 0.62 : 0.52,
        life: life * 0.85,
        drawEnd: 0.2,
        fadeStart: 0.68,
        finale: !!asFinale
      });
      added++;
      delay += 48;
    }

    /* Outer halo — elegant ellipse connecting the tips */
    for (var n = 0; n < tips.length; n++) {
      var a = tips[n];
      var b = tips[(n + 1) % tips.length];
      if (addLink(a.col, a.row, b.col, b.row, now, (delayBase || 0) + 220 + n * 36, {
        peak: 0.26,
        life: life * 0.9,
        drawEnd: 0.35,
        fadeStart: 0.74,
        curve: 'arc',
        arcLift: pick([-1, 1]) * gap * 2,
        finale: !!asFinale,
        weight: 0.75
      })) added++;
    }

    /* Soft center point */
    addLink(hubCol, hubRow, hubCol, hubRow, now, delayBase || 0, {
      point: true,
      peak: asFinale ? 0.7 : 0.58,
      life: life,
      drawEnd: 0.15,
      fadeStart: 0.7,
      finale: !!asFinale
    });
    added++;

    return added;
  }

  function spawnFireworks(now, drift) {
    if (!actCenter) beginAct(drift);
    /* Single centered bloom for the header — luxurious and composed */
    return spawnFireworkBurst(now, drift, 0, false) >= 6;
  }

  function spawnFinaleWave(now, drift) {
    var before = links.length;
    var pickAct = pick([
      spawnSankey, spawnHistogram, spawnLollipopH, spawnLineChart, spawnStepChart,
      spawnTreemap, spawnScatter, spawnFinance, spawnForceNetwork, spawnDnaChart,
      spawnSlopeChart, spawnDumbbell, spawnParallelCoords, spawnArcDiagram,
      spawnAlluvial, spawnHeatGrid, spawnSpectrogram, spawnSoundWave,
      spawnStreets, spawnViolinChart, spawnFunnel
    ]);
    pickAct(now, drift);
    for (var i = before; i < links.length; i++) {
      links[i].finale = true;
      links[i].peak = Math.min(0.85, links[i].peak * 1.25);
      links[i].life = Math.max(links[i].life, 7200 + Math.random() * 2000);
      links[i].weight = Math.max(links[i].weight || 1, 1.1);
      links[i].fadeStart = Math.min(links[i].fadeStart, 0.72);
    }
    return links.length > before;
  }

  function startFinale(now) {
    var drift = driftAt(now);
    beginAct(drift);
    finaleActive = true;
    postFinale = false;
    maxLinks = maxLinksFinale;
    /* Rare fireworks crest, otherwise an amplified catalog act */
    if (Math.random() < 0.3) {
      spawnFireworkBurst(now, drift, 0, true);
    } else {
      spawnFinaleWave(now, drift);
    }
    showActive = true;
    nextSpawnIn = 8000 + Math.random() * 2000;
    recentTypes.push('finale');
    if (recentTypes.length > 2) recentTypes.shift();
  }

  function spawnComposition(now) {
    updateStage();
    if (!stage.ready) {
      nextSpawnIn = 800;
      return;
    }

    /* Wait for the current pattern to fully clear */
    if (links.length > 0) {
      showActive = true;
      nextSpawnIn = 400;
      return;
    }

    if (finaleActive) {
      finaleActive = false;
      maxLinks = maxLinksNormal;
      postFinale = true;
      showActive = false;
      actsSinceFinale = 0;
      nextSpawnIn = 1800 + Math.random() * 1200;
      return;
    }

    showActive = false;

    actsSinceFinale++;
    var wantFinale =
      (actsSinceFinale >= 6 && Math.random() < 0.22) ||
      actsSinceFinale >= 10;
    if (wantFinale) {
      startFinale(now);
      return;
    }

    var drift = driftAt(now);
    beginAct(drift);
    /*
     * Tight catalog — one silhouette per class where possible.
     * Rare acts (streets / violin / funnel) join ~40% of cycles.
     */
    var catalog = [
      { name: 'sankey', sil: 'flow', fn: spawnSankey },
      { name: 'hist', sil: 'bars', fn: spawnHistogram },
      { name: 'lollipop-h', sil: 'bars', fn: spawnLollipopH },
      { name: 'line', sil: 'line', fn: spawnLineChart },
      { name: 'treemap', sil: 'partition', fn: spawnTreemap },
      { name: 'step', sil: 'line', fn: spawnStepChart },
      { name: 'scatter', sil: 'points', fn: spawnScatter },
      { name: 'finance', sil: 'finance', fn: spawnFinance },
      { name: 'force', sil: 'network', fn: spawnForceNetwork },
      { name: 'dna', sil: 'helix', fn: spawnDnaChart },
      { name: 'slope', sil: 'slope', fn: spawnSlopeChart },
      { name: 'dumbbell', sil: 'range', fn: spawnDumbbell },
      { name: 'parallel', sil: 'axes', fn: spawnParallelCoords },
      { name: 'arc', sil: 'arc', fn: spawnArcDiagram },
      { name: 'alluvial', sil: 'flow', fn: spawnAlluvial },
      { name: 'heatgrid', sil: 'grid', fn: spawnHeatGrid },
      { name: 'spectrogram', sil: 'freq', fn: spawnSpectrogram },
      { name: 'soundwave', sil: 'wave', fn: spawnSoundWave }
    ];
    if (Math.random() < 0.4) catalog.push({ name: 'streets', sil: 'map', fn: spawnStreets });
    if (Math.random() < 0.4) catalog.push({ name: 'violin', sil: 'special', fn: spawnViolinChart });
    if (Math.random() < 0.4) catalog.push({ name: 'funnel', sil: 'funnel', fn: spawnFunnel });

    if (!actPlaylist.length) {
      actPlaylist = buildSilhouettePlaylist(catalog);
    }

    var choice = actPlaylist.shift();
    var before = links.length;
    var ok = choice.fn(now, drift);
    if (!ok || links.length === before) {
      var fallbackPool = catalog.slice();
      shuffleInPlace(fallbackPool);
      for (var f = 0; f < fallbackPool.length; f++) {
        if (fallbackPool[f].name === choice.name) continue;
        var prev = links.length;
        if (fallbackPool[f].fn(now, drift) && links.length > prev) {
          choice = fallbackPool[f];
          break;
        }
      }
    }

    /* Amplify this act — brighter peaks, shared choreography timing */
    for (var L = before; L < links.length; L++) {
      links[L].peak = Math.min(0.75, links[L].peak * (1.35 + Math.random() * 0.35));
      links[L].life = Math.max(links[L].life, 5600 + Math.random() * 1800);
      links[L].fadeStart = Math.max(links[L].fadeStart, 0.7 + Math.random() * 0.08);
      links[L].drawEnd = Math.min(links[L].drawEnd, 0.22 + Math.random() * 0.1);
    }

    recentTypes.push(choice.name);
    if (recentTypes.length > 3) recentTypes.shift();
    showActive = true;
    postFinale = false;

    /* Intermission after the act finishes (~life length) */
    nextSpawnIn = 5500 + Math.random() * 3500;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function quadPoint(p0, c, p1, t) {
    var u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
    };
  }

  function drawDot(x, y, alpha, size, focused, finale) {
    if (alpha < 0.03) return;
    var r = size || 0.55;
    if (focused || finale) {
      var glowR = r * (finale ? 8.5 : 5.5);
      var glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glow.addColorStop(0, 'rgba(255, 250, 235, ' + Math.min(0.95, alpha * (finale ? 1.15 : 0.95)) + ')');
      glow.addColorStop(0.22, 'rgba(255, 236, 190, ' + Math.min(0.55, alpha * (finale ? 0.7 : 0.55)) + ')');
      glow.addColorStop(0.5, 'rgba(209, 187, 119, ' + Math.min(0.28, alpha * (finale ? 0.4 : 0.3)) + ')');
      glow.addColorStop(1, 'rgba(209, 187, 119, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 252, 240, ' + Math.min(1, alpha * (finale ? 1.6 : 1.4)) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r * (finale ? 1.45 : 1.25), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = 'rgba(209, 187, 119, ' + alpha + ')';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function catmullRomPoint(p0, p1, p2, p3, t) {
    var t2 = t * t;
    var t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  function strokeLink(a, b, progress, alpha, curve, arcLift, weight, p0, p3) {
    ctx.lineWidth = 1.15 * (weight || 1);
    ctx.lineCap = 'round';

    if (curve === 'catmull' && p0 && p3) {
      var steps = Math.max(12, Math.floor(36 * progress));
      ctx.beginPath();
      var c0 = catmullRomPoint(p0, a, b, p3, 0);
      ctx.moveTo(c0.x, c0.y);
      for (var s = 1; s <= steps; s++) {
        var cpt = catmullRomPoint(p0, a, b, p3, (s / steps) * progress);
        ctx.lineTo(cpt.x, cpt.y);
      }
      var cEnd = catmullRomPoint(p0, a, b, p3, progress);
      var cGrad = ctx.createLinearGradient(a.x, a.y, cEnd.x, cEnd.y);
      cGrad.addColorStop(0, 'rgba(255, 236, 190, ' + (alpha * 0.45) + ')');
      cGrad.addColorStop(0.5, 'rgba(255, 244, 214, ' + alpha + ')');
      cGrad.addColorStop(1, 'rgba(232, 214, 160, ' + (alpha * 0.75) + ')');
      ctx.strokeStyle = cGrad;
      ctx.stroke();
      return cEnd;
    }

    if (curve === 'arc') {
      var ctrl = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + arcLift };
      var stepsA = Math.max(10, Math.floor(32 * progress));
      ctx.beginPath();
      var pStart = quadPoint(a, ctrl, b, 0);
      ctx.moveTo(pStart.x, pStart.y);
      for (var sa = 1; sa <= stepsA; sa++) {
        var pt = quadPoint(a, ctrl, b, (sa / stepsA) * progress);
        ctx.lineTo(pt.x, pt.y);
      }
      var end = quadPoint(a, ctrl, b, progress);
      var grad = ctx.createLinearGradient(a.x, a.y, end.x, end.y);
      grad.addColorStop(0, 'rgba(255, 236, 190, ' + (alpha * 0.45) + ')');
      grad.addColorStop(0.5, 'rgba(255, 244, 214, ' + alpha + ')');
      grad.addColorStop(1, 'rgba(232, 214, 160, ' + (alpha * 0.75) + ')');
      ctx.strokeStyle = grad;
      ctx.stroke();
      return end;
    }

    var x = a.x + (b.x - a.x) * progress;
    var y = a.y + (b.y - a.y) * progress;
    var grad2 = ctx.createLinearGradient(a.x, a.y, x, y);
    grad2.addColorStop(0, 'rgba(255, 236, 190, ' + (alpha * 0.45) + ')');
    grad2.addColorStop(0.5, 'rgba(255, 244, 214, ' + alpha + ')');
    grad2.addColorStop(1, 'rgba(232, 214, 160, ' + (alpha * 0.75) + ')');
    ctx.strokeStyle = grad2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    return { x: x, y: y };
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);

    if (!nextSpawnIn) nextSpawnIn = 800 + Math.random() * 600;
    if (now - lastSpawn > nextSpawnIn) {
      spawnComposition(now);
      lastSpawn = now;
    }

    updateStage();
    updateParallax();
    var center = actCenter
      ? { col: actCenter.col, row: actCenter.row, x: origin + actCenter.col * gap, y: origin + actCenter.row * gap }
      : liveCenter();
    ctx.clearRect(0, 0, w, h);

    /* Fade with the hero as it leaves — art still parallaxes behind content */
    var scrollFade = 1;
    if (stage.ready) {
      if (stage.bottom <= 40) scrollFade = 0;
      else if (stage.top < 0) {
        scrollFade = Math.max(0, Math.min(1, stage.bottom / Math.max(stage.height * 0.85, 1)));
      }
    } else {
      scrollFade = 0;
    }

    /* Still age/cull links when offstage, but skip expensive strokes */
    if (scrollFade < 0.01) {
      for (var z = links.length - 1; z >= 0; z--) {
        var Lz = links[z];
        var ageZ = now - Lz.born;
        if (ageZ >= Lz.life) links.splice(z, 1);
      }
      return;
    }

    var degree = {};
    function key(c, r) { return c + ',' + r; }
    for (var d = 0; d < links.length; d++) {
      var L0 = links[d];
      if (now - L0.born < 0 || now - L0.born >= L0.life) continue;
      degree[key(L0.ox1, L0.oy1)] = (degree[key(L0.ox1, L0.oy1)] || 0) + 1;
      degree[key(L0.ox2, L0.oy2)] = (degree[key(L0.ox2, L0.oy2)] || 0) + 1;
    }

    for (var i = links.length - 1; i >= 0; i--) {
      var L = links[i];
      var age = now - L.born;
      if (age < 0) continue;
      if (age >= L.life) {
        links.splice(i, 1);
        continue;
      }

      /* Size is locked at spawn — no live rescaling that shifts positions */
      var a = resolvePoint(L.ox1, L.oy1, 0, 1, center);
      var b = resolvePoint(L.ox2, L.oy2, 0, 1, center);
      var p = age / L.life;
      var progress = p < L.drawEnd ? easeOutCubic(p / L.drawEnd) : 1;
      var visibility = p < L.fadeStart
        ? 1
        : 1 - easeInOut((p - L.fadeStart) / (1 - L.fadeStart));
      var falloff = Math.min(stageFalloff(a.x, a.y), stageFalloff(b.x, b.y));
      var alpha = L.peak * visibility * Math.max(falloff, scrollFade * 0.35) * scrollFade;
      if (alpha < 0.012) continue;

      if (L.point) {
        var pop = progress < 1 ? progress : 1;
        drawDot(a.x, a.y, Math.min(1, alpha * 2.2), 0.7 + pop * 0.35, true, false);
        continue;
      }

      var p0 = (L.curve === 'catmull' && L.ox0 != null)
        ? resolvePoint(L.ox0, L.oy0, 0, 1, center)
        : null;
      var p3 = (L.curve === 'catmull' && L.ox3 != null)
        ? resolvePoint(L.ox3, L.oy3, 0, 1, center)
        : null;
      var end = strokeLink(a, b, progress, alpha, L.curve, L.arcLift, L.weight, p0, p3);
      var degA = degree[key(L.ox1, L.oy1)] || 1;
      var degB = degree[key(L.ox2, L.oy2)] || 1;
      var inFocus = progress > 0.05 && visibility > 0.5;
      var focusBoost = inFocus ? (L.finale ? 2.4 : 1.85) : (L.finale ? 1.35 : 1);
      var hubSize = degA >= 3 || degB >= 3 ? (L.finale ? 1.55 : 1.2) : (L.finale ? 0.9 : 0.65);

      drawDot(a.x, a.y, Math.min(1, alpha * 2.1 * focusBoost), degA >= 3 ? hubSize : hubSize * 0.75, inFocus, L.finale);
      drawDot(end.x, end.y, Math.min(1, alpha * 1.9 * focusBoost * Math.max(0.35, progress)), L.finale ? 0.85 : 0.65, inFocus && progress > 0.15, L.finale);
      /* Always land a clear terminal dot once the stroke is nearly complete */
      if (progress >= 0.92) {
        drawDot(b.x, b.y, Math.min(1, alpha * 2.2 * focusBoost), degB >= 3 ? hubSize : Math.max(hubSize * 0.85, 0.7), inFocus, L.finale);
      }
    }

    if (links.length === 0 && showActive) {
      showActive = false;
      /* Breath of darkness before the next act */
      nextSpawnIn = postFinale
        ? 2800 + Math.random() * 2200
        : 1200 + Math.random() * 1600;
      postFinale = false;
      lastSpawn = now;
    }
  }

  function onViewportChange() {
    resize();
  }

  resize();
  updateParallax();
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', function () {
    setTimeout(onViewportChange, 80);
  });
  window.addEventListener('scroll', function () {
    updateParallax();
    updateStage();
  }, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', function () {
      updateParallax();
      updateStage();
    });
  }
  if (typeof ResizeObserver !== 'undefined') {
    var heroEl = findHero();
    if (heroEl) {
      var ro = new ResizeObserver(function () { onViewportChange(); });
      ro.observe(heroEl);
      var titleEl = heroEl.querySelector('h1');
      if (titleEl) ro.observe(titleEl);
    }
  }
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) {
      lastSpawn = performance.now();
      nextSpawnIn = 600 + Math.random() * 500;
      requestAnimationFrame(frame);
    }
  });

  lastSpawn = performance.now();
  nextSpawnIn = 900 + Math.random() * 700;
  requestAnimationFrame(frame);
})();
