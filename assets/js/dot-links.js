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
  var maxLinksNormal = 28;
  var maxLinksFinale = 28;
  var maxLinks = maxLinksNormal;
  var cols = 0;
  var rows = 0;
  var w = 0;
  var h = 0;
  var dpr = 1;
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
  var parallaxFactor = 0.4;
  var parallaxY = 0;

  function updateParallax() {
    var sy = window.scrollY || document.documentElement.scrollTop || 0;
    parallaxY = -sy * parallaxFactor;
    document.documentElement.style.setProperty('--parallax-y', parallaxY + 'px');
  }

  function updateStage() {
    var hero = document.querySelector('main > .hero:not(.about-hero)');
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

    /* Header canvas: the open field between nav and title */
    var fieldLeft = hr.left + 16;
    var fieldRight = hr.right - 16;
    var fieldTop = Math.max(hr.top, navBottom) + 16;
    var fieldBottom = titleBox
      ? Math.min(titleBox.top - 20, hr.bottom - 8)
      : hr.bottom - 24;
    var fieldW = Math.max(0, fieldRight - fieldLeft);
    var fieldH = Math.max(0, fieldBottom - fieldTop);

    /* Compose a wide landscape rectangle in the header — never square */
    var aspectMin = 2.4;
    stage.width = Math.max(140, fieldW * 0.7);
    stage.height = Math.min(fieldH * 0.88, stage.width / aspectMin);
    if (stage.height < 56) stage.height = Math.min(fieldH * 0.88, 56);
    if (stage.width / Math.max(1, stage.height) < aspectMin) {
      stage.height = stage.width / aspectMin;
    }
    if (stage.height > fieldH * 0.92) {
      stage.height = Math.max(48, fieldH * 0.92);
    }
    stage.cx = (fieldLeft + fieldRight) / 2;
    stage.cy = (fieldTop + fieldBottom) / 2;
    stage.left = stage.cx - stage.width / 2;
    stage.right = stage.cx + stage.width / 2;
    stage.top = stage.cy - stage.height / 2;
    stage.bottom = stage.cy + stage.height / 2;

    stage.ready =
      stage.height > 48 &&
      stage.width > 100 &&
      stage.bottom > 24 &&
      stage.top < h - 24;

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
    w = window.innerWidth;
    h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / gap) + 2;
    rows = Math.ceil(h / gap) + 2;
    updateStage();
  }

  function inStage(x, y) {
    if (!stage.ready) return false;
    return x >= stage.left && x <= stage.right && y >= stage.top && y <= stage.bottom;
  }

  function stageFalloff(x, y) {
    if (!stage.ready) return 0;
    if (!inStage(x, y)) return 0;
    var padX = Math.min(56, stage.width * 0.14);
    var padY = Math.min(40, stage.height * 0.16);
    var fx = 1;
    var fy = 1;
    if (x < stage.left + padX) fx = (x - stage.left) / padX;
    else if (x > stage.right - padX) fx = (stage.right - x) / padX;
    if (y < stage.top + padY) fy = (y - stage.top) / padY;
    else if (y > stage.bottom - padY) fy = (stage.bottom - y) / padY;
    return Math.max(0, Math.min(1, fx)) * Math.max(0, Math.min(1, fy));
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

  function inBounds(col, row, drift) {
    var p = gridPoint(col, row);
    return inStage(p.x, p.y) && stageFalloff(p.x, p.y) >= 0.15;
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

    /* Header field — wide landscape composition (shrink height, never invent width) */
    var halfW = Math.max(5, Math.floor((stage.width * 0.5) / gap));
    var halfH = Math.max(2, Math.floor((stage.height * 0.5) / gap));
    var cellAspect = 2.2;
    if (halfW / Math.max(1, halfH) < cellAspect) {
      halfH = Math.max(2, Math.floor(halfW / cellAspect));
    }
    var width = halfW * 2;
    var height = halfH * 2;
    var spanW = Math.max(10, width);
    var spanH = Math.max(3, Math.min(height, Math.floor(spanW / cellAspect)));
    halfH = Math.max(2, Math.floor(spanH / 2));
    height = halfH * 2;
    spanH = height;
    var radiusX = Math.max(4, Math.floor(spanW / 2));
    var radiusY = Math.max(2, Math.floor(spanH / 2));
    var radius = Math.min(radiusX, radiusY);

    return {
      minCol: c.col - halfW,
      maxCol: c.col + halfW,
      minRow: c.row - halfH,
      maxRow: c.row + halfH,
      width: width,
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
    var col = hub.col - Math.floor(s.spanW / 2);
    var row = hub.row + Math.floor(s.spanH / 2);
    if (!inBounds(col, row, drift)) {
      col = s.minCol + 1;
      row = s.maxRow - 1;
    }
    if (!inBounds(col, row, drift)) return null;
    return { col: col, row: row, metrics: s };
  }

  /* Centered landscape series — fills spanW and sits on stage mid */
  function seriesLayout(drift, minPts, maxPts, density) {
    var s = actCenter ? actCenter.metrics : stageCells(drift);
    var hub = actCenter || { col: s.cx, row: s.cy };
    var baseRow = hub.row + Math.floor(s.spanH / 2);
    if (!inBounds(hub.col, baseRow, drift)) {
      baseRow = s.maxRow - 1;
    }
    if (!inBounds(hub.col, baseRow, drift)) return null;

    var pts = Math.max(minPts, Math.min(maxPts, Math.round(s.spanW / (density || 1.2))));
    var step = Math.max(1, Math.floor(s.spanW / Math.max(1, pts - 1)));
    var spanUsed = (pts - 1) * step;
    var startCol = hub.col - Math.floor(spanUsed / 2);
    return {
      startCol: startCol,
      baseRow: baseRow,
      pts: pts,
      step: step,
      spanUsed: spanUsed,
      metrics: s,
      hub: hub
    };
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
    var s = stageCells(drift);
    var count = Math.max(6, Math.min(11, Math.round(s.spanW / 2) + 1));
    var spacing = Math.max(2, Math.floor(s.spanW / (count - 1)));
    var startCol = s.cx - Math.floor(((count - 1) * spacing) / 2);
    var row = s.cy + Math.floor(s.spanH * 0.28);
    var nodes = [];
    for (var i = 0; i < count; i++) {
      var c = startCol + i * spacing;
      if (!inBounds(c, row, drift)) continue;
      nodes.push({ col: c, row: row });
    }
    if (nodes.length < 5) return false;
    var delay = 0;
    for (var n = 0; n < nodes.length - 1; n++) {
      addLink(nodes[n].col, nodes[n].row, nodes[n + 1].col, nodes[n + 1].row, now, delay, { peak: 0.22 });
      delay += 35;
    }
    var pairs = [
      [0, 2], [1, 3], [0, 3], [2, 4], [1, 4], [0, 4],
      [2, nodes.length - 1], [1, nodes.length - 1], [0, nodes.length - 1],
      [3, nodes.length - 1], [0, 5], [1, 5], [2, 5], [3, 5],
      [0, nodes.length - 2], [2, nodes.length - 2], [1, nodes.length - 2]
    ];
    var arcsMade = 0;
    for (var p = 0; p < pairs.length; p++) {
      var a = pairs[p][0];
      var b = pairs[p][1];
      if (b >= nodes.length || a >= nodes.length) continue;
      if (Math.random() > 0.82 && arcsMade >= 6) continue;
      var span = b - a;
      if (span < 2) continue;
      addLink(nodes[a].col, nodes[a].row, nodes[b].col, nodes[b].row, now, delay, {
        peak: 0.42,
        curve: 'arc',
        arcLift: -(span * gap * 1.15 + s.spanH * gap * 0.12),
        drawEnd: 0.38
      });
      delay += 55;
      arcsMade++;
    }
    return arcsMade >= 4;
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
    var colL = s.cx - Math.floor(s.spanW / 2);
    var colR = s.cx + Math.floor(s.spanW / 2);
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
          var dy = dest.row - from[i].row;
          var lift = dy === 0
            ? pick([-18, -26, 18, 26])
            : (dy > 0 ? pick([16, 24, 32]) : pick([-16, -24, -32]));
          addLink(from[i].col, from[i].row, dest.col, dest.row, now, delay, {
            peak: 0.46,
            curve: 'arc',
            arcLift: lift,
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
    var pts = Math.max(7, Math.min(14, Math.round(s.spanW / 1.4)));
    var step = Math.max(2, Math.floor(s.spanW / (pts - 1)));
    var startCol = s.cx - Math.floor(((pts - 1) * step) / 2);
    var meanRow = s.cy;
    var maxSpread = Math.max(3, Math.floor(s.spanH / 2));
    var delay = 0;
    var means = [];
    var highs = [];
    var lows = [];

    var mean = meanRow;
    for (var i = 0; i < pts; i++) {
      mean = Math.max(
        s.cy - Math.floor(maxSpread * 0.45),
        Math.min(s.cy + Math.floor(maxSpread * 0.45), mean + pick([-2, -1, 0, 0, 1, 2]))
      );
      var spread = randInt(Math.max(2, Math.floor(maxSpread * 0.35)), maxSpread);
      var c = startCol + i * step;
      var hi = mean - spread;
      var lo = mean + Math.max(1, Math.floor(spread * (0.55 + Math.random() * 0.45)));
      if (!inBounds(c, mean, drift) || !inBounds(c, hi, drift) || !inBounds(c, lo, drift)) {
        if (means.length >= 5) break;
        continue;
      }
      means.push({ col: c, row: mean });
      highs.push({ col: c, row: hi });
      lows.push({ col: c, row: lo });
    }
    if (means.length < 5) return false;

    /* Baseline axis */
    addLink(means[0].col, lows[lows.length - 1].row + 1, means[means.length - 1].col, lows[lows.length - 1].row + 1, now, delay, { peak: 0.18 });
    delay += 35;

    /* Upper / lower band envelopes */
    for (var u = 0; u < highs.length - 1; u++) {
      addLink(highs[u].col, highs[u].row, highs[u + 1].col, highs[u + 1].row, now, delay,
        withArc({ peak: 0.32 }, pick([-10, -14, 10])));
      delay += 28;
    }
    for (var l = 0; l < lows.length - 1; l++) {
      addLink(lows[l].col, lows[l].row, lows[l + 1].col, lows[l + 1].row, now, delay,
        withArc({ peak: 0.32 }, pick([10, 14, -10])));
      delay += 28;
    }

    /* Mean line through the band */
    for (var m = 0; m < means.length - 1; m++) {
      addLink(means[m].col, means[m].row, means[m + 1].col, means[m + 1].row, now, delay,
        withArc({ peak: 0.55 }, pick([-8, 8, -12, 12])));
      delay += 36;
    }

    /* Variance whiskers at each sample */
    for (var wi = 0; wi < means.length; wi++) {
      addLink(highs[wi].col, highs[wi].row, lows[wi].col, lows[wi].row, now, delay, { peak: 0.4 });
      /* Cap ticks */
      if (inBounds(highs[wi].col - 1, highs[wi].row, drift) && inBounds(highs[wi].col + 1, highs[wi].row, drift)) {
        addLink(highs[wi].col - 1, highs[wi].row, highs[wi].col + 1, highs[wi].row, now, delay + 12, { peak: 0.36 });
      }
      if (inBounds(lows[wi].col - 1, lows[wi].row, drift) && inBounds(lows[wi].col + 1, lows[wi].row, drift)) {
        addLink(lows[wi].col - 1, lows[wi].row, lows[wi].col + 1, lows[wi].row, now, delay + 18, { peak: 0.36 });
      }
      delay += 40;
    }
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
    var s = stageCells(drift);
    var len = Math.max(10, Math.min(18, s.spanW));
    var step = Math.max(1, Math.floor(s.spanW / (len - 1)));
    var startCol = s.cx - Math.floor(((len - 1) * step) / 2);
    var amp = Math.max(2, Math.min(Math.floor(s.spanH / 2), Math.round(s.spanH * 0.42)));
    var cycles = 1.5 + Math.random() * 1.25;
    var delay = 0;
    var strandA = [];
    var strandB = [];

    for (var i = 0; i < len; i++) {
      var t = i / Math.max(1, len - 1);
      var angle = t * Math.PI * 2 * cycles;
      var c = startCol + i * step;
      var rowA = s.cy + Math.round(Math.sin(angle) * amp);
      var rowB = s.cy + Math.round(Math.sin(angle + Math.PI) * amp);
      if (!inBounds(c, rowA, drift) || !inBounds(c, rowB, drift)) {
        if (strandA.length >= 6) break;
        continue;
      }
      strandA.push({ col: c, row: rowA });
      strandB.push({ col: c, row: rowB });
    }
    if (strandA.length < 6) return false;

    /* Twin helix strands — sideways */
    for (var a = 0; a < strandA.length - 1; a++) {
      addLink(strandA[a].col, strandA[a].row, strandA[a + 1].col, strandA[a + 1].row, now, delay,
        withArc({ peak: 0.5 }, pick([-10, -14, 10, 14])));
      delay += 28;
    }
    for (var b = 0; b < strandB.length - 1; b++) {
      addLink(strandB[b].col, strandB[b].row, strandB[b + 1].col, strandB[b + 1].row, now, delay,
        withArc({ peak: 0.5 }, pick([10, 14, -10, -14])));
      delay += 28;
    }

    /* Base-pair rungs between strands */
    for (var r = 0; r < strandA.length; r++) {
      if (r % 2 === 1 && Math.random() < 0.25) continue;
      addLink(strandA[r].col, strandA[r].row, strandB[r].col, strandB[r].row, now, delay, {
        peak: 0.38,
        drawEnd: 0.22
      });
      delay += 36;
    }
    return true;
  }

  function spawnLineChart(now, drift) {
    var layout = seriesLayout(drift, 8, 16, 1.15);
    if (!layout) return false;
    var s = layout.metrics;
    var delay = 0;
    var points = [];
    var y = layout.baseRow - Math.floor(s.spanH * 0.4);
    for (var i = 0; i < layout.pts; i++) {
      y = Math.max(layout.baseRow - s.spanH, Math.min(layout.baseRow - 1, y + pick([-3, -2, -1, 1, 2, 3])));
      var c = layout.startCol + i * layout.step;
      if (!inBounds(c, y, drift)) break;
      points.push({ col: c, row: y });
    }
    if (points.length < 4) return false;

    addLink(points[0].col, layout.baseRow, points[points.length - 1].col, layout.baseRow, now, delay, { peak: 0.2 });
    delay += 35;

    for (var p = 0; p < points.length - 1; p++) {
      var prev = points[Math.max(0, p - 1)];
      var next = points[Math.min(points.length - 1, p + 2)];
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay,
        withCatmull({ peak: 0.5 }, prev, next));
      delay += 36;
    }
    return true;
  }

  function spawnStepChart(now, drift) {
    var layout = seriesLayout(drift, 7, 14, 1.3);
    if (!layout) return false;
    var s = layout.metrics;
    var delay = 0;
    var points = [];
    var y = layout.baseRow - Math.floor(s.spanH * 0.4);
    for (var i = 0; i < layout.pts; i++) {
      y = Math.max(layout.baseRow - s.spanH, Math.min(layout.baseRow - 1, y + pick([-3, -2, -1, 1, 2, 3])));
      var c = layout.startCol + i * layout.step;
      if (!inBounds(c, y, drift)) break;
      points.push({ col: c, row: y });
    }
    if (points.length < 4) return false;

    addLink(points[0].col, layout.baseRow, points[points.length - 1].col, layout.baseRow, now, delay, { peak: 0.2 });
    delay += 30;

    /* Classic step: hold level, then jump — horizontal then vertical */
    for (var p = 0; p < points.length - 1; p++) {
      var a = points[p];
      var b = points[p + 1];
      if (a.row !== b.row && inBounds(b.col, a.row, drift)) {
        addLink(a.col, a.row, b.col, a.row, now, delay, { peak: 0.5 });
        delay += 28;
        addLink(b.col, a.row, b.col, b.row, now, delay, { peak: 0.48 });
        delay += 24;
      } else {
        addLink(a.col, a.row, b.col, b.row, now, delay, { peak: 0.5 });
        delay += 32;
      }
    }
    return true;
  }

  function spawnTreemap(now, drift) {
    var s = stageCells(drift);
    var left = s.cx - Math.floor(s.spanW / 2);
    var right = s.cx + Math.floor(s.spanW / 2);
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
      var c = startCol + i * step;
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
    var s = stageCells(drift);
    var axes = Math.max(4, Math.min(6, Math.round(s.spanW / 3)));
    var step = Math.max(2, Math.floor(s.spanW / (axes - 1)));
    var startCol = s.cx - Math.floor(((axes - 1) * step) / 2);
    var top = s.cy - Math.floor(s.spanH / 2);
    var bottom = s.cy + Math.floor(s.spanH / 2);
    var delay = 0;
    var made = 0;
    var axisCols = [];

    for (var a = 0; a < axes; a++) {
      var c = startCol + a * step;
      if (!inBounds(c, top, drift) || !inBounds(c, bottom, drift)) continue;
      axisCols.push(c);
      addLink(c, top, c, bottom, now, delay, { peak: 0.16 });
      delay += 20;
      made++;
    }
    if (axisCols.length < 3) return false;

    /* One polyline across the axes */
    var points = [];
    for (var i = 0; i < axisCols.length; i++) {
      var r = randInt(top + 1, bottom - 1);
      if (!inBounds(axisCols[i], r, drift)) continue;
      points.push({ col: axisCols[i], row: r });
    }
    if (points.length < 3) return false;
    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay,
        withArc({ peak: 0.46 }, pick([-18, -26, 18, 26])));
      delay += 40;
      made++;
    }
    return made >= 5;
  }

  function spawnScatter(now, drift) {
    var s = stageCells(drift);
    var halfW = Math.floor(s.spanW / 2);
    var halfH = Math.floor(s.spanH / 2);
    var dots = Math.max(14, Math.min(36, Math.round((s.spanW * s.spanH) / 6)));
    var delay = 0;
    var made = 0;
    var used = {};

    for (var i = 0; i < dots * 3 && made < dots; i++) {
      var c = s.cx + randInt(-halfW, halfW);
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
    var layout = seriesLayout(drift, 7, 14, 1.25);
    if (!layout) return false;
    var s = layout.metrics;
    var delay = 0;
    var points = [];
    var y = layout.baseRow - Math.floor(s.spanH * 0.45);
    for (var i = 0; i < layout.pts; i++) {
      y = Math.max(layout.baseRow - s.spanH, Math.min(layout.baseRow - 1, y + pick([-2, -1, 1, 2])));
      var c = layout.startCol + i * layout.step;
      if (!inBounds(c, y, drift)) break;
      points.push({ col: c, row: y });
    }
    if (points.length < 4) return false;

    addLink(points[0].col, layout.baseRow, points[points.length - 1].col, layout.baseRow, now, delay, { peak: 0.2 });
    delay += 30;
    for (var p = 0; p < points.length - 1; p++) {
      var prev = points[Math.max(0, p - 1)];
      var next = points[Math.min(points.length - 1, p + 2)];
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay,
        withCatmull({ peak: 0.48 }, prev, next));
      delay += 32;
    }
    for (var v = 0; v < points.length; v++) {
      addLink(points[v].col, points[v].row, points[v].col, layout.baseRow, now, delay, { peak: 0.24 });
      delay += 26;
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
    var originN = originForChart(drift);
    if (!originN) return false;
    var s = originN.metrics;
    /* Dense stem row across most of the stage — the lollipop look */
    var bins = Math.max(12, Math.min(s.spanW + 2, Math.round(s.width * 0.7)));
    var startCol = s.cx - Math.floor(bins / 2);
    var baseRow = s.cy + Math.floor(s.spanH / 2);
    if (!inBounds(startCol, baseRow, drift)) {
      startCol = originN.col;
      baseRow = originN.row;
      bins = s.spanW;
    }
    var maxH = Math.max(4, Math.min(s.spanH, baseRow - s.minRow - 1));
    var delay = 0;
    var endCol = startCol + bins - 1;
    if (!inBounds(endCol, baseRow, drift)) {
      bins = Math.max(8, endCol - startCol);
      endCol = startCol + bins - 1;
    }

    addLink(startCol, baseRow, endCol, baseRow, now, delay, { peak: 0.28 });
    delay += 30;

    var made = 0;
    for (var i = 0; i < bins; i++) {
      var c = startCol + i;
      var ht = randInt(Math.max(2, Math.floor(maxH * 0.15)), maxH);
      if (!inBounds(c, baseRow - ht, drift)) continue;
      addLink(c, baseRow, c, baseRow - ht, now, delay, {
        peak: 0.52,
        drawEnd: 0.16,
        fadeStart: 0.72
      });
      delay += 22;
      made++;
    }
    return made >= 8;
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
      spawnSankey, spawnHistogram, spawnLineChart, spawnStepChart,
      spawnTreemap, spawnAreaChart, spawnVarianceChart, spawnScatter
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
    maxLinks = maxLinksNormal;
    /* One amplified pattern only — no stacked waves */
    spawnFinaleWave(now, drift);
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
    /* Data-visualization lineup — one pattern at a time */
    var catalog = [
      { name: 'sankey', fn: spawnSankey, w: 8 },
      { name: 'hist', fn: spawnHistogram, w: 7 },
      { name: 'line', fn: spawnLineChart, w: 7 },
      { name: 'treemap', fn: spawnTreemap, w: 7 },
      { name: 'step', fn: spawnStepChart, w: 6 },
      { name: 'area', fn: spawnAreaChart, w: 6 },
      { name: 'variance', fn: spawnVarianceChart, w: 6 },
      { name: 'scatter', fn: spawnScatter, w: 5 }
    ];

    var pool = [];
    for (var i = 0; i < catalog.length; i++) {
      if (recentTypes.indexOf(catalog[i].name) !== -1) continue;
      for (var wgt = 0; wgt < catalog[i].w; wgt++) pool.push(catalog[i]);
    }
    if (!pool.length) pool = catalog;

    var choice = pool[Math.floor(Math.random() * pool.length)];
    var before = links.length;
    var ok = choice.fn(now, drift);
    if (!ok || links.length === before) {
      var fallback = catalog[Math.floor(Math.random() * catalog.length)];
      fallback.fn(now, drift);
      choice = fallback;
    }

    /* Amplify this act — brighter peaks, shared choreography timing */
    for (var L = before; L < links.length; L++) {
      links[L].peak = Math.min(0.75, links[L].peak * 1.55);
      links[L].life = Math.max(links[L].life, 5800);
      links[L].fadeStart = Math.max(links[L].fadeStart, 0.74);
      links[L].drawEnd = Math.min(links[L].drawEnd, 0.28);
    }

    recentTypes.push(choice.name);
    if (recentTypes.length > 2) recentTypes.shift();
    showActive = true;
    postFinale = false;

    /* Intermission after the act finishes (~life length) */
    nextSpawnIn = 6500 + Math.random() * 2800;
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
      if (progress >= 1) {
        drawDot(b.x, b.y, Math.min(1, alpha * 2.1 * focusBoost), degB >= 3 ? hubSize : hubSize * 0.75, inFocus, L.finale);
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
    var heroEl = document.querySelector('main > .hero:not(.about-hero)');
    if (heroEl) {
      var ro = new ResizeObserver(function () { updateStage(); });
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
