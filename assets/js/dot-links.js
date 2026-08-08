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
  var driftPeriod = 120000;
  var driftDist = 160;
  var links = [];
  var maxLinksNormal = 36;
  var maxLinksFinale = 110;
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

  function updateStage() {
    var hero = document.querySelector('main > .hero:not(.about-hero)');
    var nav = document.querySelector('.nav');
    if (!hero) {
      stage.ready = false;
      return;
    }

    var hr = hero.getBoundingClientRect();
    var title = hero.querySelector('h1');
    var titleBox = title ? title.getBoundingClientRect() : null;
    var navBottom = nav ? nav.getBoundingClientRect().bottom : 0;

    stage.left = hr.left + 8;
    stage.right = hr.right - 8;
    stage.top = Math.max(hr.top, navBottom) + 12;
    stage.bottom = titleBox
      ? Math.min(titleBox.top - 16, hr.bottom - 8)
      : hr.bottom - 24;

    stage.width = Math.max(0, stage.right - stage.left);
    stage.height = Math.max(0, stage.bottom - stage.top);
    stage.cx = (stage.left + stage.right) / 2;
    stage.cy = (stage.top + stage.bottom) / 2;

    stage.ready =
      stage.height > 72 &&
      stage.width > 100 &&
      stage.bottom > 24 &&
      stage.top < h - 24;
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

  function driftAt(now) {
    return (((now - start) % driftPeriod) / driftPeriod) * driftDist;
  }

  function inStage(x, y) {
    if (!stage.ready) return false;
    return x >= stage.left && x <= stage.right && y >= stage.top && y <= stage.bottom;
  }

  function stageFalloff(x, y) {
    if (!stage.ready) return 0;
    if (!inStage(x, y)) return 0;
    var padX = Math.min(40, stage.width * 0.1);
    var padY = Math.min(32, stage.height * 0.12);
    var fx = 1;
    var fy = 1;
    if (x < stage.left + padX) fx = (x - stage.left) / padX;
    else if (x > stage.right - padX) fx = (stage.right - x) / padX;
    if (y < stage.top + padY) fy = (y - stage.top) / padY;
    else if (y > stage.bottom - padY) fy = (stage.bottom - y) / padY;
    return Math.max(0, Math.min(1, fx)) * Math.max(0, Math.min(1, fy));
  }

  function liveCenter(drift) {
    if (!stage.ready) return null;
    var col = Math.round((stage.cx - drift - origin) / gap);
    var row = Math.round((stage.cy - drift - origin) / gap);
    return {
      col: col,
      row: row,
      x: origin + col * gap + drift,
      y: origin + row * gap + drift
    };
  }

  function gridPoint(col, row, drift) {
    return {
      x: origin + col * gap + drift,
      y: origin + row * gap + drift
    };
  }

  function resolvePoint(ox, oy, drift, scale, center) {
    var c = center || liveCenter(drift);
    if (!c) return { x: -9999, y: -9999 };
    var s = scale == null ? 1 : scale;
    return gridPoint(c.col + Math.round(ox * s), c.row + Math.round(oy * s), drift);
  }

  function inBounds(col, row, drift) {
    var p = gridPoint(col, row, drift);
    return inStage(p.x, p.y) && stageFalloff(p.x, p.y) >= 0.15;
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
    if (col1 === col2 && row1 === row2) return false;
    if (!actCenter) return false;
    opts = opts || {};
    var c = actCenter;
    var peakBase = opts.peak != null ? opts.peak : 0.42;
    links.push({
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
      weight: opts.weight || 1
    });
    return true;
  }

  function stageCells(drift) {
    var c = liveCenter(drift);
    if (!c || !stage.ready) {
      return {
        minCol: 0, maxCol: 10, minRow: 0, maxRow: 8,
        width: 10, height: 8, spanW: 7, spanH: 5, radius: 4,
        cx: 5, cy: 4
      };
    }

    var halfW = Math.max(3, Math.floor((stage.width * 0.5) / gap));
    var halfH = Math.max(2, Math.floor((stage.height * 0.5) / gap));
    var width = halfW * 2;
    var height = halfH * 2;
    var spanW = Math.max(6, Math.round(width * 0.7));
    var spanH = Math.max(4, Math.round(height * 0.7));
    spanW = Math.min(spanW, Math.max(4, width - 2));
    spanH = Math.min(spanH, Math.max(3, height - 2));
    var radius = Math.max(3, Math.min(
      Math.floor(spanW / 2),
      Math.floor(spanH / 2),
      Math.round(Math.min(width, height) * 0.35)
    ));

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
      cx: c.col,
      cy: c.row
    };
  }

  function beginAct(drift) {
    updateStage();
    var s = stageCells(drift);
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
    var useFour = s.spanW >= 10 && Math.random() < 0.4;
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
        var targets = randInt(2, Math.min(4, to.length));
        for (var t = 0; t < targets; t++) {
          if (Math.random() > chance) continue;
          var dest = pick(to);
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
          delay += 40;
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

    spine(left, 0.18);
    spine(mid, 0.16);
    if (mid2) spine(mid2, 0.16);
    spine(right, 0.18);

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

  function spawnLineChart(now, drift) {
    var originN = originForChart(drift);
    if (!originN) return false;
    var s = originN.metrics;
    var pts = Math.max(6, Math.min(10, Math.round(s.spanW / 2)));
    var step = Math.max(2, Math.floor(s.spanW / (pts - 1)));
    var delay = 0;
    var points = [];
    var y = originN.row - Math.floor(s.spanH * 0.4);
    for (var i = 0; i < pts; i++) {
      y = Math.max(originN.row - s.spanH, Math.min(originN.row - 1, y + pick([-3, -2, -1, 1, 2, 3])));
      var c = originN.col + i * step;
      if (!inBounds(c, y, drift)) break;
      points.push({ col: c, row: y });
    }
    if (points.length < 4) return false;

    addLink(originN.col, originN.row, points[points.length - 1].col, originN.row, now, delay, { peak: 0.24 });
    delay += 45;

    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay,
        withArc({ peak: 0.46 }, pick([-14, -20, 14, 20])));
      delay += 50;
    }
    return true;
  }

  function spawnScatter(now, drift) {
    var originN = originForChart(drift);
    if (!originN) return false;
    var s = originN.metrics;
    var wCells = s.spanW;
    var hCells = s.spanH;
    if (!inBounds(originN.col + wCells, originN.row - hCells, drift)) return false;
    var delay = 0;

    addLink(originN.col, originN.row, originN.col + wCells, originN.row, now, delay, { peak: 0.24 });
    delay += 40;

    var dots = Math.max(8, Math.round((wCells * hCells) / 10));
    for (var i = 0; i < dots; i++) {
      var c = originN.col + randInt(1, wCells - 1);
      var r = originN.row - randInt(1, hCells - 1);
      if (!inBounds(c, r, drift)) continue;
      addLink(c - 1, r, c + 1, r, now, delay, { peak: 0.4, life: 4200 });
      addLink(c, r - 1, c, r + 1, now, delay + 20, { peak: 0.4, life: 4200 });
      delay += 40;
    }
    return true;
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
    var originN = originForChart(drift);
    if (!originN) return false;
    var s = originN.metrics;
    var pts = Math.max(5, Math.min(8, Math.round(s.spanW / 2)));
    var step = Math.max(2, Math.floor(s.spanW / (pts - 1)));
    var delay = 0;
    var points = [];
    var y = originN.row - Math.floor(s.spanH * 0.45);
    for (var i = 0; i < pts; i++) {
      y = Math.max(originN.row - s.spanH, Math.min(originN.row - 1, y + pick([-2, -1, 1, 2])));
      var c = originN.col + i * step;
      if (!inBounds(c, y, drift)) break;
      points.push({ col: c, row: y });
    }
    if (points.length < 4) return false;

    addLink(points[0].col, originN.row, points[points.length - 1].col, originN.row, now, delay, { peak: 0.2 });
    delay += 35;
    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay,
        withArc({ peak: 0.44 }, pick([-12, -18, 12, 18])));
      delay += 45;
    }
    for (var v = 0; v < points.length; v++) {
      addLink(points[v].col, points[v].row, points[v].col, originN.row, now, delay, { peak: 0.26 });
      delay += 35;
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


  function spawnFireworkBurst(now, drift, delayBase, asFinale) {
    if (!actCenter) return 0;
    var s = actCenter.metrics;
    var spreadX = Math.max(1, Math.floor(s.spanW / 3));
    var spreadY = Math.max(1, Math.floor(s.spanH / 3));
    var hubCol = actCenter.col + randInt(-spreadX, spreadX);
    var hubRow = actCenter.row + randInt(-spreadY, spreadY);
    if (!inBounds(hubCol, hubRow, drift)) {
      hubCol = actCenter.col;
      hubRow = actCenter.row;
    }

    var radius = Math.max(4, Math.min(s.radius + 2, Math.floor(Math.min(s.spanW, s.spanH) / 2)));
    var rays = randInt(12, 18);
    var delay = delayBase || 0;
    var life = (asFinale ? 7800 : 6200) + Math.random() * 3200;
    var added = 0;
    var tips = [];

    for (var i = 0; i < rays; i++) {
      var angle = (Math.PI * 2 * i) / rays + (Math.random() - 0.5) * 0.28;
      var r = Math.max(3, Math.round(radius * (0.5 + Math.random() * 0.55)));
      var tipCol = hubCol + Math.round(Math.cos(angle) * r);
      var tipRow = hubRow + Math.round(Math.sin(angle) * r);
      if (!inBounds(tipCol, tipRow, drift)) continue;
      tips.push({ col: tipCol, row: tipRow });

      var useArc = Math.random() < 0.7;
      if (addLink(hubCol, hubRow, tipCol, tipRow, now, delay, {
        peak: asFinale ? 0.82 : 0.62,
        life: life,
        drawEnd: 0.1 + Math.random() * 0.1,
        fadeStart: 0.58 + Math.random() * 0.14,
        curve: useArc ? 'arc' : null,
        arcLift: useArc ? (pick([-1, 1]) * gap * randInt(2, 6)) : 0,
        finale: !!asFinale,
        weight: asFinale ? 1.45 : 1.2
      })) added++;

      /* Tip sparkle — short radial flick, not a plus-square */
      if (Math.random() < 0.75) {
        var sparkR = randInt(1, 2);
        var sparkA = angle + (Math.random() - 0.5) * 0.8;
        var sc = tipCol + Math.round(Math.cos(sparkA) * sparkR);
        var sr = tipRow + Math.round(Math.sin(sparkA) * sparkR);
        if (inBounds(sc, sr, drift)) {
          addLink(tipCol, tipRow, sc, sr, now, delay + 30, {
            peak: asFinale ? 0.9 : 0.7,
            life: life * 0.65,
            drawEnd: 0.08,
            fadeStart: 0.5,
            finale: !!asFinale,
            weight: 1.1
          });
          added++;
        }
      }
      delay += 14 + Math.floor(Math.random() * 18);
    }

    /* Bloom arcs between nearby tips */
    for (var n = 0; n < tips.length; n++) {
      var a = tips[n];
      var b = tips[(n + 1) % tips.length];
      var dx = a.col - b.col;
      var dy = a.row - b.row;
      if (Math.sqrt(dx * dx + dy * dy) > radius * 1.2) continue;
      if (Math.random() > 0.7) continue;
      if (addLink(a.col, a.row, b.col, b.row, now, (delayBase || 0) + 160 + n * 20, {
        peak: asFinale ? 0.5 : 0.36,
        life: life * 0.8,
        curve: 'arc',
        arcLift: pick([-1, 1]) * gap * randInt(2, 4),
        finale: !!asFinale,
        weight: 1.1
      })) added++;
    }

    return added;
  }

  function spawnFireworks(now, drift) {
    if (!actCenter) beginAct(drift);
    var bursts = randInt(2, 3);
    var delay = 0;
    var total = 0;
    for (var i = 0; i < bursts; i++) {
      total += spawnFireworkBurst(now, drift, delay, false);
      delay += 220 + Math.floor(Math.random() * 280);
    }
    return total >= 8;
  }

  function spawnFinaleWave(now, drift) {
    var bursts = randInt(3, 5);
    var delay = 0;
    var total = 0;
    for (var i = 0; i < bursts; i++) {
      total += spawnFireworkBurst(now, drift, delay, true);
      delay += 160 + Math.floor(Math.random() * 240);
    }
    return total > 0;
  }

  function startFinale(now) {
    var drift = driftAt(now);
    beginAct(drift);
    finaleActive = true;
    postFinale = false;
    maxLinks = maxLinksFinale;
    finaleUntil = now + 13000 + Math.random() * 6000;
    spawnFinaleWave(now, drift);
    showActive = true;
    nextSpawnIn = 500 + Math.random() * 400;
    recentTypes.push('finale');
    if (recentTypes.length > 2) recentTypes.shift();
  }

  function spawnComposition(now) {
    updateStage();
    if (!stage.ready) {
      nextSpawnIn = 800;
      return;
    }

    /* Sunburst finale — keep stacking waves while the stage is lit */
    if (finaleActive) {
      if (now < finaleUntil) {
        var fDrift = driftAt(now);
        if (!actCenter) beginAct(fDrift);
        spawnFinaleWave(now, fDrift);
        showActive = true;
        nextSpawnIn = 650 + Math.random() * 850;
        return;
      }
      if (links.length > 0) {
        showActive = true;
        nextSpawnIn = 350;
        return;
      }
      finaleActive = false;
      maxLinks = maxLinksNormal;
      postFinale = true;
      showActive = false;
      actsSinceFinale = 0;
      nextSpawnIn = 3200 + Math.random() * 2400;
      return;
    }

    /* Blackout until the stage is clear — then one full act */
    if (links.length > 0) {
      showActive = true;
      nextSpawnIn = 400;
      return;
    }
    showActive = false;

    actsSinceFinale++;
    var wantFinale =
      (actsSinceFinale >= 4 && Math.random() < 0.28) ||
      (actsSinceFinale >= 7 && Math.random() < 0.5) ||
      actsSinceFinale >= 9;
    if (wantFinale) {
      startFinale(now);
      return;
    }

    var drift = driftAt(now);
    beginAct(drift);
    /* Spectacle-weighted lineup */
    var catalog = [
      { name: 'hist', fn: spawnHistogram, w: 10 },
      { name: 'fireworks', fn: spawnFireworks, w: 8 },
      { name: 'bar', fn: spawnBarChart, w: 5 },
      { name: 'sankey', fn: spawnSankey, w: 5 },
      { name: 'arc', fn: spawnArcDiagram, w: 2 },
      { name: 'bipartite', fn: spawnBipartite, w: 2 },
      { name: 'line', fn: spawnLineChart, w: 1 },
      { name: 'area', fn: spawnAreaChart, w: 1 }
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
      var fallback = catalog[Math.floor(Math.random() * 5)];
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

    if (choice.name !== 'sankey' && choice.name !== 'bar' && choice.name !== 'hist' && choice.name !== 'fireworks') {
      recentTypes.push(choice.name);
      if (recentTypes.length > 1) recentTypes.shift();
    }
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

  function strokeLink(a, b, progress, alpha, curve, arcLift, weight) {
    ctx.lineWidth = 1.15 * (weight || 1);
    ctx.lineCap = 'round';

    if (curve === 'arc') {
      var ctrl = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + arcLift };
      var steps = Math.max(10, Math.floor(32 * progress));
      ctx.beginPath();
      var p0 = quadPoint(a, ctrl, b, 0);
      ctx.moveTo(p0.x, p0.y);
      for (var s = 1; s <= steps; s++) {
        var pt = quadPoint(a, ctrl, b, (s / steps) * progress);
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
    var drift = driftAt(now);
    var metrics = stageCells(drift);
    var center = liveCenter(drift);
    ctx.clearRect(0, 0, w, h);

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

      var scale = Math.min(
        metrics.spanW / (L.refSpanW || metrics.spanW),
        metrics.spanH / (L.refSpanH || metrics.spanH)
      );
      if (!isFinite(scale) || scale <= 0) scale = 1;
      var a = resolvePoint(L.ox1, L.oy1, drift, scale, center);
      var b = resolvePoint(L.ox2, L.oy2, drift, scale, center);
      var p = age / L.life;
      var progress = p < L.drawEnd ? easeOutCubic(p / L.drawEnd) : 1;
      var visibility = p < L.fadeStart
        ? 1
        : 1 - easeInOut((p - L.fadeStart) / (1 - L.fadeStart));
      var falloff = Math.min(stageFalloff(a.x, a.y), stageFalloff(b.x, b.y));
      var alpha = L.peak * visibility * falloff;
      if (alpha < 0.012) continue;

      var end = strokeLink(a, b, progress, alpha, L.curve, L.arcLift * scale, L.weight);
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
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', updateStage, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', updateStage);
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
