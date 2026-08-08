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
  var maxLinks = 36;
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
  var stage = { left: 0, top: 0, right: 0, bottom: 0, ready: false };

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

    /* Lightshow stage = open hero field above the headline */
    stage.left = hr.left + 8;
    stage.right = hr.right - 8;
    stage.top = Math.max(hr.top, navBottom) + 12;
    stage.bottom = titleBox
      ? Math.min(titleBox.top - 16, hr.bottom - 8)
      : hr.bottom - 24;

    stage.ready =
      stage.bottom - stage.top > 96 &&
      stage.right - stage.left > 120 &&
      stage.bottom > 40 &&
      stage.top < h - 40;
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
    var padX = Math.min(48, (stage.right - stage.left) * 0.12);
    var padY = Math.min(40, (stage.bottom - stage.top) * 0.15);
    var fx = 1;
    var fy = 1;
    if (x < stage.left + padX) fx = (x - stage.left) / padX;
    else if (x > stage.right - padX) fx = (stage.right - x) / padX;
    if (y < stage.top + padY) fy = (y - stage.top) / padY;
    else if (y > stage.bottom - padY) fy = (stage.bottom - y) / padY;
    return Math.max(0, Math.min(1, fx)) * Math.max(0, Math.min(1, fy));
  }

  function gridPoint(col, row, drift) {
    return {
      x: origin + col * gap + drift,
      y: origin + row * gap + drift
    };
  }

  function inBounds(col, row, drift) {
    var p = gridPoint(col, row, drift);
    return inStage(p.x, p.y) && stageFalloff(p.x, p.y) >= 0.2;
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function addLink(col1, row1, col2, row2, now, delay, opts) {
    if (links.length >= maxLinks) return false;
    if (col1 === col2 && row1 === row2) return false;
    opts = opts || {};
    var peakBase = opts.peak != null ? opts.peak : 0.42;
    links.push({
      col1: col1,
      row1: row1,
      col2: col2,
      row2: row2,
      born: now + (delay || 0),
      life: opts.life || (5600 + Math.random() * 2200),
      peak: peakBase * (0.9 + Math.random() * 0.25),
      drawEnd: opts.drawEnd || (0.2 + Math.random() * 0.1),
      fadeStart: opts.fadeStart || (0.72 + Math.random() * 0.1),
      curve: opts.curve || null,
      arcLift: opts.arcLift || 0
    });
    return true;
  }

  function stageCells(drift) {
    var minCol = Math.max(0, Math.floor((stage.left - drift - origin) / gap));
    var maxCol = Math.ceil((stage.right - drift - origin) / gap);
    var minRow = Math.max(0, Math.floor((stage.top - drift - origin) / gap));
    var maxRow = Math.ceil((stage.bottom - drift - origin) / gap);
    var width = Math.max(6, maxCol - minCol);
    var height = Math.max(4, maxRow - minRow);
    return {
      minCol: minCol,
      maxCol: maxCol,
      minRow: minRow,
      maxRow: maxRow,
      width: width,
      height: height,
      spanW: Math.max(8, Math.round(width * 0.7)),
      spanH: Math.max(5, Math.round(height * 0.7)),
      radius: Math.max(5, Math.round(Math.min(width, height) * 0.35)),
      cx: Math.round((minCol + maxCol) / 2),
      cy: Math.round((minRow + maxRow) / 2)
    };
  }

  function randomAnchor(drift) {
    if (!stage.ready) return null;
    var s = stageCells(drift);
    /* Center the act so a grand figure can fill ~70% of the stage */
    for (var tries = 0; tries < 28; tries++) {
      var col = s.cx + randInt(-Math.floor(s.width * 0.08), Math.floor(s.width * 0.08));
      var row = s.cy + randInt(-Math.floor(s.height * 0.08), Math.floor(s.height * 0.08));
      if (inBounds(col, row, drift)) return { col: col, row: row, metrics: s };
    }
    if (inBounds(s.cx, s.cy, drift)) return { col: s.cx, row: s.cy, metrics: s };
    return null;
  }

  function originForChart(drift) {
    /* Bottom-left of a 70%-sized chart frame, centered in the stage */
    var s = stageCells(drift);
    var col = s.cx - Math.floor(s.spanW / 2);
    var row = s.cy + Math.floor(s.spanH / 2);
    if (!inBounds(col, row, drift)) {
      col = s.minCol + Math.floor((s.width - s.spanW) / 2);
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
      addLink(root.col, root.row, mc, mr, now, delay, { peak: 0.45 });
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
        addLink(parent.col, parent.row, kc, kr, now, delay, { peak: 0.38 });
        delay += 55;
      }
    }
    return true;
  }

  function spawnArcDiagram(now, drift) {
    var s = stageCells(drift);
    var count = Math.max(6, Math.min(10, Math.round(s.spanW / 2)));
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
    var pairs = [[0, 2], [1, 3], [0, 3], [2, 4], [1, 4], [0, 4], [2, nodes.length - 1], [1, nodes.length - 1], [0, nodes.length - 1], [3, nodes.length - 1]];
    for (var p = 0; p < pairs.length; p++) {
      var a = pairs[p][0];
      var b = pairs[p][1];
      if (b >= nodes.length || Math.random() > 0.65) continue;
      var span = b - a;
      addLink(nodes[a].col, nodes[a].row, nodes[b].col, nodes[b].row, now, delay, {
        peak: 0.4,
        curve: 'arc',
        arcLift: -(span * gap * 1.1 + s.spanH * gap * 0.15),
        drawEnd: 0.4
      });
      delay += 70;
    }
    return true;
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
      addLink(hubs[h].col, hubs[h].row, hubs[h + 1].col, hubs[h + 1].row, now, delay, { peak: 0.4 });
      delay += 80;
    }
    if (hubs.length === 3) {
      addLink(hubs[0].col, hubs[0].row, hubs[2].col, hubs[2].row, now, delay, { peak: 0.32 });
      delay += 70;
    }
    for (var i = 0; i < hubs.length; i++) {
      var hub = hubs[i];
      var spokes = sortClockwise(hub, spokeCandidates(spokeR).map(function (o) {
        return { col: hub.col + o[0], row: hub.row + o[1] };
      }).filter(function (p) { return inBounds(p.col, p.row, drift); }));
      var n = Math.min(spokes.length, randInt(7, 11));
      for (var sp = 0; sp < n; sp++) {
        addLink(hub.col, hub.row, spokes[sp].col, spokes[sp].row, now, delay, { peak: 0.38 });
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
      addLink(cur.col, cur.row, next.col, next.row, now, delay, { peak: 0.42 });
      delay += 55;
      ok++;
      if (Math.random() > 0.35) {
        var side = {
          col: cur.col + pick([0, 1]),
          row: cur.row + pick([-3, -4, 3, 4])
        };
        if (inBounds(side.col, side.row, drift)) {
          addLink(cur.col, cur.row, side.col, side.row, now, delay, { peak: 0.28 });
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
    var matches = Math.max(6, left.length + 2);
    var used = {};
    var made = 0;
    while (made < matches) {
      var L = pick(left);
      var R = pick(right);
      var id = L.row + '>' + R.row;
      if (used[id]) { if (Object.keys(used).length > 20) break; continue; }
      used[id] = true;
      addLink(L.col, L.row, R.col, R.row, now, delay, {
        peak: 0.36,
        curve: Math.random() > 0.4 ? 'arc' : null,
        arcLift: pick([-22, -32, 18, 28])
      });
      delay += 45;
      made++;
    }
    return made >= 4;
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
      addLink(hub.col, hub.row, nodes[sp].col, nodes[sp].row, now, delay, { peak: 0.48 });
      delay += 45;
    }
    for (var n = 0; n < nodes.length; n++) {
      var a = nodes[n];
      var b = nodes[(n + 1) % nodes.length];
      var dx = a.col - b.col;
      var dy = a.row - b.row;
      if (Math.sqrt(dx * dx + dy * dy) < radius * 1.45) {
        addLink(a.col, a.row, b.col, b.row, now, delay, { peak: 0.28 });
        delay += 35;
      }
    }
    return true;
  }

  function spawnBarChart(now, drift) {
    var originN = originForChart(drift);
    if (!originN) return false;
    var s = originN.metrics;
    var bars = Math.max(5, Math.min(9, Math.round(s.spanW / 2)));
    var maxH = s.spanH;
    var step = Math.max(2, Math.floor(s.spanW / (bars - 1)));
    var delay = 0;
    var endCol = originN.col + (bars - 1) * step;
    if (!inBounds(endCol, originN.row, drift)) return false;

    addLink(originN.col, originN.row, endCol, originN.row, now, delay, { peak: 0.28 });
    delay += 40;
    addLink(originN.col, originN.row, originN.col, originN.row - maxH, now, delay, { peak: 0.24 });
    delay += 50;

    for (var i = 0; i < bars; i++) {
      var c = originN.col + i * step;
      var ht = randInt(Math.max(2, Math.floor(maxH * 0.35)), maxH);
      if (!inBounds(c, originN.row - ht, drift)) continue;
      addLink(c, originN.row, c, originN.row - ht, now, delay, { peak: 0.46 });
      delay += 55;
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
    delay += 35;
    addLink(originN.col, originN.row, originN.col, originN.row - s.spanH, now, delay, { peak: 0.2 });
    delay += 45;

    for (var p = 0; p < points.length - 1; p++) {
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, { peak: 0.46 });
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
    delay += 30;
    addLink(originN.col, originN.row, originN.col, originN.row - hCells, now, delay, { peak: 0.24 });
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
        addLink(prev.c0, prev.r, c0, r, now, delay, { peak: 0.3 });
        addLink(prev.c1, prev.r, c1, r, now, delay + 25, { peak: 0.3 });
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
      addLink(points[p].col, points[p].row, points[p + 1].col, points[p + 1].row, now, delay, { peak: 0.44 });
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
          peak: 0.34,
          curve: 'arc',
          arcLift: pick([-14, -18, 14, 18])
        });
        delay += 35;
      }
    }
    return true;
  }

  function spawnHistogram(now, drift) {
    var originN = originForChart(drift);
    if (!originN) return false;
    var s = originN.metrics;
    var bins = s.spanW;
    var delay = 0;
    addLink(originN.col, originN.row, originN.col + bins, originN.row, now, delay, { peak: 0.24 });
    delay += 35;
    for (var i = 0; i < bins; i++) {
      var ht = randInt(Math.max(2, Math.floor(s.spanH * 0.25)), s.spanH);
      var c = originN.col + i;
      if (!inBounds(c, originN.row - ht, drift)) continue;
      addLink(c, originN.row, c, originN.row - ht, now, delay, { peak: 0.42 });
      delay += 32;
    }
    return true;
  }


  function spawnComposition(now) {
    updateStage();
    if (!stage.ready) {
      nextSpawnIn = 800;
      return;
    }
    /* Blackout until the stage is clear — then one full act */
    if (links.length > 0) {
      showActive = true;
      nextSpawnIn = 400;
      return;
    }
    showActive = false;

    var drift = driftAt(now);
    /* Spectacle-weighted lineup */
    var catalog = [
      { name: 'sunburst', fn: spawnSunburst, w: 3 },
      { name: 'donut', fn: spawnDonut, w: 3 },
      { name: 'arc', fn: spawnArcDiagram, w: 2 },
      { name: 'funnel', fn: spawnFunnel, w: 2 },
      { name: 'bar', fn: spawnBarChart, w: 2 },
      { name: 'line', fn: spawnLineChart, w: 2 },
      { name: 'cluster', fn: spawnForceCluster, w: 2 },
      { name: 'tree', fn: spawnTree, w: 1 },
      { name: 'flow', fn: spawnFlow, w: 1 },
      { name: 'bipartite', fn: spawnBipartite, w: 1 },
      { name: 'area', fn: spawnAreaChart, w: 1 },
      { name: 'scatter', fn: spawnScatter, w: 1 },
      { name: 'hist', fn: spawnHistogram, w: 1 }
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

    recentTypes.push(choice.name);
    if (recentTypes.length > 2) recentTypes.shift();
    showActive = true;

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

  function drawDot(x, y, alpha, size, focused) {
    if (alpha < 0.03) return;
    var r = size || 0.55;
    if (focused) {
      var glow = ctx.createRadialGradient(x, y, 0, x, y, r * 5.5);
      glow.addColorStop(0, 'rgba(255, 250, 235, ' + Math.min(0.85, alpha * 0.95) + ')');
      glow.addColorStop(0.25, 'rgba(255, 236, 190, ' + Math.min(0.45, alpha * 0.55) + ')');
      glow.addColorStop(0.55, 'rgba(209, 187, 119, ' + Math.min(0.22, alpha * 0.3) + ')');
      glow.addColorStop(1, 'rgba(209, 187, 119, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 252, 240, ' + Math.min(1, alpha * 1.4) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = 'rgba(209, 187, 119, ' + alpha + ')';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function strokeLink(a, b, progress, alpha, curve, arcLift) {
    ctx.lineWidth = 1.15;
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
    ctx.clearRect(0, 0, w, h);

    var degree = {};
    function key(c, r) { return c + ',' + r; }
    for (var d = 0; d < links.length; d++) {
      var L0 = links[d];
      if (now - L0.born < 0 || now - L0.born >= L0.life) continue;
      degree[key(L0.col1, L0.row1)] = (degree[key(L0.col1, L0.row1)] || 0) + 1;
      degree[key(L0.col2, L0.row2)] = (degree[key(L0.col2, L0.row2)] || 0) + 1;
    }

    for (var i = links.length - 1; i >= 0; i--) {
      var L = links[i];
      var age = now - L.born;
      if (age < 0) continue;
      if (age >= L.life) {
        links.splice(i, 1);
        continue;
      }

      var a = gridPoint(L.col1, L.row1, drift);
      var b = gridPoint(L.col2, L.row2, drift);
      var p = age / L.life;
      var progress = p < L.drawEnd ? easeOutCubic(p / L.drawEnd) : 1;
      var visibility = p < L.fadeStart
        ? 1
        : 1 - easeInOut((p - L.fadeStart) / (1 - L.fadeStart));
      var falloff = Math.min(stageFalloff(a.x, a.y), stageFalloff(b.x, b.y));
      var alpha = L.peak * visibility * falloff;
      if (alpha < 0.012) continue;

      var end = strokeLink(a, b, progress, alpha, L.curve, L.arcLift);
      var degA = degree[key(L.col1, L.row1)] || 1;
      var degB = degree[key(L.col2, L.row2)] || 1;
      var inFocus = progress > 0.05 && visibility > 0.5;
      var focusBoost = inFocus ? 1.85 : 1;
      var hubSize = degA >= 3 || degB >= 3 ? 1.2 : 0.65;

      drawDot(a.x, a.y, Math.min(1, alpha * 2.1 * focusBoost), degA >= 3 ? hubSize : 0.65, inFocus);
      drawDot(end.x, end.y, Math.min(1, alpha * 1.9 * focusBoost * Math.max(0.35, progress)), 0.65, inFocus && progress > 0.15);
      if (progress >= 1) {
        drawDot(b.x, b.y, Math.min(1, alpha * 2.1 * focusBoost), degB >= 3 ? hubSize : 0.65, inFocus);
      }
    }

    if (links.length === 0 && showActive) {
      showActive = false;
      /* Breath of darkness before the next act */
      nextSpawnIn = 1200 + Math.random() * 1600;
      lastSpawn = now;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateStage, { passive: true });
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
