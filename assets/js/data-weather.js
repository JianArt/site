/**
 * Data Weather — one range inside a point-cloud atmosphere.
 *
 * Climate is Bay Area weather + local hour. A visit seed still makes
 * every load a different vantage. S&P climate.json is a quiet second
 * pressure if present.
 *
 * Motion: each mote wanders on its own clock (gold dust). The range is
 * the cloud they belong to. On cinema the same dots leave the range and
 * compose a slowly turning solid (DNA double helix, self-driving lidar
 * scan, mountain ranges, metropolis with traffic; a health
 * set: CT scan, lungs, blood flow, neuron, health globe, molecule, heart; a
 * technology set: motion planning, neural network, satellites, occupancy
 * voxels, chip wafer, data center; five per visit; a case-study page names
 * its own solid with data-shape on the hero; the lab previews with
 *   ?shape=, currently an extracted molar, an MRI gantry, a flask, a
 * binocular microscope, a syringe, a sounding rocket, a radar
 * dish, an eye, a skull, and a stethoscope), still
 * breathing, then return
 * to the range. No lines. Never opacity pulse. prefers-reduced-motion:
 * one still frame. No pointer.
 */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.createElement('canvas');
  canvas.className = 'dot-links data-weather';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  document.body.classList.add('has-data-weather');

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var GOLD = [209, 187, 119];
  var CREAM = [255, 244, 214];

  var cinema = !!document.querySelector('.hero--cinema');
  var about = !!document.querySelector('.about-hero');
  var intensity = cinema ? 1 : about ? 0.46 : 0.36;
  var ampScale = cinema ? 0.32 : about ? 0.17 : 0.14;

  var w = 0;
  var h = 0;
  var dpr = 1;
  var cols = 0;
  var rows = 0;
  var field = {
    left: 0, right: 0, top: 0, bottom: 0,
    width: 0, height: 0, ready: false
  };
  var titleBox = null;
  var titleV0 = 0.62;
  var titleV1 = 0.82;
  var ridgeZ = 0.4;
  var visit = mintVisit();
  var lifeT = visit.life0;
  var enter = reduce ? 1 : 0;
  var loopId = 0;
  var lastNow = 0;
  var climate = null;
  var sky = {
    hour: 12,
    dayness: 0.55,
    temp: 0.5,
    wind: 0.22,
    cloud: 0.35,
    storm: 0
  };
  var SKY_LIVE = 'https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,wind_speed_10m,cloud_cover,weather_code&timezone=America/Los_Angeles';

  function mintVisit() {
    var a = 0;
    var b = 0;
    if (window.crypto && crypto.getRandomValues) {
      var buf = new Uint32Array(2);
      crypto.getRandomValues(buf);
      a = buf[0];
      b = buf[1];
    } else {
      a = (Math.random() * 4294967296) >>> 0;
      b = (Date.now() ^ ((Math.random() * 4294967296) >>> 0)) >>> 0;
    }
    return {
      saltX: (a % 10007) + 1,
      saltY: (b % 10009) + 3,
      life0: (a / 4294967296) * 36000,
      phase: b / 4294967296,
      domain: (a % 97) * 0.13,
      ridgeNudge: ((b % 21) - 10) * 0.004,
      peakA: 0.2 + ((a % 37) / 37) * 0.16,
      peakB: 0.58 + ((b % 31) / 31) * 0.16,
      peakW: 0.028 + (a % 11) * 0.0022,
      mirror: (a & 1) === 1
    };
  }

  var morphClock = 0;
  var PHASE_DUST = 5600;
  var PHASE_FORM = 2600;
  var PHASE_HOLD = 5200;
  var PHASE_RELEASE = 2600;
  var MORPH_CYCLE = PHASE_DUST + PHASE_FORM + PHASE_HOLD + PHASE_RELEASE;
  var SHAPE_JOIN = 0.82;
  var SHAPE_NAMES = ['helix', 'lidar', 'mountains', 'city',
    'scan', 'lungs', 'blood', 'neuron', 'globe', 'molecule', 'heart',
    'planning', 'neural', 'satellites', 'voxels', 'wafer', 'datacenter'];
  var SHAPES_PER_VISIT = 5;
  /* One solid per case study, named by the hero's data-shape. */
  var PROJECT_NAMES = ['bubbles', 'hexbin', 'ribbons', 'pipeline', 'iconwall',
    'cloudfiles', 'pool', 'truck', 'candles'];
  var PROJECT_SHAPES = {};
  PROJECT_NAMES.forEach(function (n) { PROJECT_SHAPES[n] = 1; });
  /* Lab solids only appear through ?shape=, until promoted into SHAPE_NAMES. */
  var LAB_NAMES = ['molar', 'mri', 'flask', 'microscope', 'syringe', 'rocket', 'radar', 'eye', 'skull', 'stethoscope'];
  function knownShape(name) {
    return !!name && (SHAPE_NAMES.indexOf(name) >= 0 || !!PROJECT_SHAPES[name] ||
      LAB_NAMES.indexOf(name) >= 0);
  }
  /* ?shape=heart loops a single solid, for previewing one. */
  var SHAPE_FORCE = (function () {
    var m = /[?&]shape=([a-z]+)/.exec(location.search);
    return m && knownShape(m[1]) ? m[1] : null;
  })();
  var PAGE_SHAPE = (function () {
    var hero = document.querySelector('.hero--cinema[data-shape]');
    var name = hero && hero.getAttribute('data-shape');
    return knownShape(name) ? name : null;
  })();
  var RIDGE_OFFSET = [0, -0.5, 0.45];
  var RIDGE_WIDTH = [0.38, 0.32, 0.26];
  var CITY_GROUND = -0.42;
  var CITY_AVENUES = [-0.62, -0.2, 0.2, 0.62];
  var CITY_RAIL_Z = 0.2;
  var CITY_RAIL_H = 0.16;
  var HELIX_TURNS = 3.2;
  var HELIX_RUNGS = 30;
  /* Strands sit ~145° apart, not 180°, so major and minor grooves read. */
  var HELIX_GROOVE = Math.PI * 0.8;
  var shapeOrder = (function () {
    var ids = SHAPE_NAMES.map(function (_, n) { return n; });
    var i;
    var j;
    var tmp;
    for (i = ids.length - 1; i > 0; i--) {
      j = Math.floor(mix01(Math.imul(visit.saltY + i * 131, 0x9e3779b1)) * (i + 1));
      tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    return ids;
  })();

  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  function clamp01(t) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function siteEase(t) {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 4);
  }

  function fade(t) {
    return t * t * (3 - 2 * t);
  }

  function hash2(ix, iy) {
    ix += visit.saltX;
    iy += visit.saltY;
    var n = ix * 374761393 + iy * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  function noise(x, y) {
    var x0 = Math.floor(x);
    var y0 = Math.floor(y);
    var fx = fade(x - x0);
    var fy = fade(y - y0);
    var a = hash2(x0, y0);
    var b = hash2(x0 + 1, y0);
    var c = hash2(x0, y0 + 1);
    var d = hash2(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  function fbm(x, y) {
    var s = 0;
    var a = 0.52;
    var f = 1;
    for (var i = 0; i < 4; i++) {
      s += a * noise(x * f, y * f);
      a *= 0.5;
      f *= 2.03;
    }
    return s;
  }

  function samplePath(path, u) {
    if (!path || !path.length) return 0.5;
    var n = path.length;
    u = u + visit.phase;
    if (visit.mirror) u = 1 - u;
    u = u - Math.floor(u);
    var t = clamp01(u) * (n - 1);
    var i = Math.floor(t);
    var f = t - i;
    var a = path[i];
    var b = path[Math.min(i + 1, n - 1)];
    return a + (b - a) * f;
  }

  function ingestClimate(data) {
    if (!data || !data.closes || data.closes.length < 32) return;
    var closes = data.closes;
    var lo = closes[0];
    var hi = closes[0];
    var i;
    for (i = 1; i < closes.length; i++) {
      if (closes[i] < lo) lo = closes[i];
      if (closes[i] > hi) hi = closes[i];
    }
    var span = hi - lo || 1;
    var path = [];
    var echo = [];
    for (i = 0; i < closes.length; i++) {
      path.push(0.12 + 0.88 * ((closes[i] - lo) / span));
      var j = Math.max(0, i - 18);
      echo.push(0.12 + 0.88 * ((closes[j] - lo) / span));
    }
    climate = {
      path: path,
      echo: echo,
      vol: clamp01((data.vol20 || 0) / 0.014),
      lastReturn: data.lastReturn || 0,
      sessions: data.sessions || closes.length,
      asOf: data.asOf || ''
    };
  }

  function readBayHour() {
    try {
      var hour = 12;
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        hourCycle: 'h23'
      }).formatToParts(new Date()).forEach(function (part) {
        if (part.type === 'hour') hour = parseInt(part.value, 10);
      });
      return hour;
    } catch (err) {
      return new Date().getHours();
    }
  }

  function applyHour() {
    var hour = readBayHour();
    sky.hour = hour;
    var from6 = (hour - 6 + 24) % 24;
    sky.dayness = from6 <= 12 ? Math.sin((from6 / 12) * Math.PI) : 0;
  }

  function ingestWeather(data) {
    var cur = data && data.current;
    if (!cur) return;
    if (cur.temperature_2m != null) sky.temp = clamp01((cur.temperature_2m - 6) / 26);
    if (cur.wind_speed_10m != null) sky.wind = clamp01(cur.wind_speed_10m / 42);
    if (cur.cloud_cover != null) sky.cloud = clamp01(cur.cloud_cover / 100);
    var code = cur.weather_code || 0;
    sky.storm = code >= 95 ? 1 : code >= 80 ? 0.75 : code >= 51 ? 0.45 : code >= 45 ? 0.3 : 0;
  }

  /* Crest profile 0–1. Peaks are the signature; S&P and weather lean it. */
  function terrainAt(u, t) {
    var wind = t * 0.00002;
    var x = clamp01(u + (fbm(u * 1.05 + 3.2 + visit.domain, wind * 0.4) - 0.5) * (climate ? 0.035 : 0.07));
    var n = fbm(x * 2.4 + wind + visit.domain, 1.35);
    var n2 = fbm(x * 5.4 + visit.domain * 0.7, 2.15);
    var path = climate ? samplePath(climate.path, x) : 0.5 + 0.22 * (n - 0.5);
    var echo = climate ? samplePath(climate.echo, x) : path;
    var peak1 = Math.exp(-Math.pow(x - visit.peakA, 2) / visit.peakW);
    var peak2 = Math.exp(-Math.pow(x - visit.peakB, 2) / (visit.peakW * 1.7));
    var frame = Math.pow(Math.sin(x * Math.PI), 0.78);
    var weather = 0.86 + 0.14 * sky.temp;
    var sil = 0.14 * path + 0.06 * echo + 0.1 * n + 0.7 * (0.82 * peak1 + 0.52 * peak2);
    sil = clamp01((0.05 + 0.95 * sil) * (0.14 + 0.86 * frame) * weather * (0.9 + 0.1 * n2));
    return { x: x, sil: sil, n: n };
  }

  function titleShelf(z) {
    if (z <= titleV0 - 0.05) return 1;
    return 1 - 0.92 * fade(clamp01((z - (titleV0 - 0.05)) / 0.1));
  }

  function morphState() {
    if (!cinema || reduce || enter < 0.95) {
      return { phase: 'dust', p: 0, kind: null, seed: 0, time: 0 };
    }
    var local = morphClock % MORPH_CYCLE;
    var idx = Math.floor(morphClock / MORPH_CYCLE);
    var kind = SHAPE_FORCE || PAGE_SHAPE || SHAPE_NAMES[shapeOrder[idx % SHAPES_PER_VISIT]];
    if (local < PHASE_DUST) {
      return { phase: 'dust', p: local / PHASE_DUST, kind: null, seed: idx, time: 0 };
    }
    local -= PHASE_DUST;
    var time = local;
    if (local < PHASE_FORM) {
      return { phase: 'form', p: local / PHASE_FORM, kind: kind, seed: idx, time: time };
    }
    local -= PHASE_FORM;
    if (local < PHASE_HOLD) {
      return { phase: 'hold', p: local / PHASE_HOLD, kind: kind, seed: idx, time: time };
    }
    local -= PHASE_HOLD;
    return { phase: 'release', p: clamp01(local / PHASE_RELEASE), kind: kind, seed: idx, time: time };
  }

  function figBand() {
    var lo = 0.1;
    var hi = Math.max(lo + 0.24, titleV0 - 0.08);
    return { lo: lo, hi: hi, mid: (lo + hi) * 0.5, span: hi - lo };
  }

  function rotX(q, ang) {
    var c = Math.cos(ang);
    var s = Math.sin(ang);
    var y = q.y;
    var z = q.z;
    q.y = y * c - z * s;
    q.z = y * s + z * c;
  }

  function rotY(q, ang) {
    var c = Math.cos(ang);
    var s = Math.sin(ang);
    var x = q.x;
    var z = q.z;
    q.x = x * c + z * s;
    q.z = -x * s + z * c;
  }

  function rotZ(q, ang) {
    var c = Math.cos(ang);
    var s = Math.sin(ang);
    var x = q.x;
    var y = q.y;
    q.x = x * c - y * s;
    q.y = x * s + y * c;
  }

  /* +z faces the viewer; +y is up. Turns stay slow: a solid, not a spinner. */
  function orient(kind, t, seed, p) {
    var q = { x: p.x, y: p.y, z: p.z };
    if (kind === 'helix') {
      rotX(q, t * 0.00032 + seed * 0.9);
      rotY(q, 0.32);
      rotX(q, 0.12);
    } else if (kind === 'lidar') {
      rotY(q, 0.5 + seed * 0.8 + t * 0.00006);
      rotX(q, 0.58);
    } else if (kind === 'mountains') {
      rotY(q, -0.3 + (seed % 3) * 0.25 + t * 0.00005);
      rotX(q, 0.34);
    } else if (kind === 'city') {
      rotY(q, 0.22 + (seed % 3) * 0.14 + t * 0.00006);
      rotX(q, 0.16);
    } else if (kind === 'scan') {
      rotY(q, 1.2 + 0.3 * Math.sin(t * 0.00018 + seed));
      rotX(q, 0.22);
    } else if (kind === 'lungs' || kind === 'heart') {
      rotY(q, 0.35 * Math.sin(t * 0.0002 + seed));
      rotX(q, 0.1);
    } else if (kind === 'blood') {
      rotY(q, 0.35);
      rotX(q, 0.18);
    } else if (kind === 'neuron') {
      rotY(q, 0.25 * Math.sin(t * 0.0002 + seed));
      rotX(q, 0.3);
    } else if (kind === 'globe') {
      rotY(q, seed * 1.9 + t * 0.00018);
      rotX(q, 0.3);
    } else if (kind === 'molecule') {
      /* Planar molecule: rock, never turn edge-on. */
      rotY(q, 0.5 * Math.sin(t * 0.00025 + seed));
      rotX(q, 0.35);
    } else if (kind === 'planning') {
      rotY(q, -0.25 + 0.15 * Math.sin(t * 0.0002 + seed));
      rotX(q, 1.0);
    } else if (kind === 'neural') {
      rotY(q, 0.35 + 0.15 * Math.sin(t * 0.0002 + seed));
      rotX(q, 0.2);
    } else if (kind === 'satellites') {
      rotY(q, seed + t * 0.00008);
      rotX(q, 0.35);
    } else if (kind === 'voxels') {
      rotY(q, 0.6 + 0.2 * Math.sin(t * 0.00018 + seed));
      rotX(q, 0.62);
    } else if (kind === 'wafer') {
      rotY(q, 0.4 + seed * 0.5 + t * 0.00005);
      rotX(q, 0.75);
    } else if (kind === 'datacenter') {
      rotY(q, 0.55 + 0.25 * Math.sin(t * 0.00015 + seed));
      rotX(q, 0.35);
    } else if (kind === 'molar') {
      /* Near-frontal, so the two roots sit side by side and neither falls into shade. */
      rotY(q, 0.32 + 0.08 * Math.sin(t * 0.00016 + seed));
      rotX(q, 0.22);
    } else if (kind === 'mri') {
      /* Bore opens toward the viewer; pitch keeps the couch top visible. */
      rotY(q, -1.02 + 0.06 * Math.sin(t * 0.00014 + seed));
      rotX(q, 0.46);
    } else if (kind === 'flask') {
      /* High enough to see into the mouth, low enough to keep the cone. */
      rotY(q, 0.62 + 0.08 * Math.sin(t * 0.00015 + seed));
      rotX(q, 0.62);
    } else if (kind === 'microscope') {
      /* Side three-quarter: arm behind the tube, stage cantilever, both eyepieces. */
      rotY(q, -1.02 + 0.05 * Math.sin(t * 0.00014 + seed));
      rotX(q, 0.46);
    } else if (kind === 'syringe') {
      /* Needle down toward the viewer, plunger up and back, so the barrel stays round. */
      rotY(q, -0.72 + 0.05 * Math.sin(t * 0.00014 + seed));
      rotX(q, 0.36);
    } else if (kind === 'rocket') {
      /* Nose up. Two fins present their faces; the third stays behind the body. */
      rotY(q, 0.48 + 0.05 * Math.sin(t * 0.00013 + seed));
      rotX(q, 0.18);
    } else if (kind === 'radar') {
      /* Into the bowl, low enough that the feed horn clears the lower rim. */
      rotY(q, -0.95 + 0.05 * Math.sin(t * 0.00013 + seed));
      rotX(q, 0.18);
    } else if (kind === 'eye') {
      /* Near-frontal, so the pupil stays a hole and the lids keep their arch. */
      rotY(q, 0.28 + 0.04 * Math.sin(t * 0.00014 + seed));
      rotX(q, 0.1);
    } else if (kind === 'skull') {
      /* Near-frontal, so both orbits stay open and the jaw hangs under the nose. */
      rotY(q, 0.30 + 0.04 * Math.sin(t * 0.00014 + seed));
      rotX(q, 0.06);
    } else if (kind === 'stethoscope') {
      /* Near-frontal: both ear hooks and the diaphragm face stay in view. */
      rotY(q, 0.22 + 0.04 * Math.sin(t * 0.00014 + seed));
      rotX(q, 0.08);
    } else if (kind === 'bubbles') {
      rotY(q, seed * 0.4 + 0.3 * Math.sin(t * 0.00015 + seed));
      rotX(q, 0.25);
    } else if (kind === 'hexbin') {
      rotY(q, 0.5 + (seed % 3) * 0.3 + t * 0.00006);
      rotX(q, 0.42);
    } else if (kind === 'ribbons') {
      rotY(q, -0.55 + 0.15 * Math.sin(t * 0.00016 + seed));
      rotX(q, 0.3);
    } else if (kind === 'pipeline') {
      rotY(q, 0.35 + 0.12 * Math.sin(t * 0.00016 + seed));
      rotX(q, 0.18);
    } else if (kind === 'iconwall') {
      rotY(q, 0.25 * Math.sin(t * 0.00016 + seed));
      rotX(q, 0.12);
    } else if (kind === 'cloudfiles') {
      rotY(q, 0.3 * Math.sin(t * 0.00015 + seed));
      rotX(q, 0.15);
    } else if (kind === 'pool') {
      rotY(q, 0.35 + 0.2 * Math.sin(t * 0.00015 + seed));
      rotX(q, 0.25);
    } else if (kind === 'truck') {
      rotY(q, 0.62 + 0.12 * Math.sin(t * 0.00015 + seed));
      rotX(q, 0.38);
    } else if (kind === 'candles') {
      rotY(q, -0.35 + 0.15 * Math.sin(t * 0.00015 + seed));
      rotX(q, 0.22);
    } else {
      rotY(q, seed + t * 0.00012);
      rotX(q, 0.9);
    }
    return q;
  }

  function shapeStage(morph) {
    var band = figBand();
    var narrow = w < 800;
    var ex = orient(morph.kind, morph.time, morph.seed, { x: 1, y: 0, z: 0 });
    var ey = orient(morph.kind, morph.time, morph.seed, { x: 0, y: 1, z: 0 });
    var ez = orient(morph.kind, morph.time, morph.seed, { x: 0, y: 0, z: 1 });
    var env = morph.phase === 'form' ? fade(morph.p)
      : morph.phase === 'hold' ? 1 : 1 - fade(morph.p);
    var S = Math.min(field.width * (narrow ? 0.38 : 0.28), band.span * field.height * 0.85);
    /* Breath and heartbeat are changes of size, never of brightness. */
    if (morph.kind === 'lungs') S *= 1 + 0.04 * Math.sin(morph.time * 0.0015);
    if (morph.kind === 'heart') S *= 1 - 0.04 * heartBeat(morph.time);
    /* Middle of the field, but never low enough to sit on the title. */
    var cy = field.top + field.height * 0.4;
    if (titleBox) cy = Math.min(cy, titleBox.top - 24 - S * 0.85);
    cy = Math.max(cy, field.top + S * 0.6);
    return {
      time: morph.time,
      scanY: -0.62 + 1.3 * (0.5 - 0.5 * Math.cos(morph.time * 0.0011)),
      kind: morph.kind,
      seed: morph.seed,
      phase: morph.phase,
      p: morph.p,
      env: env,
      sweep: morph.time * 0.0021,
      M: [ex.x, ey.x, ez.x, ex.y, ey.y, ez.y, ex.z, ey.z, ez.z],
      cx: field.left + field.width * 0.5,
      cy: cy,
      S: S
    };
  }

  var LIDAR_GROUND = -0.2;
  var LIDAR_RINGS = 13;
  /* Half length, half width, height of a car in shape units. */
  var LIDAR_CAR = [0.2, 0.09, 0.14];
  var LIDAR_CARS = [
    [0.6, 0.32],
    [-0.55, -0.32],
    [-0.1, 0.66],
    [0.92, -0.66],
    [-0.95, 0.3]
  ];
  var LIDAR_POLES = [
    [0.35, -0.95, 0.45],
    [-0.7, 0.95, 0.4],
    [1.05, 0.2, 0.5]
  ];

  /* hash2 is correlated across the cells that survive the density cull; the
     solid needs independent draws or it only fills a slice of itself. */
  function mix01(n) {
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }

  function moteId(i, j) {
    return (Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663) ^ visit.saltX) | 0;
  }

  /* A fixed home on the solid for mote (i, j). r is 0 at centre, 1 at rim. */
  function shapePoint(kind, i, j, seed) {
    var id = moteId(i, j);
    var a = mix01(id ^ 0x2545f491);
    var b = mix01(id ^ 0x68e31da4);
    var c = mix01(id ^ 0x1b873593);
    var d = mix01(id ^ 0x5bd1e995);
    var gR = Math.sqrt(-2 * Math.log(Math.max(1e-6, b)));
    var g1 = gR * Math.cos(6.2832 * c);
    var g2 = gR * Math.sin(6.2832 * c);
    if (EXTRA_SHAPES[kind]) return extraPoint(kind, id, seed, a, b, c);
    if (PROJECT_SHAPES[kind]) return projectPoint(kind, id, seed, a, b, c);
    var move = null;
    var f;
    var dir;
    var px;
    var py;
    var pz;
    var ang;
    var rr;
    var u;
    var v;
    var rad;
    var th = -9;
    var bld;
    var gx;
    var gz;
    var k;
    var base;
    var elev;
    var lvl = 1;
    var e = -1;
    var found;

    if (kind === 'helix') {
      rr = 0.34;
      if (d < 0.26) {
        /* Base pair: a rung of dots between the two strands. */
        u = (Math.floor(a * HELIX_RUNGS) + 0.5) / HELIX_RUNGS;
        v = mix01(id ^ 0x85ebca6b);
        ang = u * HELIX_TURNS * 6.2832;
        px = (u - 0.5) * 2.6;
        py = rr * (Math.cos(ang) + (Math.cos(ang + HELIX_GROOVE) - Math.cos(ang)) * v) + g1 * 0.008;
        pz = rr * (Math.sin(ang) + (Math.sin(ang + HELIX_GROOVE) - Math.sin(ang)) * v) + g2 * 0.008;
      } else {
        ang = a * HELIX_TURNS * 6.2832 + (d < 0.63 ? 0 : HELIX_GROOVE);
        px = (a - 0.5) * 2.6;
        py = Math.cos(ang) * rr + g1 * 0.022;
        pz = Math.sin(ang) * rr + g2 * 0.022;
      }
    } else if (kind === 'lidar') {
      found = false;
      if (d < 0.66) {
        /* Ground returns: rings widen with range; objects cast shadows. */
        for (k = 0; k < 12; k++) {
          u = mix01(id ^ (0x2c1b3c6d + k * 0x9e3779b9));
          v = mix01(id ^ (0x297a2d39 + k * 0x7f4a7c15));
          lvl = Math.floor(u * LIDAR_RINGS);
          rad = 0.16 * Math.pow(1.19, lvl);
          ang = v * 6.2832;
          if (!lidarShadowed(ang, rad)) {
            found = true;
            break;
          }
        }
        if (found) {
          px = Math.cos(ang) * rad;
          pz = Math.sin(ang) * rad;
          py = LIDAR_GROUND + g1 * 0.004;
        }
      }
      if (!found && d < 0.9) {
        /* Cars: scan rows on the faces that point back at the sensor. */
        base = LIDAR_CARS[Math.floor(b * LIDAR_CARS.length) % LIDAR_CARS.length];
        v = (Math.floor(mix01(id ^ 0x51ed270b) * 4) + 0.5) / 4;
        u = mix01(id ^ 0x3a8f05c5) * 2 - 1;
        if (c < 0.42) {
          px = base[0] - (base[0] > 0 ? 1 : -1) * LIDAR_CAR[0];
          pz = base[1] + u * LIDAR_CAR[1];
          py = LIDAR_GROUND + LIDAR_CAR[2] * v;
        } else if (c < 0.84) {
          px = base[0] + u * LIDAR_CAR[0];
          pz = base[1] - (base[1] > 0 ? 1 : -1) * LIDAR_CAR[1];
          py = LIDAR_GROUND + LIDAR_CAR[2] * v;
        } else {
          px = base[0] + u * LIDAR_CAR[0];
          pz = base[1] + (a * 2 - 1) * LIDAR_CAR[1];
          py = LIDAR_GROUND + LIDAR_CAR[2];
        }
      } else if (!found && d < 0.96) {
        base = LIDAR_POLES[Math.floor(b * LIDAR_POLES.length) % LIDAR_POLES.length];
        px = base[0] + g1 * 0.008;
        pz = base[1] + g2 * 0.008;
        py = LIDAR_GROUND + base[2] * (Math.floor(a * 8) + 0.5) / 8;
      } else if (!found) {
        /* Ego vehicle outline at the sensor. */
        u = a * 4;
        v = u - Math.floor(u);
        px = (u < 1 ? v * 2 - 1 : u < 2 ? 1 : u < 3 ? 1 - v * 2 : -1) * 0.12;
        pz = (u < 1 ? -1 : u < 2 ? v * 2 - 1 : u < 3 ? 1 : 1 - v * 2) * 0.055;
        py = LIDAR_GROUND + 0.02;
      }
      th = Math.atan2(pz, px);
    } else if (kind === 'mountains') {
      /* A quarter of the dots trace the crest lines so the silhouette reads;
         the rest cover the slopes. The flat floor stays empty. */
      found = false;
      if (d >= 0.26) {
        for (k = 0; k < 10; k++) {
          gx = mix01(id ^ (0x632be5ab + k * 0x9e3779b9)) * 2 - 1;
          gz = mix01(id ^ (0x0b4b82e5 + k * 0x7f4a7c15)) * 2 - 1;
          elev = ridgeAt(gx, gz, seed);
          if (elev > 0.04) {
            found = true;
            break;
          }
        }
      }
      if (!found) {
        gx = a * 2 - 1;
        lvl = d < 0.15 || d >= 0.26 ? 0 : d < 0.22 ? 1 : 2;
        gz = ridgeSpine(gx, seed) + RIDGE_OFFSET[lvl];
        elev = ridgeAt(gx, gz, seed);
      }
      e = elev;
      px = gx * 1.3;
      pz = gz * 0.8;
      py = elev * 1.25 - 0.42;
    } else if (kind === 'city' && (f = mix01(id ^ 0x0badf00d)) < 0.15) {
      /* Traffic: headlights one way, taillights the other; an elevated
         line with two trains; the viaduct itself as dotted rails and piers. */
      dir = b < 0.5 ? 1 : -1;
      if (f < 0.1) {
        k = Math.floor(a * 12);
        move = k < 4
          ? { mv: 'traffic', ax: 0, L: 1.3, lane: CITY_AVENUES[k] + dir * 0.022 }
          : { mv: 'traffic', ax: 1, L: 0.7, lane: -1.12 + (k - 4) * 0.28 + 0.14 + dir * 0.018 };
        move.u0 = (d * 2 - 1) * move.L;
        move.spd = dir * (0.00012 + c * 0.00009);
        move.lit = dir > 0;
        move.glow = dir > 0 ? 0.5 : 0;
        py = CITY_GROUND + 0.015;
      } else if (f < 0.125) {
        move = { mv: 'traffic', ax: 0, L: 1.3, lane: CITY_RAIL_Z + dir * 0.03, lit: true, glow: 1 };
        move.u0 = (dir > 0 ? -0.5 : 0.7) - dir * a * 0.34;
        move.spd = dir * 0.00045;
        py = CITY_GROUND + CITY_RAIL_H + 0.02;
      } else {
        if (c < 0.3) {
          px = (Math.floor(a * 10) + 0.5) * 0.26 - 1.3;
          py = CITY_GROUND + b * CITY_RAIL_H;
          pz = CITY_RAIL_Z;
        } else {
          px = (Math.floor(a * 86) + 0.5) / 86 * 2.6 - 1.3;
          py = CITY_GROUND + CITY_RAIL_H;
          pz = CITY_RAIL_Z + dir * 0.03;
        }
      }
      if (move) {
        px = move.ax ? move.lane : move.u0;
        pz = move.ax ? move.u0 : move.lane;
      }
    } else if (kind === 'city') {
      /* Towers are drawn as window grids: floors by columns on each face. */
      base = cityBlocks(seed);
      u = a * base.total;
      for (k = 0; k < base.list.length - 1 && base.list[k].acc < u; k++) {}
      bld = base.list[k];
      if (b < 0.12) {
        u = c * 4;
        v = u - Math.floor(u);
        px = bld.x + (u < 1 ? v * 2 - 1 : u < 2 ? 1 : u < 3 ? 1 - v * 2 : -1) * bld.hx;
        pz = bld.z + (u < 1 ? -1 : u < 2 ? v * 2 - 1 : u < 3 ? 1 : 1 - v * 2) * bld.hz;
        py = CITY_GROUND + bld.h;
      } else {
        lvl = Math.max(2, Math.round(bld.h / 0.05));
        py = CITY_GROUND + (Math.floor(d * lvl) + 0.6) * bld.h / lvl;
        u = c * (bld.hx + bld.hz) * 4;
        u = Math.min((bld.hx + bld.hz) * 4 - 0.001, (Math.floor(u / 0.034) + 0.5) * 0.034);
        if (u < bld.hx * 2) {
          px = bld.x - bld.hx + u;
          pz = bld.z - bld.hz;
        } else if (u < bld.hx * 2 + bld.hz * 2) {
          px = bld.x + bld.hx;
          pz = bld.z - bld.hz + (u - bld.hx * 2);
        } else if (u < bld.hx * 4 + bld.hz * 2) {
          px = bld.x + bld.hx - (u - bld.hx * 2 - bld.hz * 2);
          pz = bld.z + bld.hz;
        } else {
          px = bld.x - bld.hx;
          pz = bld.z + bld.hz - (u - bld.hx * 4 - bld.hz * 2);
        }
      }
    }
    if (move) {
      move.x = px;
      move.y = py;
      move.z = pz;
      move.e = e;
      move.th = th;
      move.r = clamp01(Math.sqrt(px * px + py * py + pz * pz) / 1.3);
      return move;
    }
    return {
      x: px,
      y: py,
      z: pz,
      e: e,
      th: th,
      r: clamp01(Math.sqrt(px * px + py * py + pz * pz) / 1.3)
    };
  }

  function wrapAngle(t) {
    t = (t + Math.PI) % 6.2832;
    if (t < 0) t += 6.2832;
    return t - Math.PI;
  }

  function lidarShadowed(ang, rad) {
    var i;
    var o;
    var dist;
    for (i = 0; i < LIDAR_CARS.length; i++) {
      o = LIDAR_CARS[i];
      dist = Math.sqrt(o[0] * o[0] + o[1] * o[1]);
      if (rad > dist - 0.06 &&
          Math.abs(wrapAngle(ang - Math.atan2(o[1], o[0]))) < Math.atan((LIDAR_CAR[0] + 0.02) / dist)) {
        return true;
      }
    }
    for (i = 0; i < LIDAR_POLES.length; i++) {
      o = LIDAR_POLES[i];
      dist = Math.sqrt(o[0] * o[0] + o[1] * o[1]);
      if (rad > dist && Math.abs(wrapAngle(ang - Math.atan2(o[1], o[0]))) < Math.atan(0.035 / dist)) {
        return true;
      }
    }
    return false;
  }

  function ridgeSpine(gx, seed) {
    return 0.14 * Math.sin(gx * 2.2 + seed * 1.7);
  }

  function ridgeCrest(gx, s, r) {
    var c;
    if (r === 0) {
      c = 0.5 + 0.26 * Math.sin(gx * 2.6 + s * 1.3) + 0.14 * Math.sin(gx * 5.9 - s) +
        0.16 * Math.pow(Math.abs(Math.sin(gx * 7.3 + s * 2)), 3) +
        0.06 * Math.abs(Math.sin(gx * 17 + s));
    } else if (r === 1) {
      c = 0.36 + 0.2 * Math.sin(gx * 3.4 - s * 0.7) + 0.1 * Math.abs(Math.sin(gx * 9.1 + s));
    } else {
      c = 0.16 + 0.08 * Math.sin(gx * 4.3 + s * 1.9) + 0.04 * Math.abs(Math.sin(gx * 11 - s));
    }
    return c * (1 - 0.5 * gx * gx);
  }

  /* Three parallel ranges: main, a lower one behind, foothills in front. */
  function ridgeAt(gx, gz, seed) {
    var s = seed * 1.7;
    var spine = ridgeSpine(gx, seed);
    var hgt = 0;
    var r;
    var t;
    for (r = 0; r < 3; r++) {
      t = 1 - Math.abs(gz - spine - RIDGE_OFFSET[r]) / RIDGE_WIDTH[r];
      if (t > 0) hgt = Math.max(hgt, ridgeCrest(gx, s, r) * Math.pow(t, 2.2));
    }
    if (hgt > 0) hgt += 0.018 * Math.sin(gx * 23 + gz * 17 + s);
    return clamp01(hgt);
  }

  var cityCache = null;
  var cityCacheSeed = -1;

  function cityBlocks(seed) {
    if (cityCache && cityCacheSeed === seed) return cityCache;
    var list = [];
    var total = 0;
    var ox = (mix01(Math.imul(seed + 5, 0x27d4eb2f)) - 0.5) * 0.5;
    var oz = (mix01(Math.imul(seed + 9, 0x61c88647)) - 0.5) * 0.3;
    var i;
    var j;
    var n;
    var bx;
    var bz;
    var hx;
    var hz;
    var h;
    for (i = 0; i < 9; i++) {
      for (j = 0; j < 3; j++) {
        n = Math.imul(seed + 3, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b) ^ Math.imul(j + 1, 0xc2b2ae35);
        if (mix01(n ^ 0x1234567) < 0.14) continue;
        bx = -1.12 + i * 0.28 + (mix01(n ^ 0x0f0f0f0) - 0.5) * 0.06;
        bz = -0.4 + j * 0.4;
        hx = 0.06 + mix01(n ^ 0x2468ace) * 0.035;
        hz = 0.06 + mix01(n ^ 0x13579bd) * 0.03;
        h = 0.1 + 1.4 * Math.exp(-((bx - ox) * (bx - ox) + (bz - oz) * (bz - oz) * 0.5) / 0.22) *
          (0.3 + 0.7 * mix01(n ^ 0x7f7f7f7));
        if (mix01(n ^ 0x3c3c3c3) > 0.88) h += 0.4;
        if (j === 2) h *= 0.6;
        total += (hx + hz) * 2 * h + hx * hz * 1.5;
        list.push({ x: bx, z: bz, hx: hx, hz: hz, h: h, acc: total });
      }
    }
    cityCache = { list: list, total: total };
    cityCacheSeed = seed;
    return cityCache;
  }

  /* ---- Health set: scan, lungs, blood, neuron, globe, molecule, heart. */

  var EXTRA_SHAPES = {
    scan: 1, lungs: 1, blood: 1, neuron: 1, globe: 1, molecule: 1, heart: 1,
    planning: 1, neural: 1, satellites: 1, voxels: 1, wafer: 1, datacenter: 1,
    molar: 1, mri: 1, flask: 1, microscope: 1, syringe: 1, rocket: 1, radar: 1,
    eye: 1, skull: 1, stethoscope: 1
  };
  var SCAN_SLICES = 22;
  var BLOOD_CELLS = 21;
  var NEURON_SOMA = [-0.78, 0.05, 0];
  /* lat, lon, half-lat, half-lon (degrees): a coarse continent mask. */
  var GLOBE_LAND = [
    [48, -100, 18, 28], [30, -95, 10, 18], [15, -90, 7, 8], [64, -150, 6, 14], [72, -42, 9, 14],
    [-5, -60, 14, 14], [-28, -63, 14, 9], [-45, -69, 8, 5],
    [50, 12, 9, 18], [63, 16, 7, 8], [54, -3, 4, 3],
    [20, 12, 12, 24], [-12, 24, 16, 14], [8, 42, 6, 6], [-19, 47, 6, 3], [23, 46, 8, 9],
    [55, 95, 14, 45], [40, 95, 10, 30], [21, 79, 9, 8], [15, 102, 8, 6], [32, 115, 8, 10],
    [-3, 115, 4, 15], [37, 138, 6, 3], [-25, 134, 10, 17]
  ];
  /* lat, lon, relative health-metric value. */
  var GLOBE_CITIES = [
    [37.8, -122.4, 0.9], [40.7, -74, 1], [19.4, -99.1, 0.7], [-23.5, -46.6, 0.75],
    [51.5, -0.1, 0.8], [6.5, 3.4, 0.6], [30, 31.2, 0.55], [19, 72.8, 0.85],
    [28.6, 77.2, 0.7], [39.9, 116.4, 0.8], [31.2, 121.5, 0.75], [35.7, 139.7, 0.95],
    [-6.2, 106.8, 0.6], [-33.9, 151.2, 0.5], [14.6, 121, 0.55], [-4.3, 15.3, 0.5]
  ];
  var HEART_RA = [-0.4, 0.36, 0.08, 0.23];
  var HEART_LA = [0.32, 0.4, -0.22, 0.2];
  var HEART_AORTA = [[0.02, 0.3, 0.02], [0, 1.08, 0], [0.42, 0.62, -0.34]];
  var HEART_PULM = [[0.18, 0.2, 0.3], [0.22, 0.78, 0.32], [0.55, 0.6, 0.08]];
  var HEART_SVC = [[-0.42, 0.45, 0], [-0.42, 0.75, -0.01], [-0.42, 1.02, -0.02]];

  /* Caffeine, space-filling: heavy atoms from the ring skeleton, methyl
     hydrogens fanned out of plane. No bonds: atoms are overlapping shells. */
  var MOLECULE = (function () {
    var heavy = [
      [0.51, 0.7, 'C'], [-0.7, 1.4, 'C'], [-1.91, 0.7, 'N'], [-1.91, -0.7, 'C'],
      [-0.7, -1.4, 'N'], [0.51, -0.7, 'C'], [1.84, 1.13, 'N'], [2.66, 0, 'C'],
      [1.84, -1.13, 'N'], [-0.7, 2.62, 'O'], [-2.97, -1.31, 'O'],
      [-3.15, 1.42, 'C'], [-0.7, -2.87, 'C'], [2.3, 2.45, 'C']
    ];
    var methyls = [[11, 2], [12, 4], [13, 6]];
    var R = { C: 0.85, N: 0.8, O: 0.8, H: 0.55 };
    var E = { C: 0.55, N: 0.7, O: 0.9, H: 0.32 };
    var raw = heavy.map(function (h) { return [h[0], h[1], 0, h[2]]; });
    var atoms = [];
    var total = 0;
    var scale = 0.27;
    var cx = 0;
    raw.push([3.74, 0.02, 0, 'H']);
    methyls.forEach(function (m) {
      var cc = heavy[m[0]];
      var nn = heavy[m[1]];
      var ux = cc[0] - nn[0];
      var uy = cc[1] - nn[1];
      var l = Math.sqrt(ux * ux + uy * uy);
      var k;
      var ang;
      ux /= l;
      uy /= l;
      for (k = 0; k < 3; k++) {
        ang = k * 2.094 + 0.5;
        raw.push([
          cc[0] + ux * 0.38 - uy * 0.98 * Math.cos(ang),
          cc[1] + uy * 0.38 + ux * 0.98 * Math.cos(ang),
          0.98 * Math.sin(ang),
          'H'
        ]);
      }
    });
    raw.forEach(function (r) { cx += r[0] / raw.length; });
    raw.forEach(function (r) {
      var rad = R[r[3]] * scale;
      total += rad * rad;
      atoms.push({ x: (r[0] - cx) * scale, y: r[1] * scale, z: r[2] * scale, r: rad, e: E[r[3]], acc: total });
    });
    return { atoms: atoms, total: total };
  })();

  var seedCache = {};

  function perSeed(name, seed, build) {
    var hit = seedCache[name];
    if (!hit || hit.seed !== seed) {
      hit = { seed: seed, val: build(seed) };
      seedCache[name] = hit;
    }
    return hit.val;
  }

  function seededRng(seed, salt) {
    var n = 0;
    return function () {
      n++;
      return mix01(Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(n + salt, 0x85ebca6b));
    };
  }

  function vNorm(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function vCross(p, q) {
    return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  }

  function vRotate(v, k, t) {
    var co = Math.cos(t);
    var si = Math.sin(t);
    var kv = vCross(k, v);
    var dt = (k[0] * v[0] + k[1] * v[1] + k[2] * v[2]) * (1 - co);
    return [v[0] * co + kv[0] * si + k[0] * dt, v[1] * co + kv[1] * si + k[1] * dt, v[2] * co + kv[2] * si + k[2] * dt];
  }

  function pickAcc(list, target) {
    var lo = 0;
    var hi = list.length - 1;
    var mid;
    while (lo < hi) {
      mid = (lo + hi) >> 1;
      if (list[mid].acc < target) lo = mid + 1;
      else hi = mid;
    }
    return list[lo];
  }

  /* Binary branching tubes; each generation turns its split plane 90°. */
  function growTree(out, p, dir, perp, len, rad, depth, opt, rnd) {
    var q = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len];
    var axis;
    var s;
    var nd;
    out.segs.push({ a: p, b: q, rad: rad, len: len });
    if (depth >= opt.depth) {
      out.leaves.push(q);
      return;
    }
    axis = vNorm(vCross(dir, perp));
    for (s = -1; s <= 1; s += 2) {
      nd = vRotate(dir, axis, s * (depth === 0 ? opt.first : opt.spread) * (0.8 + 0.4 * rnd()));
      nd[1] -= opt.droop;
      if (opt.out && depth > 0) nd[0] += opt.out * (q[0] > 0 ? 1 : -1);
      nd = vNorm(nd);
      growTree(out, q, nd, axis, len * (opt.shrink + 0.1 * rnd()), rad * 0.72, depth + 1, opt, rnd);
    }
  }

  function weighTree(t) {
    var total = 0;
    t.segs.forEach(function (sg) {
      total += sg.len * (sg.rad + 0.012);
      sg.acc = total;
    });
    t.total = total;
    return t;
  }

  function treePoint(t, u, v, g) {
    var sg = pickAcc(t.segs, u * t.total);
    return [
      sg.a[0] + (sg.b[0] - sg.a[0]) * v + g[0] * sg.rad * 0.6,
      sg.a[1] + (sg.b[1] - sg.a[1]) * v + g[1] * sg.rad * 0.6,
      sg.a[2] + (sg.b[2] - sg.a[2]) * v + g[2] * sg.rad * 0.6
    ];
  }

  function leafPoint(t, u, g, sig) {
    var q = t.leaves[Math.floor(u * t.leaves.length) % t.leaves.length];
    return [q[0] + g[0] * sig, q[1] + g[1] * sig, q[2] + g[2] * sig];
  }

  function lungTree(seed) {
    var t = { segs: [], leaves: [] };
    growTree(t, [0, 0.82, 0], [0, -1, 0], [1, 0, 0], 0.36, 0.07, 0,
      { depth: 6, first: 0.8, spread: 0.55, droop: 0.6, out: 0.2, shrink: 0.8 }, seededRng(seed, 17));
    return weighTree(t);
  }

  function axonAt(s, seed) {
    return [
      -0.66 + 1.66 * s,
      0.05 - 0.1 * s + 0.1 * Math.sin(s * 6.9 + seed),
      0.08 * Math.sin(s * 4.1 + seed * 0.7)
    ];
  }

  function neuronParts(seed) {
    var rnd = seededRng(seed, 29);
    var dend = { segs: [], leaves: [] };
    var term = { segs: [], leaves: [] };
    var k;
    var ang;
    var dir;
    for (k = 0; k < 7; k++) {
      ang = (k / 7) * 6.2832 + rnd() * 0.5;
      dir = vNorm([-0.2 - rnd() * 0.6, Math.cos(ang), Math.sin(ang)]);
      growTree(dend, [NEURON_SOMA[0] + dir[0] * 0.12, NEURON_SOMA[1] + dir[1] * 0.12, NEURON_SOMA[2] + dir[2] * 0.12],
        dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], 0.22, 0.028, 0,
        { depth: 3, first: 0.6, spread: 0.55, droop: 0, shrink: 0.7 }, rnd);
    }
    growTree(term, axonAt(1, seed), [1, 0, 0], [0, 1, 0], 0.12, 0.02, 0,
      { depth: 3, first: 0.7, spread: 0.6, droop: 0, shrink: 0.75 }, rnd);
    return { dend: weighTree(dend), term: weighTree(term) };
  }

  function bloodCells(seed) {
    var rnd = seededRng(seed, 41);
    var list = [];
    var k;
    var rr;
    var ang;
    for (k = 0; k < BLOOD_CELLS; k++) {
      rr = Math.sqrt(rnd()) * 0.28;
      ang = rnd() * 6.2832;
      list.push({
        wbc: k >= BLOOD_CELLS - 3,
        x0: rnd() * 2.9 - 1.45,
        y: Math.cos(ang) * rr,
        z: Math.sin(ang) * rr,
        tilt: rnd() * 6.2832,
        spin: (rnd() - 0.5) * 0.0016,
        /* Poiseuille flow: fastest on the vessel axis. */
        v: (k >= BLOOD_CELLS - 3 ? 0.6 : 1) * (0.00005 + 0.00017 * (1 - rr * rr / 0.18))
      });
    }
    return list;
  }

  function wrapDeg(t) {
    t = (t + 180) % 360;
    if (t < 0) t += 360;
    return t - 180;
  }

  function isLand(lat, lon) {
    var i;
    var bl;
    var dl;
    var dn;
    for (i = 0; i < GLOBE_LAND.length; i++) {
      bl = GLOBE_LAND[i];
      dl = (lat - bl[0]) / bl[2];
      dn = wrapDeg(lon - bl[1]) / bl[3];
      if (dl * dl + dn * dn < 1 + 0.18 * Math.sin(lat * 0.21 + lon * 0.13) * Math.cos(lon * 0.17)) return true;
    }
    return false;
  }

  function tubeAt(P, s, rad, ang) {
    var m = 1 - s;
    var c = [];
    var tan = [];
    var i;
    var nrm;
    var bin;
    for (i = 0; i < 3; i++) {
      c[i] = m * m * P[0][i] + 2 * m * s * P[1][i] + s * s * P[2][i];
      tan[i] = 2 * m * (P[1][i] - P[0][i]) + 2 * s * (P[2][i] - P[1][i]);
    }
    tan = vNorm(tan);
    nrm = vNorm(vCross(tan, Math.abs(tan[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]));
    bin = vCross(tan, nrm);
    return [
      c[0] + rad * (Math.cos(ang) * nrm[0] + Math.sin(ang) * bin[0]),
      c[1] + rad * (Math.cos(ang) * nrm[1] + Math.sin(ang) * bin[1]),
      c[2] + rad * (Math.cos(ang) * nrm[2] + Math.sin(ang) * bin[2])
    ];
  }

  function shell(c, r, dir) {
    return [c[0] + dir[0] * r, c[1] + dir[1] * r, c[2] + dir[2] * r];
  }

  function gauss3(id) {
    var r1 = Math.sqrt(-2 * Math.log(Math.max(1e-6, mix01(id ^ 0x2f6b1a9d))));
    var t1 = 6.2832 * mix01(id ^ 0x45d9f3b1);
    var r2 = Math.sqrt(-2 * Math.log(Math.max(1e-6, mix01(id ^ 0x119de1f3))));
    var t2 = 6.2832 * mix01(id ^ 0x6c8e9cf5);
    return [r1 * Math.cos(t1), r1 * Math.sin(t1), r2 * Math.cos(t2)];
  }

  /* Four cusps on the corners of the occlusal table: x, y, z, radius. */
  var MOLAR_CUSPS = [
    [-0.20, 0.66, -0.14, 0.17],
    [0.21, 0.67, -0.13, 0.17],
    [-0.18, 0.64, 0.14, 0.16],
    [0.19, 0.65, 0.15, 0.165]
  ];

  function molarDir(id, salt, yMax) {
    var dir;
    var k;
    for (k = 0; k < 6; k++) {
      dir = vNorm(gauss3(id ^ (salt + k * 0x9e3779b9)));
      if (dir[1] <= yMax) return dir;
    }
    dir[1] = yMax;
    return vNorm(dir);
  }

  /* Rounded-box radius along a unit direction. n > 2 squares the egg into a crown. */
  function molarOnBox(dir, ax, ay, az) {
    var n = 3.15;
    var t = Math.pow(Math.abs(dir[0]) / ax, n) +
      Math.pow(Math.abs(dir[1]) / ay, n) +
      Math.pow(Math.abs(dir[2]) / az, n);
    t = Math.pow(Math.max(1e-6, t), -1 / n);
    return [dir[0] * t, dir[1] * t, dir[2] * t];
  }

  function molarCrown(id, b) {
    var dir = molarDir(id, 0x51ed270b, 0.46);
    var p = molarOnBox(dir, 0.62, 0.28, 0.48);
    var shell = 0.92 + 0.08 * b;
    var y;
    p[0] *= shell;
    p[1] *= shell;
    p[2] *= shell;
    y = p[1] + 0.40;
    /* Cream enamel on the cap; gold at the neck, where the roots begin. */
    return [p[0], y, p[2], y > 0.32 ? 0.9 : 0.58, 0];
  }

  function molarCusp(id, idx, b) {
    var csp = MOLAR_CUSPS[idx];
    var dir = vNorm(gauss3(id ^ (0x6c8e9cf5 + idx * 0x9e3779b9)));
    var shell;
    var y;
    if (dir[1] < 0) dir[1] = -dir[1];
    /* Keep the fossa empty: flip any sample that faces the middle of the table. */
    if (dir[0] * csp[0] + dir[2] * csp[2] < 0) {
      dir[0] = -dir[0];
      dir[2] = -dir[2];
    }
    shell = csp[3] * (0.86 + 0.14 * b);
    y = csp[1] + dir[1] * shell * 0.78;
    return [
      csp[0] + dir[0] * shell,
      y,
      csp[2] + dir[2] * shell,
      0.9,
      dir[1] > 0.62 ? 0.65 : 0
    ];
  }

  function molarRoot(which, v, ang, fill) {
    var side = which ? 1 : -1;
    var len = 1.02;
    var rad = 0.13 * (1 - 0.34 * v);
    /* A thick shell, so each root stays a column and the fork stays empty. */
    var rho = rad * (0.8 + 0.2 * fill);
    var y = 0.24 - len * v;
    return [
      side * (0.2 + 0.22 * v) + Math.cos(ang) * rho,
      y,
      side * 0.035 * v + Math.sin(ang) * rho * 0.7,
      0.62,
      0
    ];
  }

  /* Gantry axis is +x. The couch runs out through the bore toward +x. */
  var MRI_CY = 0.06;
  var MRI_BORE = 0.40;
  var MRI_OUTER = 0.76;
  var MRI_FRONT = 0.26;
  var MRI_BACK = -0.40;
  var MRI_COUCH_X0 = 0.02;
  var MRI_COUCH_X1 = 1.06;
  var MRI_COUCH_Z = 0.22;
  var MRI_COUCH_Y = 0.0;

  function mriFace(x, b, c, front) {
    var ang = b * 6.2832;
    var rad = Math.sqrt(MRI_BORE * MRI_BORE + c * (MRI_OUTER * MRI_OUTER - MRI_BORE * MRI_BORE));
    var inset = 0;
    var lip = front && rad < 0.50;
    if (front && rad < 0.52) inset = (0.52 - rad) * 0.55;
    else if (front && rad > 0.66) inset = (rad - 0.66) * 0.28;
    return [
      x - inset,
      MRI_CY + Math.cos(ang) * rad,
      Math.sin(ang) * rad,
      lip ? 0.9 : (front ? 0.56 : 0.38),
      0
    ];
  }

  function mriWall(outer, b, c) {
    var ang = b * 6.2832;
    var up = Math.cos(ang);
    return [
      MRI_BACK + c * (MRI_FRONT - MRI_BACK),
      MRI_CY + up * (outer ? MRI_OUTER : MRI_BORE),
      Math.sin(ang) * (outer ? MRI_OUTER : MRI_BORE),
      outer ? 0.46 : (up > 0.25 ? 0.84 : 0.48),
      0
    ];
  }

  function mriCouch(a, b, c) {
    var x = MRI_COUCH_X0 + a * (MRI_COUCH_X1 - MRI_COUCH_X0);
    var z = (b - 0.5) * 2 * MRI_COUCH_Z;
    var y = MRI_COUCH_Y;
    var bot = MRI_COUCH_Y - 0.16;
    var e = 0.68;
    if (c < 0.58) {
      /* Top of the couch, the broad face. */
    } else if (c < 0.78) {
      z = b < 0.5 ? -MRI_COUCH_Z : MRI_COUCH_Z;
      y = bot + ((c - 0.58) / 0.2) * (MRI_COUCH_Y - bot);
      e = 0.5;
    } else if (c < 0.92) {
      /* Near end, the face that points out of the bore. */
      x = MRI_COUCH_X1;
      z = (a - 0.5) * 2 * MRI_COUCH_Z;
      y = bot + b * (MRI_COUCH_Y - bot);
      e = 0.78;
    } else {
      y = bot;
      e = 0.4;
    }
    return [x, y, z, e, 0];
  }

  /* Erlenmeyer: flat foot, straight taper, shoulder, neck, flared lip.
     Half full of reagent. View matches orient()'s mean rotY(0.62), rotX(0.62). */
  var FLASK_BASE = -0.62;
  var FLASK_HEEL = -0.50;
  var FLASK_SH = -0.02;
  var FLASK_NECK0 = 0.14;
  var FLASK_NECK1 = 0.56;
  var FLASK_VIEW = [-0.473, 0.581, 0.662];

  function flaskR(y) {
    var t;
    var sm;
    if (y <= FLASK_HEEL) return 0.76;
    if (y < FLASK_SH) {
      t = (y - FLASK_HEEL) / (FLASK_SH - FLASK_HEEL);
      return 0.76 + (0.34 - 0.76) * t;
    }
    if (y < FLASK_NECK0) {
      t = (y - FLASK_SH) / (FLASK_NECK0 - FLASK_SH);
      sm = t * t * (3 - 2 * t);
      return 0.34 + (0.22 - 0.34) * sm;
    }
    return 0.22;
  }

  /* Left and right limbs only, so the neck bore stays open. */
  function flaskLimb(b) {
    var limb = Math.atan2(-FLASK_VIEW[0], FLASK_VIEW[2]);
    var side = b < 0.5 ? 0 : Math.PI;
    var u = (b < 0.5 ? b * 2 : (b - 0.5) * 2) - 0.5;
    return limb + side + u * 0.85;
  }

  function flaskPoint(f, a, b, c) {
    var y;
    var ang;
    var r;
    var e;
    if (f < 0.18) {
      /* Glass edge of the cone. Limbs only: a front wall would cover the reagent. */
      y = FLASK_BASE + a * (FLASK_NECK0 - FLASK_BASE);
      ang = flaskLimb(b);
      r = flaskR(y) * (0.9 + 0.1 * c);
      e = 0.52;
    } else if (f < 0.32) {
      y = FLASK_NECK0 + a * (FLASK_NECK1 - FLASK_NECK0);
      ang = flaskLimb(b);
      r = 0.14 + c * 0.1;
      e = 0.5;
    } else if (f < 0.46) {
      y = FLASK_NECK1 + a * 0.08;
      ang = b * 6.2832;
      r = 0.22 + Math.sqrt(c) * 0.26;
      e = 0.66;
    } else {
      /* Reagent fills the cone up to the shoulder. */
      y = FLASK_BASE + 0.04 + a * (FLASK_SH + 0.04 - FLASK_BASE);
      ang = b * 6.2832;
      r = Math.sqrt(c) * flaskR(Math.min(y, FLASK_SH)) * 0.9;
      e = 0.88;
    }
    return [Math.cos(ang) * r, y, Math.sin(ang) * r, e, 0];
  }

  /* Compound microscope in profile. Arm pillar at the back, stage cantilevered
     forward, binocular head on the tube. Mean camera rotY(-1.02), rotX(0.46). */
  var SCOPE_BX = 0;
  var SCOPE_BZ = 0;
  var SCOPE_ARM_Z = -0.58;
  var SCOPE_OBJS = [
    [0.00, 0.0, 0.08, 0.12, 0.92],
    [-0.18, -0.06, 0.055, 0.07, 0.5],
    [0.18, -0.05, 0.05, 0.06, 0.48]
  ];
  var SCOPE_BRIDGE = [[0, 0.46, -0.58], [0, 0.66, -0.28], [0, 0.54, 0]];

  function scopeFrame(dx, dy, dz) {
    var l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var d = [dx / l, dy / l, dz / l];
    var n = vNorm(vCross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    return { d: d, n: n, b: vCross(d, n) };
  }

  /* Both barrels face the camera and splay across the frame, so the openings read. */
  var SCOPE_EYE = [scopeFrame(0.58, 0.45, 0.77), scopeFrame(0.94, 0.45, 0.17)];
  var SCOPE_EYE0 = [[-0.1, 0.64, 0.26], [0.1, 0.64, -0.02]];

  function scopeBase(a, b, c) {
    var rx = 0.9;
    var rz = 0.52;
    var y0 = -0.82;
    var y1 = -0.64;
    var ang = b * 6.2832;
    var rho = Math.sqrt(a);
    var shell = c < 0.5 || c >= 0.8;
    var x = Math.cos(ang) * rx * (shell ? rho : 1);
    var z = Math.sin(ang) * rz * (shell ? rho : 1);
    var y = c < 0.5 ? y1 : c < 0.8 ? y0 + a * (y1 - y0) : y0;
    var e = c < 0.5 ? 0.58 : 0.42;
    var dx;
    var dz;
    if (c < 0.5) {
      dx = x - SCOPE_BX;
      dz = z - SCOPE_BZ;
      rho = Math.sqrt(dx * dx + dz * dz);
      if (rho > 0.06 && rho < 0.15) e = 0.92;
    }
    return [x, y, z, e, 0];
  }

  function scopeArm(a, b) {
    var ang = b * 6.2832;
    return [Math.cos(ang) * 0.16, -0.64 + a * 1.12, SCOPE_ARM_Z + Math.sin(ang) * 0.14, 0.5, 0];
  }

  function scopeBridge(a, b) {
    var p = tubeAt(SCOPE_BRIDGE, a, 0.12, b * 6.2832);
    return [p[0], p[1], p[2], 0.52, 0];
  }

  function scopeStage(a, b, c) {
    var x0 = -0.55;
    var x1 = 0.55;
    var z0 = -0.48;
    var z1 = 0.62;
    var y0 = -0.42;
    var y1 = -0.3;
    var x;
    var z;
    var y;
    var e = 0.68;
    var dx;
    var dz;
    var r;
    if (c < 0.62) {
      x = x0 + a * (x1 - x0);
      z = z0 + b * (z1 - z0);
      dx = x - SCOPE_BX;
      dz = z - SCOPE_BZ;
      r = Math.sqrt(dx * dx + dz * dz) || 1e-4;
      if (r < 0.15) {
        x = SCOPE_BX + dx / r * 0.15;
        z = SCOPE_BZ + dz / r * 0.15;
        e = 0.92;
      }
      y = y1;
    } else if (c < 0.8) {
      x = x0 + a * (x1 - x0);
      z = z1;
      y = y0 + b * (y1 - y0);
      e = 0.52;
    } else if (c < 0.92) {
      z = z0 + a * (z1 - z0);
      x = b < 0.5 ? x0 : x1;
      y = y0 + (c - 0.8) / 0.12 * (y1 - y0);
      e = 0.46;
    } else {
      r = a * 6.2832;
      x = SCOPE_BX + Math.cos(r) * 0.15;
      z = SCOPE_BZ + Math.sin(r) * 0.15;
      y = y0 + b * (y1 - y0);
      e = 0.9;
    }
    return [x, y, z, e, 0];
  }

  function scopeKnob(a, b, fine) {
    var ang = a * 6.2832;
    var rho = Math.sqrt(b) * (fine ? 0.075 : 0.13);
    return [
      0.3,
      -0.22 + Math.sin(ang) * rho,
      SCOPE_ARM_Z + (fine ? 0.22 : 0) + Math.cos(ang) * rho,
      fine ? 0.9 : 0.64,
      0
    ];
  }

  function scopeBody(a, b) {
    var ang = b * 6.2832;
    return [
      SCOPE_BX + Math.cos(ang) * 0.15,
      0.02 + a * 0.5,
      SCOPE_BZ + Math.sin(ang) * 0.15,
      0.48,
      0
    ];
  }

  function scopeNose(a, b, c) {
    var ang = a * 6.2832;
    var rho = Math.sqrt(b) * 0.24;
    return [SCOPE_BX + Math.cos(ang) * rho, -0.02 + c * 0.08, SCOPE_BZ + Math.sin(ang) * rho, 0.62, 0];
  }

  function scopeObj(a, b, c) {
    var o = SCOPE_OBJS[Math.floor(a * 3) % 3];
    var ang = b * 6.2832;
    var r = o[2] * (1 - 0.18 * c);
    return [
      SCOPE_BX + o[0] + Math.cos(ang) * r,
      -0.02 - c * o[3],
      SCOPE_BZ + o[1] + Math.sin(ang) * r,
      c > 0.7 ? o[4] : 0.5,
      c > 0.84 && o[4] > 0.8 ? 0.35 : 0
    ];
  }

  function scopeHead(a, b, c) {
    var x0 = -0.28;
    var x1 = 0.28;
    var y0 = 0.48;
    var y1 = 0.7;
    var z0 = -0.04;
    var z1 = 0.22;
    if (c < 0.45) return [x0 + a * (x1 - x0), y1, z0 + b * (z1 - z0), 0.6, 0];
    if (c < 0.75) return [x0 + a * (x1 - x0), y0 + b * (y1 - y0), z1, 0.68, 0];
    if (c < 0.9) return [c < 0.825 ? x0 : x1, y0 + b * (y1 - y0), z0 + a * (z1 - z0), 0.48, 0];
    return [x0 + a * (x1 - x0), y0, z0 + b * (z1 - z0), 0.4, 0];
  }

  function scopeEye(which, a, b) {
    var fr = SCOPE_EYE[which];
    var p0 = SCOPE_EYE0[which];
    var ang = b * 6.2832;
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var t = a;
    var rad = 0.12;
    var e = 0.58;
    var glow = 0;
    var u;
    if (a > 0.5) {
      t = 1;
      rad = 0.07 + (a - 0.5) / 0.5 * 0.07;
      e = 0.94;
      if (a > 0.82) glow = 0.35;
    }
    u = 0.28 * t;
    return [
      p0[0] + fr.d[0] * u + rad * (co * fr.n[0] + si * fr.b[0]),
      p0[1] + fr.d[1] * u + rad * (co * fr.n[1] + si * fr.b[1]),
      p0[2] + fr.d[2] * u + rad * (co * fr.n[2] + si * fr.b[2]),
      e,
      glow
    ];
  }

  function scopePoint(f, a, b, c) {
    if (f < 0.16) return scopeBase(a, b, c);
    if (f < 0.28) return scopeArm(a, b);
    if (f < 0.35) return scopeBridge(a, b);
    if (f < 0.51) return scopeStage(a, b, c);
    if (f < 0.57) return scopeKnob(a, b, c < 0.36);
    if (f < 0.69) return scopeBody(a, b);
    if (f < 0.74) return scopeNose(a, b, c);
    if (f < 0.82) return scopeObj(a, b, c);
    if (f < 0.88) return scopeHead(a, b, c);
    return scopeEye(c < 0.5 ? 0 : 1, a, b);
  }

  /* Syringe with the plunger drawn back. Volumes only: a filled barrel,
     a washer flange the rod passes through, a short hub. No needle shaft. */
  var SYR_THUMB0 = -0.90;
  var SYR_THUMB1 = -0.76;
  var SYR_ROD0 = -0.76;
  var SYR_ROD1 = 0.18;
  var SYR_FL0 = -0.10;
  var SYR_FL1 = 0.04;
  var SYR_BAR0 = 0.04;
  var SYR_BAR1 = 0.82;
  var SYR_HUB0 = 0.82;
  var SYR_HUB1 = 0.98;
  var SYR_TIP0 = 0.98;
  var SYR_TIP1 = 1.12;

  function syrPoint(f, a, b, c) {
    var ang = b * 6.2832;
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var x;
    var rho;
    var y;
    var z;
    var e;
    var glow = 0;
    var t;
    if (f < 0.11) {
      /* Thumb rest: a solid disc, smaller than the finger flange. */
      x = SYR_THUMB0 + a * (SYR_THUMB1 - SYR_THUMB0);
      rho = Math.sqrt(c) * 0.28;
      e = rho > 0.2 ? 0.96 : 0.82;
    } else if (f < 0.26) {
      /* Rod, then the stopper where it enters the barrel. */
      x = SYR_ROD0 + a * (SYR_ROD1 - SYR_ROD0);
      rho = Math.sqrt(c) * (x > SYR_BAR0 ? 0.13 : 0.105);
      e = x > SYR_BAR0 ? 0.93 : 0.52;
    } else if (f < 0.46) {
      /* Finger flange: thick washer, hole left for the rod. */
      x = SYR_FL0 + a * (SYR_FL1 - SYR_FL0);
      rho = Math.sqrt(0.145 * 0.145 + c * (0.44 * 0.44 - 0.145 * 0.145));
      e = rho > 0.34 ? 0.97 : 0.8;
      if (rho > 0.36) glow = 0.2;
    } else if (f < 0.74) {
      /* Filled barrel. Cream is the dose, settled on the low side. */
      x = SYR_BAR0 + a * (SYR_BAR1 - SYR_BAR0);
      rho = Math.sqrt(c) * 0.23;
      y = co * rho;
      z = si * rho;
      e = y < -0.015 ? 0.9 : 0.46;
      return [x, y, z, e, 0];
    } else if (f < 0.9) {
      t = a;
      x = SYR_HUB0 + t * (SYR_HUB1 - SYR_HUB0);
      rho = Math.sqrt(c) * (0.16 + (0.07 - 0.16) * t);
      e = 0.58;
    } else {
      /* Luer tip: a short cone, thick enough that it stays a volume. */
      t = a;
      x = SYR_TIP0 + t * (SYR_TIP1 - SYR_TIP0);
      rho = Math.sqrt(c) * (0.07 + (0.046 - 0.07) * t);
      e = 0.95;
      if (t > 0.55) glow = 0.28;
    }
    return [x, co * rho, si * rho, e, glow];
  }

  /* Sounding rocket, nose along +y. Fins are slabs, the bell is a shell,
     and the plume is a cone of dots moving straight aft — never a spiral. */
  var RKT_R = 0.26;
  var RKT_BODY0 = -0.42;
  var RKT_BODY1 = 0.26;
  var RKT_NOSE = 0.80;
  var RKT_NOZ1 = -0.68;
  var RKT_PLUME = -0.96;
  var RKT_FIN_R = 0.76;
  var RKT_PORT_Y = -0.02;
  var RKT_LIT = [-0.45, 0.18, 0.87];
  var RKT_FINS = [0.47, 3.61, 5.18];

  function rocketShade(nx, ny, nz) {
    var d = nx * RKT_LIT[0] + ny * RKT_LIT[1] + nz * RKT_LIT[2];
    if (d < 0) d = 0;
    return 0.34 + 0.62 * d * d;
  }

  function rocketNose(a, b, c) {
    var t = a;
    var y = RKT_BODY1 + t * (RKT_NOSE - RKT_BODY1);
    var rMax = RKT_R * (1 - t);
    var ang = b * 6.2832;
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var e = rocketShade(co * 0.84, 0.55, si * 0.84);
    var glow = 0;
    if (rMax < 0.02) rMax = 0.02;
    if (t > 0.82) {
      e = 0.96;
      glow = 0.4;
    }
    return [co * Math.sqrt(c) * rMax, y, si * Math.sqrt(c) * rMax, e, glow];
  }

  function rocketBody(a, b, c) {
    var y = RKT_BODY0 + a * (RKT_BODY1 - RKT_BODY0);
    var ang = b * 6.2832;
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var collar = y > RKT_BODY1 - 0.11;
    var rho = RKT_R * (collar ? 1.02 + 0.06 * c : 0.94 + 0.06 * c);
    var x = co * rho;
    var z = si * rho;
    var dy = y - RKT_PORT_Y;
    var hole = 0.052;
    var h;
    if (z > RKT_R * 0.72 && x * x + dy * dy < hole * hole) {
      h = Math.sqrt(x * x + dy * dy) || 1;
      x = x / h * hole;
      y = RKT_PORT_Y + dy / h * hole;
      z = Math.sqrt(Math.max(0.02, RKT_R * RKT_R - x * x)) + 0.02;
      return [x, y, z, 0.97, 0.45];
    }
    return [x, y, z, collar ? 0.92 : rocketShade(co, 0, si), collar ? 0.16 : 0];
  }

  function rocketPort(a, b) {
    var ang = a * 6.2832;
    var rho = 0.052 + 0.078 * Math.sqrt(b);
    var x = Math.cos(ang) * rho;
    var y = RKT_PORT_Y + Math.sin(ang) * rho;
    var z = Math.sqrt(Math.max(0.02, RKT_R * RKT_R - x * x)) + 0.028;
    return [x, y, z, 0.97, 0.5];
  }

  function rocketFin(k, a, b, c) {
    var ang = RKT_FINS[k];
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var u = a;
    var v = b;
    var w;
    var y;
    var rad;
    var th;
    var d;
    var e;
    var glow = 0;
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    w = 1 - u - v;
    y = u * 0.1 + v * RKT_BODY0 + w * (RKT_BODY0 + 0.08);
    rad = (u + v) * RKT_R + w * RKT_FIN_R;
    th = (c - 0.5) * 0.15;
    d = Math.abs(-si * RKT_LIT[0] + co * RKT_LIT[2]);
    e = 0.38 + 0.5 * d * d;
    if (w > 0.62) {
      e = 0.94;
      glow = 0.28;
    }
    return [co * rad - si * th, y, si * rad + co * th, e, glow];
  }

  function rocketNozzle(a, b, c) {
    var t = a;
    var y = RKT_BODY0 + t * (RKT_NOZ1 - RKT_BODY0);
    var rad = 0.11 + 0.24 * t * t;
    var ang = b * 6.2832;
    var rho = rad * (0.74 + 0.26 * c);
    var e = t > 0.76 ? 0.96 : rocketShade(Math.cos(ang), -0.25, Math.sin(ang));
    return [Math.cos(ang) * rho, y, Math.sin(ang) * rho, e, t > 0.76 ? 0.32 : 0];
  }

  function rocketPlumeAt(s, ang, rad) {
    var y0 = RKT_BODY0 - 0.04;
    var rho = rad * (0.05 + s * 0.32);
    return [Math.cos(ang) * rho, y0 + s * (RKT_PLUME - y0), Math.sin(ang) * rho];
  }

  function rocketPlume(a, b, c) {
    var ang = b * 6.2832;
    var rad = Math.sqrt(c);
    var p = rocketPlumeAt(a, ang, rad);
    return {
      x: p[0], y: p[1], z: p[2],
      e: a < 0.3 ? 0.95 : 0.55,
      glow: a < 0.28 ? 0.65 : 0,
      u0: a, ang: ang, rad: rad,
      spd: 0.00032 + c * 0.00028
    };
  }

  function rocketPoint(f, a, b, c) {
    if (f < 0.18) return rocketNose(a, b, c);
    if (f < 0.46) return rocketBody(a, b, c);
    if (f < 0.52) return rocketPort(a, b);
    if (f < 0.78) return rocketFin(f < 0.607 ? 0 : f < 0.693 ? 1 : 2, a, b, c);
    return rocketNozzle(a, b, c);
  }

  /* Parabolic radar dish. The horn sits in front of the rim, on one thick
     arm, so the profile reads as a dish and not a bowl on a stick. */
  var RADAR_R = 0.7;
  var RADAR_F = 0.32;
  var RADAR_CY = 0.16;
  var RADAR_LIT = [-0.22, 0.48, 0.85];
  var RADAR_ARM = [[0, -0.5, 0.34], [0, -0.3, 0.62], [0, -0.12, 0.74]];
  var RADAR_LNB = [[0, -0.1, 0.68], [0, -0.16, 0.82], [0, -0.2, 0.96]];

  function radarZ(rho) {
    return rho * rho / (4 * RADAR_F);
  }

  function radarShade(nx, ny, nz) {
    var d = nx * RADAR_LIT[0] + ny * RADAR_LIT[1] + nz * RADAR_LIT[2];
    if (d < 0) d = 0;
    return 0.3 + 0.58 * d * d;
  }

  function radarFace(a, b) {
    var ang = b * 6.2832;
    var rho = (RADAR_R - 0.045) * Math.sqrt(a);
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var slope = rho / (2 * RADAR_F);
    var nl = Math.sqrt(slope * slope + 1);
    return [
      co * rho,
      RADAR_CY + si * rho,
      radarZ(rho),
      radarShade(-co * slope / nl, -si * slope / nl, 1 / nl),
      0
    ];
  }

  function radarRim(a, b) {
    var ang = b * 6.2832;
    var pol = a * 6.2832;
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var lip = Math.cos(pol) * 0.046;
    var rr = RADAR_R + lip;
    var e = radarShade(co * 0.72, si * 0.45, 0.55);
    return [
      co * rr,
      RADAR_CY + si * rr,
      radarZ(RADAR_R) + Math.sin(pol) * 0.046,
      e > 0.72 ? 0.9 : e,
      e > 0.8 ? 0.18 : 0
    ];
  }

  function radarBack(a, b) {
    var ang = b * 6.2832;
    var rho = (RADAR_R - 0.05) * Math.sqrt(a);
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    return [
      co * rho,
      RADAR_CY + si * rho,
      radarZ(rho) - 0.055 * (0.35 + 0.65 * rho / RADAR_R),
      0.28 + 0.08 * (si > 0 ? si : 0),
      0
    ];
  }

  function radarArm(a, b) {
    var p = tubeAt(RADAR_ARM, a, 0.072, b * 6.2832);
    return [p[0], p[1], p[2], 0.46 + 0.12 * a, 0];
  }

  function radarLnb(a, b, c) {
    var ang = b * 6.2832;
    var rad = 0.095;
    var t = a;
    var e = 0.94;
    var glow = 0.28;
    if (c > 0.7) {
      /* Scalar ring: a short solid disc, not a wire circle. */
      t = 0.18 + a * 0.16;
      rad = 0.11 + Math.sqrt((c - 0.7) / 0.3) * 0.07;
      e = 0.98;
      glow = 0.4;
    } else if (a > 0.82) {
      t = 1;
      rad = Math.sqrt(c / 0.7) * 0.095;
      glow = 0.38;
    }
    var p = tubeAt(RADAR_LNB, t, rad, ang);
    return [p[0], p[1], p[2], e, glow];
  }

  function radarHub(a, b) {
    var ang = b * 6.2832;
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    return [co * 0.15, -0.02 + (a - 0.5) * 0.2, -0.12 + si * 0.1, 0.5, 0];
  }

  function radarPole(a, b) {
    var ang = b * 6.2832;
    var y = -0.12 + a * (-0.78 + 0.12);
    return [Math.cos(ang) * 0.075, y, -0.08 + Math.sin(ang) * 0.075, 0.4, 0];
  }

  function radarBase(a, b) {
    var ang = b * 6.2832;
    var rho = Math.sqrt(a) * 0.3;
    return [
      Math.cos(ang) * rho,
      -0.8,
      -0.08 + Math.sin(ang) * rho * 0.55,
      rho > 0.22 ? 0.64 : 0.44,
      0
    ];
  }

  function radarPoint(f, a, b, c) {
    if (f < 0.4) return radarFace(a, b);
    if (f < 0.54) return radarRim(a, b);
    if (f < 0.6) return radarBack(a, b);
    if (f < 0.72) return radarArm(a, b);
    if (f < 0.86) return radarLnb(a, b, c);
    if (f < 0.9) return radarHub(a, b);
    if (f < 0.95) return radarPole(a, b);
    return radarBase(a, b);
  }

  /* Open eye. The pupil is empty, so it stays the page's own dark.
     Lids are gold volumes. No lashes: a row of beads would read as a line. */
  var EYE_R = 0.62;
  var EYE_IRIS = 0.3;
  var EYE_PUPIL = 0.145;
  var EYE_HALF = 0.98;
  var EYE_LIT = [-0.32, 0.58, 0.75];

  function eyeShade(nx, ny, nz) {
    var d = nx * EYE_LIT[0] + ny * EYE_LIT[1] + nz * EYE_LIT[2];
    if (d < 0) d = 0;
    return 0.3 + 0.3 * d * d;
  }

  function eyeFissure(x) {
    var u = x / EYE_HALF;
    if (u < -1) u = -1;
    if (u > 1) u = 1;
    var w = Math.sqrt(1 - u * u);
    var tilt = -0.028 * u;
    return { hi: tilt + 0.05 + 0.4 * w, lo: tilt - 0.035 - 0.34 * w };
  }

  function eyeSurfaceZ(x, y) {
    var r2 = x * x + y * y;
    var cap = EYE_R * EYE_R * 0.985;
    if (r2 < cap) return Math.sqrt(cap - r2);
    return Math.max(-0.06, 0.06 - (r2 - cap) * 0.5);
  }

  function eyeSclera(id, a, b) {
    var x;
    var y;
    var r;
    var f;
    var k;
    var u;
    var v;
    var ok = false;
    for (k = 0; k < 8; k++) {
      u = mix01(id ^ (0x51ed270b + k * 0x9e3779b9));
      v = mix01(id ^ (0x6c8e9cf5 + k * 0x7f4a7c15));
      x = (u - 0.5) * 2 * EYE_R * 0.96;
      f = eyeFissure(x);
      y = f.lo + v * (f.hi - f.lo);
      r = Math.sqrt(x * x + y * y);
      if (r > EYE_IRIS + 0.02 && r < EYE_R * 0.98) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      x = (b < 0.5 ? -1 : 1) * (EYE_IRIS + 0.06 + a * (EYE_R * 0.9 - EYE_IRIS));
      y = (a - 0.5) * 0.16;
      r = Math.sqrt(x * x + y * y);
    }
    var z = Math.sqrt(Math.max(0.008, EYE_R * EYE_R - Math.min(r * r, EYE_R * EYE_R * 0.96)));
    return [x * 0.985, y * 0.985, z * 0.985, eyeShade(x / EYE_R, y / EYE_R, z / EYE_R), 0];
  }

  function eyeIris(a, b) {
    var ang = b * 6.2832;
    var rho = Math.sqrt(EYE_PUPIL * EYE_PUPIL + a * (EYE_IRIS * EYE_IRIS - EYE_PUPIL * EYE_PUPIL));
    var x = Math.cos(ang) * rho;
    var y = Math.sin(ang) * rho;
    var z = Math.sqrt(Math.max(0.01, EYE_R * EYE_R - rho * rho)) + 0.02;
    var t = (rho - EYE_PUPIL) / (EYE_IRIS - EYE_PUPIL);
    var band = Math.exp(-Math.pow((t - 0.42) / 0.28, 2));
    var e = 0.78 + 0.16 * band + 0.025 * Math.sin(ang * 2 + t * 4);
    if (e > 0.97) e = 0.97;
    return [x, y, z, e, 0];
  }

  function eyeGlint(a, b) {
    var ang = a * 6.2832;
    var rho = 0.04 * Math.sqrt(b);
    var x = -0.14 + Math.cos(ang) * rho;
    var y = 0.1 + Math.sin(ang) * rho;
    var z = Math.sqrt(Math.max(0.01, EYE_R * EYE_R - x * x - y * y)) + 0.05;
    return [x, y, z, 0.99, 0.85];
  }

  function eyeUpper(a, b, c) {
    var x = (a - 0.5) * 2 * EYE_HALF;
    var f = eyeFissure(x);
    var taper = Math.min(1, (f.hi - f.lo) / 0.6);
    var rise = (0.06 + 0.22 * taper) * b;
    var y = f.hi + rise;
    var skin = 0.02 + c * (0.045 + 0.05 * (1 - b));
    var z = eyeSurfaceZ(x, f.hi + rise * 0.25) + skin;
    return [x, y, z, 0.36 + 0.22 * c * (1 - 0.4 * b), 0];
  }

  function eyeLower(a, b, c) {
    var x = (a - 0.5) * 2 * EYE_HALF;
    var f = eyeFissure(x);
    var taper = Math.min(1, (f.hi - f.lo) / 0.6);
    var drop = (0.04 + 0.13 * taper) * b;
    var y = f.lo - drop;
    var z = eyeSurfaceZ(x, f.lo - drop * 0.2) + 0.015 + c * 0.055;
    return [x, y, z, 0.34 + 0.2 * c * (1 - 0.35 * b), 0];
  }

  function eyePoint(f, a, b, c, id) {
    if (f < 0.38) return eyeSclera(id, a, b);
    if (f < 0.66) return eyeIris(a, b);
    if (f < 0.69) return eyeGlint(a, b);
    if (f < 0.88) return eyeUpper(a, b, c);
    return eyeLower(a, b, c);
  }

  /* Frontal skull: one shell. Orbits, nasal aperture and mouth are
     holes through it. The mouth is an opening, with no rim of beads. */
  function skullEyeM(x, y) {
    var sx = Math.abs(x) - 0.22;
    var sy = y - 0.14;
    return (sx * sx) / (0.16 * 0.16) + (sy * sy) / (0.18 * 0.18);
  }

  function skullNoseM(x, y) {
    var y0 = -0.22;
    var y1 = 0.00;
    var t;
    var half;
    if (y < y0 || y > y1) return 4;
    t = (y - y0) / (y1 - y0);
    half = 0.038 + 0.08 * (1 - t) * (1 - t);
    return (x * x) / (half * half) + Math.pow((t - 0.42) / 0.58, 2);
  }

  function skullMouthM(x, y) {
    var dx = x / 0.20;
    var dy = (y + 0.40) / 0.13;
    return dx * dx + dy * dy;
  }

  function skullWarp(dir, b) {
    var t;
    var px = dir[0] * 0.62;
    var py = dir[1] * 0.70 + 0.04;
    var pz = dir[2] * 0.50;
    var cheek;
    var brow;
    var shell = 0.90 + 0.10 * b;
    if (dir[1] < -0.15) {
      t = clamp01((-0.15 - dir[1]) / 0.85);
      px *= 1 - 0.34 * t * t;
      py -= 0.16 * t;
      if (pz > 0) pz += 0.08 * t;
    }
    brow = Math.exp(-Math.pow((py - 0.36) / 0.09, 2)) * Math.exp(-Math.pow(px / 0.40, 2));
    if (pz > 0) pz += 0.05 * brow;
    cheek = Math.exp(-Math.pow((py + 0.02) / 0.14, 2)) * Math.exp(-Math.pow((Math.abs(px) - 0.32) / 0.16, 2));
    if (pz > -0.02) {
      px += (px < 0 ? -1 : 1) * 0.05 * cheek;
      pz += 0.05 * cheek;
    }
    return [px * shell, py * shell, pz * shell];
  }

  function skullPoint(id, b) {
    var dir;
    var p;
    var k;
    var e;
    var glow;
    var eye;
    var nose;
    for (k = 0; k < 14; k++) {
      dir = vNorm(gauss3(id ^ (0xa5b4c3d1 + k * 0x9e3779b9)));
      if (dir[2] < -0.05 && mix01(id ^ (0x6a09e667 + k * 0x9e3779b9)) < 0.58) continue;
      p = skullWarp(dir, b);
      eye = skullEyeM(p[0], p[1]);
      nose = skullNoseM(p[0], p[1]);
      if (eye < 1 || nose < 1 || skullMouthM(p[0], p[1]) < 1) continue;
      e = 0.32 + 0.58 * clamp01(p[2] / 0.42);
      glow = 0;
      if (eye < 1.38 && p[2] > 0) {
        e = 0.96;
        glow = 0.28;
      } else if (nose < 1.45 && p[2] > 0.04) {
        e = 0.86;
      } else if (p[1] > 0.40 && p[2] > 0.16) {
        e = Math.max(e, 0.82);
        glow = 0.1;
      }
      return [p[0], p[1], p[2], e, glow];
    }
    return [0, 0.62, 0.22, 0.8, 0];
  }

  /* Stethoscope. Diaphragm, one rubber hose, two ear hooks.
     Every tube is a filled volume; the rim is a fat torus, not a wire. */
  var STETH_R = 0.36;
  var STETH_CY = -0.50;
  var STETH_LIT = [-0.28, 0.46, 0.84];
  var STETH_HOSE = [[0.03, -0.22, 0.02], [0.12, -0.04, 0.05], [0, 0.12, 0.04]];

  function stethShade(nx, ny, nz) {
    var d = nx * STETH_LIT[0] + ny * STETH_LIT[1] + nz * STETH_LIT[2];
    if (d < 0) d = 0;
    return 0.30 + 0.55 * d * d;
  }

  function stethArm(side) {
    return [
      [0, 0.08, 0.04],
      [side * 0.52, 0.38, 0.06],
      [side * 1.02, 0.62, 0.10],
      [side * 0.40, 0.82, 0.30]
    ];
  }

  function stethFrame(P, s) {
    var m = 1 - s;
    var m2 = m * m;
    var s2 = s * s;
    var k0 = m2 * m;
    var k1 = 3 * m2 * s;
    var k2 = 3 * m * s2;
    var k3 = s * s2;
    var tan = vNorm([
      3 * m2 * (P[1][0] - P[0][0]) + 6 * m * s * (P[2][0] - P[1][0]) + 3 * s2 * (P[3][0] - P[2][0]),
      3 * m2 * (P[1][1] - P[0][1]) + 6 * m * s * (P[2][1] - P[1][1]) + 3 * s2 * (P[3][1] - P[2][1]),
      3 * m2 * (P[1][2] - P[0][2]) + 6 * m * s * (P[2][2] - P[1][2]) + 3 * s2 * (P[3][2] - P[2][2])
    ]);
    var nrm = vNorm(vCross(tan, Math.abs(tan[1]) > 0.85 ? [1, 0, 0] : [0, 1, 0]));
    return {
      c: [
        k0 * P[0][0] + k1 * P[1][0] + k2 * P[2][0] + k3 * P[3][0],
        k0 * P[0][1] + k1 * P[1][1] + k2 * P[2][1] + k3 * P[3][1],
        k0 * P[0][2] + k1 * P[1][2] + k2 * P[2][2] + k3 * P[3][2]
      ],
      tan: tan,
      nrm: nrm,
      bin: vCross(tan, nrm)
    };
  }

  function stethFill(frame, rad, ang) {
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var nx = co * frame.nrm[0] + si * frame.bin[0];
    var ny = co * frame.nrm[1] + si * frame.bin[1];
    var nz = co * frame.nrm[2] + si * frame.bin[2];
    return [
      frame.c[0] + rad * nx,
      frame.c[1] + rad * ny,
      frame.c[2] + rad * nz,
      nx, ny, nz
    ];
  }

  function stethChest(a, b, c) {
    var ang = b * 6.2832;
    var co = Math.cos(ang);
    var si = Math.sin(ang);
    var rho;
    var z;
    var tube;
    var pol;
    if (c < 0.68) {
      rho = (STETH_R - 0.03) * Math.sqrt(a);
      z = 0.05 + 0.035 * (1 - rho / STETH_R);
      return [co * rho, STETH_CY + si * rho, z, 0.40 + 0.24 * (rho / STETH_R), 0];
    }
    if (c < 0.88) {
      pol = a * 6.2832;
      tube = 0.072 * (0.42 + 0.58 * Math.sqrt((c - 0.68) / 0.2));
      rho = STETH_R + Math.cos(pol) * tube;
      z = Math.sin(pol) * tube * 0.85;
      return [co * rho, STETH_CY + si * rho, z, z > 0 ? 0.94 : 0.78, z > 0 ? 0.2 : 0];
    }
    rho = STETH_R * 0.9 * Math.sqrt(a);
    z = -0.055 - 0.03 * (1 - rho / STETH_R);
    return [co * rho, STETH_CY + si * rho, z, 0.34, 0];
  }

  function stethHose(a, b, c) {
    var p = tubeAt(STETH_HOSE, a, 0.14 * Math.sqrt(c), b * 6.2832);
    return [p[0], p[1], p[2], 0.44, 0];
  }

  function stethYoke(a, b, c) {
    var ang = b * 6.2832;
    var rho = Math.sqrt(c) * 0.18;
    return [
      Math.cos(ang) * rho,
      0.10 + (a - 0.5) * 0.10,
      0.045 + Math.sin(ang) * rho * 0.82,
      rho > 0.11 ? 0.92 : 0.74,
      rho > 0.11 ? 0.16 : 0
    ];
  }

  function stethBinaural(side, a, b, c) {
    var frame = stethFrame(stethArm(side), a);
    var p = stethFill(frame, 0.125 * Math.sqrt(c), b * 6.2832);
    var e = Math.max(0.58, stethShade(p[3], p[4], p[5]));
    return [p[0], p[1], p[2], e, e > 0.72 ? 0.14 : 0];
  }

  function stethOlive(side, a, b, c) {
    var frame = stethFrame(stethArm(side), 1);
    var along = (a - 0.5) * 2;
    var rad = Math.sqrt(Math.max(0, 1 - along * along)) * 0.18 * Math.sqrt(c);
    var p = stethFill(frame, rad, b * 6.2832);
    var shift = along * 0.16;
    return [
      p[0] + frame.tan[0] * shift,
      p[1] + frame.tan[1] * shift,
      p[2] + frame.tan[2] * shift,
      0.97,
      0.38
    ];
  }

  function stethPoint(f, a, b, c) {
    var side = a < 0.5 ? -1 : 1;
    var u = a < 0.5 ? a * 2 : (a - 0.5) * 2;
    if (f < 0.36) return stethChest(a, b, c);
    if (f < 0.50) return stethHose(a, b, c);
    if (f < 0.56) return stethYoke(a, b, c);
    if (f < 0.86) return stethBinaural(side, u, b, c);
    return stethOlive(side, u, b, c);
  }

  function extraPoint(kind, id, seed, a, b, c) {
    var f = mix01(id ^ 0x0badf00d);
    var g = gauss3(id);
    var dir = vNorm(g);
    var out = {};
    var e = -1;
    var p;
    var k;
    var s;
    var u;
    var rr;
    var o;
    var lat;
    var lon;
    var found;
    var cell;
    var n;
    var sy;
    var rx;
    var rz;
    var ang;
    if (kind === 'scan') {
      /* Axial slices of a head: skull, folded cortex, ventricles, orbits. */
      k = Math.floor(a * SCAN_SLICES);
      sy = -0.62 + k * 1.3 / (SCAN_SLICES - 1);
      ang = b * 6.2832;
      o = [0, 0];
      u = 0;
      if (sy < -0.34) {
        if (c < 0.2) {
          rx = 0.05;
          rz = 0.05;
          o = [0, -0.22];
        } else {
          rx = 0.16;
          rz = 0.17;
          o = [0, -0.12];
        }
      } else {
        /* Each slice spans front F to back B, width W: forehead, a flat
           face, the occiput, and a jaw that narrows toward the chin. */
        rr = Math.max(0.05, 1 - Math.pow((sy - 0.12) / 0.62, 2));
        s = sy > 0.05 ? 0.5 * Math.sqrt(rr) : 0.47;
        rx = Math.max(0.2, 1 - Math.pow((sy - 0.18) / 0.56, 2));
        rx = 0.6 * Math.sqrt(rx) * (sy < -0.05 ? 1 + (sy + 0.05) * 1.6 : 1);
        o = [0, (s - rx) * 0.5];
        rz = (s + rx) * 0.5;
        rx = 0.44 * Math.sqrt(Math.max(0.05, 1 - Math.pow((sy - 0.14) / 0.6, 2))) * (sy < 0 ? 1 + sy * 0.9 : 1);
        if (c < 0.4) {
          /* Brow, nose, lips and chin push the front of the skull out. */
          u = (0.05 * Math.exp(-Math.pow((sy - 0.1) / 0.04, 2)) +
            0.24 * Math.exp(-Math.pow((sy + 0.06) / 0.06, 2)) +
            0.035 * Math.exp(-Math.pow((sy + 0.2) / 0.03, 2)) +
            0.06 * Math.exp(-Math.pow((sy + 0.3) / 0.04, 2))) *
            Math.exp(-Math.pow((ang - 1.5708) / 0.24, 2));
        } else if (c < 0.6 && sy > -0.12) {
          rr = 0.86 * (1 + 0.05 * Math.sin(ang * 11 + k * 1.7));
          rx *= rr;
          rz *= rr;
        } else if (c < 0.76 && sy > -0.05) {
          rr = 0.58 * (1 + 0.09 * Math.sin(ang * 7 + k));
          rx *= rr;
          rz *= rr;
        } else if (c < 0.84 && sy > 0.05 && sy < 0.4) {
          o = [c < 0.8 ? -0.075 : 0.075, o[1]];
          rx = 0.04;
          rz = 0.15;
        } else if (c < 0.92 && sy > -0.08 && sy < 0.08) {
          o = [c < 0.88 ? -0.17 : 0.17, o[1] + rz - 0.1];
          rx = 0.06;
          rz = 0.06;
        }
      }
      p = [o[0] + Math.cos(ang) * rx, sy, o[1] + Math.sin(ang) * rz + u];
      out.mv = 'scan';
    } else if (kind === 'lungs') {
      o = perSeed('lungs', seed, lungTree);
      p = f < 0.58 ? treePoint(o, a, b, g) : leafPoint(o, a, g, 0.05);
      p[1] -= 0.15;
    } else if (kind === 'blood') {
      if (f < 0.22) {
        u = (Math.floor(a * 29) + 0.5) / 29 * 2.9 - 1.45;
        ang = b * 6.2832;
        p = [u, Math.cos(ang) * 0.44, Math.sin(ang) * 0.44];
        e = 0.3;
      } else {
        k = Math.floor(a * BLOOD_CELLS);
        cell = perSeed('blood', seed, bloodCells)[k];
        if (cell.wbc) {
          rr = 0.12 * (1 + 0.16 * Math.sin(dir[0] * 11) * Math.sin(dir[1] * 9) * Math.sin(dir[2] * 7));
          o = [dir[0] * rr, dir[1] * rr, dir[2] * rr];
        } else {
          /* Red cell as a torus: the biconcave dip reads as the hole. */
          ang = b * 6.2832;
          s = c * 6.2832;
          rr = 0.11 + 0.042 * Math.cos(s);
          o = [rr * Math.cos(ang), 0.04 * Math.sin(s), rr * Math.sin(ang)];
        }
        p = [cell.x0 + o[0], cell.y + o[1], cell.z + o[2]];
        out = { mv: 'blood', ci: k, lx: o[0], ly: o[1], lz: o[2] };
      }
    } else if (kind === 'neuron') {
      o = perSeed('neuron', seed, neuronParts);
      if (f < 0.14) {
        rr = 0.14 * (1 + 0.1 * Math.sin(dir[0] * 9 + seed) * Math.cos(dir[1] * 7));
        p = shell(NEURON_SOMA, rr, dir);
      } else if (f < 0.48) {
        p = treePoint(o.dend, a, b, g);
      } else if (f < 0.78) {
        /* Myelin sheath with narrow nodes between segments. */
        p = axonAt(a, seed);
        u = (a * 1.75) % 0.2;
        rr = u < 0.03 || a < 0.05 ? 0.014 : 0.042;
        ang = b * 6.2832;
        p[1] += Math.cos(ang) * rr;
        p[2] += Math.sin(ang) * rr;
      } else if (f < 0.93) {
        p = c < 0.5 ? treePoint(o.term, a, b, g) : leafPoint(o.term, a, g, 0.022);
      } else {
        u = Math.floor(a * 3) / 3 + b * 0.035;
        p = axonAt(u, seed);
        out = { mv: 'signal', u0: u };
      }
    } else if (kind === 'globe') {
      found = false;
      if (f < 0.6) {
        for (k = 0; k < 14; k++) {
          lat = Math.asin(mix01(id ^ (0x7a3d1f5b + k * 0x9e3779b9)) * 2 - 1) * 57.2958;
          lon = mix01(id ^ (0x3b9ac9ff + k * 0x7f4a7c15)) * 360 - 180;
          if (isLand(lat, lon)) {
            found = true;
            break;
          }
        }
      }
      rr = 0.95;
      if (f >= 0.84) {
        /* A bright patch per city on the surface: its spread is the metric. */
        k = Math.floor(a * GLOBE_CITIES.length);
        o = GLOBE_CITIES[k];
        s = o[2] * (0.75 + 0.5 * mix01(Math.imul(seed + 1, 0x27d4eb2f) ^ k)) * 3.2;
        lat = o[0] + g[0] * s;
        lon = o[1] + g[1] * s / Math.max(0.3, Math.cos(o[0] / 57.2958));
        e = 0.85;
      } else if (found) {
        e = 0.55;
      } else {
        lat = Math.asin(a * 2 - 1) * 57.2958;
        lon = b * 360 - 180;
        e = 0.12;
      }
      lat /= 57.2958;
      lon /= 57.2958;
      p = [Math.cos(lat) * Math.sin(lon) * rr, Math.sin(lat) * rr, Math.cos(lat) * Math.cos(lon) * rr];
    } else if (kind === 'planning') {
      /* Lane edges and dashes, ego car, two other cars, and a fan of
         candidate paths; the chosen one follows the lane. */
      if (f < 0.26) out = { pc: 0, u: Math.floor(a * 52) / 52, side: b < 0.5 ? 1 : -1 };
      else if (f < 0.34) out = { pc: 1, u: a };
      else if (f < 0.4) out = { pc: 2, u: a };
      else if (f < 0.5) out = { pc: 3, u: a, car: b < 0.5 ? 0 : 1, top: c < 0.4 };
      else if (f < 0.62) out = { pc: 4, u: (Math.floor(a * 40) + 0.5) / 40, off: 0 };
      else out = { pc: 4, u: (Math.floor(a * 40) + 0.5) / 40, off: (Math.floor(b * 10) - 4.5) * 0.14 };
      out.mv = 'planning';
      p = planningAt(out, seed, 0);
      e = out.pc === 0 ? 0.45 : out.pc === 4 && out.off ? 0.34 : -1;
    } else if (kind === 'neural') {
      if (f < 0.72) {
        u = a * NEURAL_TOTAL;
        for (k = 0; k < NEURAL_LAYERS.length - 1 && u >= NEURAL_LAYERS[k][0] * NEURAL_LAYERS[k][1]; k++) {
          u -= NEURAL_LAYERS[k][0] * NEURAL_LAYERS[k][1];
        }
        n = Math.floor(u);
        o = neuralNode(k, n);
        p = [o[0] + g[0] * 0.018, o[1] + g[1] * 0.018, o[2] + g[2] * 0.018];
        e = k === NEURAL_LAYERS.length - 1 && n === 2 ? 1
          : 0.3 + 0.6 * mix01(Math.imul(seed + 7, 0x9e3779b1) ^ Math.imul(k + 1, 97) ^ n);
      } else {
        k = Math.floor(a * (NEURAL_LAYERS.length - 1));
        out = {
          mv: 'neural', L: k,
          i: Math.floor(b * NEURAL_LAYERS[k][0] * NEURAL_LAYERS[k][1]),
          j: Math.floor(c * NEURAL_LAYERS[k + 1][0] * NEURAL_LAYERS[k + 1][1]),
          ph: mix01(id ^ 0x13c6ef37)
        };
        p = neuralNode(k, out.i);
      }
    } else if (kind === 'satellites') {
      if (f < 0.45) {
        p = shell([0, 0, 0], 0.32, dir);
        e = isLand(Math.asin(dir[1]) * 57.2958, Math.atan2(dir[0], dir[2]) * 57.2958) ? 0.6 : 0.22;
      } else {
        u = b * SAT_TOTAL;
        for (k = 0; k < SAT_SHELLS.length - 1 && u >= SAT_SHELLS[k][3]; k++) u -= SAT_SHELLS[k][3];
        out = {
          mv: 'sat', sh: k, k: Math.floor(u), lag: c < 0.3 ? 0.02 + c * 0.25 : 0,
          lx: g[0] * 0.01, ly: g[1] * 0.01, lz: g[2] * 0.01
        };
        p = satAt(out, 0);
      }
    } else if (kind === 'voxels') {
      /* Occupancy voxels as dot lattices: corners and edge midpoints. */
      o = perSeed('voxels', seed, voxelScene);
      n = o[Math.floor(a * o.length)];
      u = VOXEL_LATTICE[Math.floor(b * VOXEL_LATTICE.length)];
      p = [n[0] + u[0] * 0.03, n[1] + u[1] * 0.03, n[2] + u[2] * 0.03];
      e = n[3] ? 1 : 0.95 - 0.6 * clamp01(Math.sqrt(Math.pow(n[0] - VOXEL_EGO[0], 2) + Math.pow(n[2] - VOXEL_EGO[1], 2)) / 1.6);
    } else if (kind === 'wafer') {
      if (f < 0.1) {
        ang = -1.45 + a * 6.0;
        p = [Math.cos(ang) * WAFER_R, 0, Math.sin(ang) * WAFER_R];
        e = 0.5;
      } else if (f < 0.72) {
        o = WAFER_DIES[Math.floor(a * WAFER_DIES.length)];
        p = [o[0] + ((Math.floor(b * 6) + 0.5) / 6 - 0.5) * WAFER_DIE, 0, o[1] + ((Math.floor(c * 6) + 0.5) / 6 - 0.5) * WAFER_DIE];
        e = 0.35;
      } else {
        /* The lifted die: I/O ring, four cores, a cache block. */
        if (c < 0.25) {
          u = a * 4;
          s = Math.floor(u * 11) / 11 - Math.floor(u);
          o = [u < 1 ? s * 2 - 1 : u < 2 ? 1 : u < 3 ? 1 - s * 2 : -1, u < 1 ? -1 : u < 2 ? s * 2 - 1 : u < 3 ? 1 : 1 - s * 2];
          o = [o[0] * 0.45, o[1] * 0.45];
          e = 0.7;
        } else if (c < 0.7) {
          k = Math.floor(b * 4);
          o = [-0.3 + (k % 2) * 0.24 + (Math.floor(a * 7) / 6 - 0.5) * 0.18,
            -0.2 + Math.floor(k / 2) * 0.3 + (Math.floor(d7(id) * 7) / 6 - 0.5) * 0.2];
          e = 0.85;
        } else {
          o = [0.2 + (Math.floor(a * 6) / 5) * 0.2, (Math.floor(b * 14) / 13 - 0.5) * 0.8];
          e = 0.6;
        }
        out = { mv: 'wafer', ux: o[0], uz: o[1] };
        p = waferDieAt(out, 0);
      }
    } else if (kind === 'datacenter') {
      if (f < 0.74) {
        k = Math.floor(a * DC_ROWS.length * DC_RACKS);
        o = [-1.1 + (k % DC_RACKS) * 0.22, DC_ROWS[Math.floor(k / DC_RACKS)]];
        s = Math.floor(k / DC_RACKS) % 2 ? -1 : 1;
        if (c < 0.7) {
          /* Front face: server units as rows of status dots. */
          u = Math.floor(d7(id) * 14);
          p = [o[0] + ((Math.floor(b * 3) + 0.5) / 3 - 0.5) * 0.15, DC_GROUND + (u + 0.5) / 14 * DC_H, o[1] + s * 0.07];
          e = 0.35 + 0.6 * mix01(Math.imul(k + 1, 0x2c1b3c6d) ^ Math.imul(u + 1, 0x297a2d39));
        } else {
          u = b * 4;
          rr = u - Math.floor(u);
          p = [o[0] + (u < 1 ? rr * 2 - 1 : u < 2 ? 1 : u < 3 ? 1 - rr * 2 : -1) * 0.09, DC_GROUND + DC_H,
            o[1] + (u < 1 ? -1 : u < 2 ? rr * 2 - 1 : u < 3 ? 1 : 1 - rr * 2) * 0.07];
        }
      } else {
        /* Packets: along the aisles at floor level and the overhead trays. */
        k = Math.floor(a * 6);
        s = b < 0.5 ? 1 : -1;
        out = {
          mv: 'traffic', ax: 0, L: 1.25, lit: true, glow: 0.7,
          lane: k < 3 ? [-0.41, 0, 0.41][k] + s * 0.02 : DC_ROWS[k - 2 > 3 ? 3 : k - 2],
          u0: (c * 2 - 1) * 1.25, spd: s * (0.0003 + d7(id) * 0.0003)
        };
        p = [out.u0, k < 3 ? DC_GROUND + 0.02 : DC_GROUND + DC_H + 0.09, out.lane];
      }
    } else if (kind === 'molar') {
      /* Extracted molar: enamel crown, four cusps, two diverging roots. */
      if (f < 0.36) o = molarCrown(id, b);
      else if (f < 0.52) o = molarCusp(id, Math.floor(a * 4) % 4, b);
      else o = molarRoot(f < 0.76 ? 0 : 1, a, b * 6.2832, c);
      p = [o[0], o[1], o[2]];
      e = o[3];
      if (o[4]) out.glow = o[4];
    } else if (kind === 'mri') {
      /* Scanner: thick gantry, open bore, and the couch running out of it. */
      if (f < 0.28) o = mriFace(MRI_FRONT, b, c, true);
      else if (f < 0.36) o = mriFace(MRI_BACK, b, c, false);
      else if (f < 0.48) o = mriWall(true, b, c);
      else if (f < 0.58) o = mriWall(false, b, c);
      else o = mriCouch(a, b, c);
      p = [o[0], o[1], o[2]];
      e = o[3];
      if (o[4]) out.glow = o[4];
    } else if (kind === 'flask') {
      /* Conical flask, half full. The neck is only its side walls, so the mouth stays open. */
      o = flaskPoint(f, a, b, c);
      p = [o[0], o[1], o[2]];
      e = o[3];
    } else if (kind === 'microscope') {
      /* Binocular head, objective gap, and the stage aperture. */
      o = scopePoint(f, a, b, c);
      p = [o[0], o[1], o[2]];
      e = o[3];
      if (o[4]) out.glow = o[4];
    } else if (kind === 'syringe') {
      o = syrPoint(f, a, b, c);
      p = [o[0], o[1], o[2]];
      e = o[3];
      if (o[4]) out.glow = o[4];
    } else if (kind === 'rocket') {
      if (f < 0.9) {
        o = rocketPoint(f, a, b, c);
        p = [o[0], o[1], o[2]];
        e = o[3];
        if (o[4]) out.glow = o[4];
      } else {
        o = rocketPlume(a, b, c);
        out.mv = 'plume';
        out.u0 = o.u0;
        out.ang = o.ang;
        out.rad = o.rad;
        out.spd = o.spd;
        out.glow = o.glow;
        p = [o.x, o.y, o.z];
        e = o.e;
      }
    } else if (kind === 'radar') {
      o = radarPoint(f, a, b, c);
      p = [o[0], o[1], o[2]];
      e = o[3];
      if (o[4]) out.glow = o[4];
    } else if (kind === 'eye') {
      o = eyePoint(f, a, b, c, id);
      p = [o[0], o[1], o[2]];
      e = o[3];
      if (o[4]) out.glow = o[4];
    } else if (kind === 'skull') {
      o = skullPoint(id, b);
      p = [o[0], o[1], o[2]];
      e = o[3];
      if (o[4]) out.glow = o[4];
    } else if (kind === 'stethoscope') {
      o = stethPoint(f, a, b, c);
      p = [o[0], o[1], o[2]];
      e = o[3];
      if (o[4]) out.glow = o[4];
    } else if (kind === 'molecule') {
      o = pickAcc(MOLECULE.atoms, a * MOLECULE.total);
      p = shell([o.x, o.y, o.z], o.r, dir);
      e = o.e;
    } else {
      if (f < 0.5) {
        /* Ventricles: ellipsoid tapering to an apex that points down-left. */
        o = [dir[0] * 0.5, dir[1] * 0.62, dir[2] * 0.42];
        if (o[1] < 0) {
          s = 1 + 0.6 * o[1] / 0.62;
          o[0] *= s;
          o[2] *= s;
        }
        p = [o[0] * 0.9 - o[1] * 0.435 + 0.05, o[0] * 0.435 + o[1] * 0.9 - 0.12, o[2]];
      } else if (f < 0.6) {
        p = shell(HEART_RA, HEART_RA[3], dir);
      } else if (f < 0.68) {
        p = shell(HEART_LA, HEART_LA[3], dir);
      } else if (f < 0.82) {
        p = tubeAt(HEART_AORTA, a, 0.1, b * 6.2832);
      } else if (f < 0.87) {
        o = tubeAt(HEART_AORTA, 0.4 + Math.floor(a * 3) * 0.1, 0, 0);
        ang = b * 6.2832;
        p = [o[0] + Math.cos(ang) * 0.035, o[1] + c * 0.24, o[2] + Math.sin(ang) * 0.035];
      } else if (f < 0.95) {
        p = tubeAt(HEART_PULM, a, 0.085, b * 6.2832);
      } else {
        p = tubeAt(HEART_SVC, a, 0.075, b * 6.2832);
      }
      p[1] -= 0.05;
    }
    out.x = p[0];
    out.y = p[1];
    out.z = p[2];
    out.e = e;
    out.th = -9;
    out.r = clamp01(Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) / 1.3);
    return out;
  }

  function wrapSpan(v, L) {
    v = (v + L) % (2 * L);
    if (v < 0) v += 2 * L;
    return v - L;
  }

  function heartBeat(t) {
    var ph = (t % 1000) / 1000;
    return Math.exp(-Math.pow((ph - 0.12) / 0.05, 2)) + 0.55 * Math.exp(-Math.pow((ph - 0.34) / 0.05, 2));
  }

  /* ---- Advanced technology set. */

  var NEURAL_LAYERS = [[6, 6], [8, 8], [8, 8], [6, 6], [4, 1]];
  var NEURAL_TOTAL = NEURAL_LAYERS.reduce(function (s, l) { return s + l[0] * l[1]; }, 0);
  /* radius, inclination, node, satellite count */
  var SAT_SHELLS = [[0.55, 0.3, 0, 22], [0.72, 0.95, 1.2, 28], [0.92, 1.45, 2.3, 34], [1.12, 0.55, 3.6, 40]];
  var SAT_TOTAL = SAT_SHELLS.reduce(function (s, l) { return s + l[3]; }, 0);
  var WAFER_R = 1.0;
  var WAFER_DIE = 0.15;
  var WAFER_LIFT = [0.165, 0];
  var WAFER_DIES = (function () {
    var list = [];
    var ix;
    var iz;
    var cx;
    var cz;
    var h = WAFER_DIE / 2;
    for (ix = -7; ix <= 7; ix++) {
      for (iz = -7; iz <= 7; iz++) {
        cx = ix * 0.165;
        cz = iz * 0.165;
        if (Math.sqrt(Math.pow(Math.abs(cx) + h, 2) + Math.pow(Math.abs(cz) + h, 2)) > WAFER_R - 0.02) continue;
        if (cx === WAFER_LIFT[0] && cz === WAFER_LIFT[1]) continue;
        list.push([cx, cz]);
      }
    }
    return list;
  })();
  var DC_ROWS = [-0.6, -0.22, 0.22, 0.6];
  var DC_RACKS = 11;
  var DC_GROUND = -0.3;
  var DC_H = 0.46;
  var VOXEL_SIZE = 0.085;
  var VOXEL_EGO = [-0.6, -0.13];
  var VOXEL_LATTICE = (function () {
    var pts = [];
    var x;
    var y;
    var z;
    for (x = -1; x <= 1; x++) {
      for (y = -1; y <= 1; y++) {
        for (z = -1; z <= 1; z++) {
          if (Math.abs(x) + Math.abs(y) + Math.abs(z) === 3) pts.push([x, y, z]);
        }
      }
    }
    return pts;
  })();

  function d7(id) {
    return mix01(id ^ 0x7b1d4c2e);
  }

  function roadZ(x, seed, t) {
    return 0.28 * Math.sin(x * 1.3 + seed * 1.7 + t * 0.00035);
  }

  function planningAt(sp, seed, t) {
    var x0 = -0.95;
    var x;
    var s;
    var m;
    var q;
    var v;
    if (sp.pc === 0) {
      x = -1.3 + 2.6 * sp.u;
      return [x, 0, roadZ(x, seed, t) + sp.side * 0.3];
    }
    if (sp.pc === 1) {
      /* Dashes stream backward: the car is driving. */
      m = (-1.3 + 2.6 * sp.u + t * 0.0003) / 0.16;
      x = (Math.floor(m) + (m - Math.floor(m)) * 0.45) * 0.16 - t * 0.0003;
      x = wrapSpan(x, 1.3);
      return [x, 0, roadZ(x, seed, t)];
    }
    if (sp.pc === 2 || sp.pc === 3) {
      q = sp.u * 4;
      v = q - Math.floor(q);
      x = sp.pc === 2 ? x0 : 0.05 + sp.car * 0.65;
      s = sp.pc === 2 ? 0 : sp.car ? -0.15 : 0.15;
      return [
        x + (q < 1 ? v * 2 - 1 : q < 2 ? 1 : q < 3 ? 1 - v * 2 : -1) * 0.12,
        sp.top ? 0.07 : 0.005,
        roadZ(x, seed, t) + s + (q < 1 ? -1 : q < 2 ? v * 2 - 1 : q < 3 ? 1 : 1 - v * 2) * 0.06
      ];
    }
    x = x0 + (1.25 - x0) * sp.u;
    s = sp.u * sp.u * (3 - 2 * sp.u);
    return [x, 0.01, roadZ(x, seed, t) + sp.off * s];
  }

  function neuralNode(L, n) {
    var dims = NEURAL_LAYERS[L];
    var gap = L === NEURAL_LAYERS.length - 1 ? 0.16 : 0.085;
    return [
      -1.2 + L * 0.6,
      ((n % dims[0]) - (dims[0] - 1) / 2) * gap,
      (Math.floor(n / dims[0]) - (dims[1] - 1) / 2) * gap
    ];
  }

  function satAt(sp, t) {
    var sh = SAT_SHELLS[sp.sh];
    var th = sp.k / sh[3] * 6.2832 + t * 0.00045 * Math.pow(0.55 / sh[0], 1.5) - sp.lag;
    var x = sh[0] * Math.cos(th);
    var z = sh[0] * Math.sin(th);
    var y = -z * Math.sin(sh[1]);
    z *= Math.cos(sh[1]);
    return [
      x * Math.cos(sh[2]) + z * Math.sin(sh[2]) + sp.lx,
      y + sp.ly,
      -x * Math.sin(sh[2]) + z * Math.cos(sh[2]) + sp.lz
    ];
  }

  function waferDieAt(sp, t) {
    var up = fade(clamp01((t - 1200) / 2600));
    var sc = WAFER_DIE * (1 + 2.2 * up);
    return [WAFER_LIFT[0] + sp.ux * sc, 0.02 + 0.5 * up, WAFER_LIFT[1] + sp.uz * sc];
  }

  function voxelScene(seed) {
    var rnd = seededRng(seed, 53);
    var v = VOXEL_SIZE;
    var list = [];
    var i;
    var s;
    var h;
    var y;
    var k;
    function add(ix, iy, iz, ego) {
      list.push([ix * v, iy * v + v / 2 - 0.3, iz * v, ego]);
    }
    function block(ix, iz, lx, lz, ly, ego, y0) {
      var a;
      var b;
      var c;
      for (a = 0; a < lx; a++) for (b = 0; b < lz; b++) for (c = 0; c < ly; c++) add(ix + a, (y0 || 0) + c, iz + b, ego);
    }
    for (i = -14; i <= 14; i++) {
      for (s = -1; s <= 1; s += 2) {
        if (rnd() < 0.2) continue;
        h = 2 + Math.floor(rnd() * 5 * (1 - Math.abs(i) / 22));
        for (y = 0; y < h; y++) add(i, y, s * 6, 0);
      }
    }
    block(-8, -2, 3, 2, 1, 1);
    for (k = 0; k < 4; k++) block(-4 + k * 4 + Math.floor(rnd() * 2), k % 2 ? -2 : 1, 3, 2, 1, 0);
    for (k = 0; k < 4; k++) {
      i = -11 + k * 7;
      s = k % 2 ? 4 : -4;
      add(i, 0, s, 0);
      add(i, 1, s, 0);
      block(i - 1, s - 1, 3, 3, 1, 0, 2);
      add(i, 3, s, 0);
    }
    for (k = 0; k < 3; k++) {
      i = -6 + k * 6;
      add(i, 0, 5, 0);
      add(i, 1, 5, 0);
    }
    return list;
  }

  /* Live position for the few solids with moving parts. */
  function animatePoint(stage, sp) {
    var t = stage.time;
    var m;
    var s;
    var o;
    var cell;
    var ang;
    var x1;
    var y1;
    var co;
    var si;
    if (sp.mv === 'scan') {
      return { x: sp.x, y: sp.y, z: sp.z, e: sp.e, th: -9, r: sp.r, glow: clamp01(1 - Math.abs(sp.y - stage.scanY) / 0.09) };
    }
    if (sp.mv === 'traffic') {
      m = wrapSpan(sp.u0 + sp.spd * t, sp.L);
      return {
        x: sp.ax ? sp.lane : m, y: sp.y, z: sp.ax ? m : sp.lane, e: -1, th: -9, r: sp.r,
        lit: sp.lit, glow: sp.glow, fe: clamp01((sp.L - Math.abs(m)) / 0.2)
      };
    }
    if (sp.mv === 'signal') {
      s = sp.u0 + t * 0.00028;
      s -= Math.floor(s);
      o = axonAt(s, stage.seed);
      return { x: o[0], y: o[1], z: o[2], e: -1, th: -9, r: sp.r, glow: 1, fe: clamp01(Math.min(s, 1 - s) / 0.06) };
    }
    if (sp.mv === 'planning') {
      o = planningAt(sp, stage.seed, t);
      return {
        x: o[0], y: o[1], z: o[2], e: sp.e, th: -9, r: sp.r,
        glow: sp.pc === 4 && !sp.off ? 0.8 : 0, fe: clamp01((1.3 - Math.abs(o[0])) / 0.15)
      };
    }
    if (sp.mv === 'neural') {
      s = sp.ph + t * 0.0007;
      s -= Math.floor(s);
      o = neuralNode(sp.L, sp.i);
      m = neuralNode(sp.L + 1, sp.j);
      return {
        x: o[0] + (m[0] - o[0]) * s, y: o[1] + (m[1] - o[1]) * s, z: o[2] + (m[2] - o[2]) * s,
        e: -1, th: -9, r: sp.r, glow: 1, fe: clamp01(Math.min(s, 1 - s) / 0.12)
      };
    }
    if (sp.mv === 'sat') {
      o = satAt(sp, t);
      return { x: o[0], y: o[1], z: o[2], e: sp.lag ? 0.35 : -1, th: -9, r: sp.r, glow: sp.lag ? 0 : 0.6 };
    }
    if (sp.mv === 'wafer') {
      o = waferDieAt(sp, t);
      return { x: o[0], y: o[1], z: o[2], e: sp.e, th: -9, r: sp.r };
    }
    if (sp.mv === 'proj') {
      o = projLive(sp, stage.seed, t);
      o.th = -9;
      o.r = sp.r;
      return o;
    }
    if (sp.mv === 'plume') {
      s = sp.u0 + sp.spd * t;
      s -= Math.floor(s);
      o = rocketPlumeAt(s, sp.ang, sp.rad);
      return {
        x: o[0], y: o[1], z: o[2],
        e: s < 0.3 ? 0.95 : 0.52,
        th: -9, r: sp.r,
        glow: s < 0.28 ? 0.65 : 0,
        fe: clamp01(Math.min(s, 1 - s) / 0.14)
      };
    }
    if (sp.mv === 'blood') {
      cell = perSeed('blood', stage.seed, bloodCells)[sp.ci];
      m = wrapSpan(cell.x0 + cell.v * t, 1.45);
      ang = cell.tilt + cell.spin * t;
      co = Math.cos(ang);
      si = Math.sin(ang);
      x1 = sp.lx * co - sp.ly * si;
      y1 = sp.lx * si + sp.ly * co;
      co = Math.cos(cell.tilt * 0.7);
      si = Math.sin(cell.tilt * 0.7);
      return {
        x: m + x1, y: cell.y + y1 * co - sp.lz * si, z: cell.z + y1 * si + sp.lz * co,
        e: -1, th: -9, r: sp.r, fe: clamp01((1.45 - Math.abs(m)) / 0.25)
      };
    }
    return sp;
  }

  /* ---- Project set. Every point is live: projLive(t) places it, and the
     home is projLive(0), so the centring box matches the first frame. */

  var HEX_S = 0.105;
  var HEX_GROUND = -0.35;
  var RIBBONS = 5;
  var PIPE_NODE = [-0.28, 0, 0];
  var PIPE_SRC = [[-1.3, 0.42, -0.35], [-1.3, 0.02, 0.35], [-1.3, -0.4, -0.05]];
  var PIPE_TILES = [0, 1, 2, 3, 4, 5].map(function (k) {
    return [0.42 + (k % 3) * 0.36, 0.2 - Math.floor(k / 3) * 0.4, 0];
  });
  var PIPE_HALF = 0.15;
  var ICON_COLS = 7;
  var ICON_ROWS = 4;
  var ICON_PITCH = 0.27;
  var ICON_BEND = 1.7;
  var ICON_FEATURED = 10;
  var CLOUD_LOBES = [[-0.38, 0.45, 0, 0.26], [0, 0.58, 0, 0.34], [0.4, 0.46, 0, 0.25],
    [-0.16, 0.36, 0.12, 0.24], [0.2, 0.36, -0.1, 0.24]];
  var CLOUD_ACC = (function () {
    var total = 0;
    return CLOUD_LOBES.map(function (l) { total += l[3] * l[3]; return total; });
  })();
  var CLOUD_FILES = 12;
  var LAPTOP_SCREEN = [-0.66, -0.33, -0.2];
  var PHONE_SCREEN = [0.7, -0.33, 0.02];
  var POOL_PILLARS = 7;
  var POOL_GROUND = -0.45;
  var POOL_SPHERE = [0.55, 0.02, 0];
  var POOL_PATCHES = 70;
  var TRUCK_GROUND = -0.2;
  var TRUCK_WHEELS = [-0.8, -0.68, -0.3, -0.18, 0.07];
  var TRUCK_LANES = [-0.19, 0.19, 0.57];
  var CANDLES = 22;

  function frac(v) {
    return v - Math.floor(v);
  }

  function bez3(P, Q, R, s) {
    var m = 1 - s;
    return [
      m * m * P[0] + 2 * m * s * Q[0] + s * s * R[0],
      m * m * P[1] + 2 * m * s * Q[1] + s * s * R[1],
      m * m * P[2] + 2 * m * s * Q[2] + s * s * R[2]
    ];
  }

  function lerp3(P, Q, s) {
    return [P[0] + (Q[0] - P[0]) * s, P[1] + (Q[1] - P[1]) * s, P[2] + (Q[2] - P[2]) * s];
  }

  /* A point on a box: `edge` of the dots on its 12 edges, the rest on faces. */
  function boxPoint(lo, hi, a, b, c, edge) {
    var p = [0, 0, 0];
    var k;
    var ax;
    var r;
    if (c < edge) {
      k = Math.floor(a * 12);
      ax = Math.floor(k / 4);
      p[ax] = lo[ax] + (hi[ax] - lo[ax]) * b;
      p[(ax + 1) % 3] = k & 1 ? hi[(ax + 1) % 3] : lo[(ax + 1) % 3];
      p[(ax + 2) % 3] = k & 2 ? hi[(ax + 2) % 3] : lo[(ax + 2) % 3];
    } else {
      k = Math.floor(a * 6);
      r = a * 6 - k;
      ax = k >> 1;
      p[ax] = k & 1 ? hi[ax] : lo[ax];
      p[(ax + 1) % 3] = lo[(ax + 1) % 3] + (hi[(ax + 1) % 3] - lo[(ax + 1) % 3]) * b;
      p[(ax + 2) % 3] = lo[(ax + 2) % 3] + (hi[(ax + 2) % 3] - lo[(ax + 2) % 3]) * r;
    }
    return p;
  }

  /* Perimeter of a [-1, 1] square, walked by s in [0, 1). */
  function squareEdge(s) {
    var k = Math.floor(s * 4);
    var w = s * 4 - k;
    return k === 0 ? [w * 2 - 1, -1] : k === 1 ? [1, w * 2 - 1] : k === 2 ? [1 - w * 2, 1] : [-1, 1 - w * 2];
  }

  /* Netflix: clusters of titles, each a bubble sized by audience. */
  function bubbleSet(seed) {
    var rnd = seededRng(seed, 61);
    var list = [];
    var total = 0;
    var big = 0;
    var k;
    var n;
    var m;
    var cx;
    var cy;
    var cz;
    var r;
    for (k = 0; k < 5; k++) {
      cx = -1 + k * 0.5 + (rnd() - 0.5) * 0.1;
      cy = 0.2 * Math.sin(k * 1.7 + seed);
      cz = 0.3 * Math.cos(k * 1.3 + seed * 0.5);
      m = 5 + Math.floor(rnd() * 5);
      for (n = 0; n < m; n++) {
        r = 0.035 + 0.12 * Math.pow(rnd(), 2);
        list.push({
          x: cx + (rnd() - 0.5) * 0.34, y: cy + (rnd() - 0.5) * 0.3, z: cz + (rnd() - 0.5) * 0.3,
          r: r, e: 0.3 + 0.06 * ((k * 3) % 5), ph: rnd() * 6.2832
        });
        if (r > list[big].r) big = list.length - 1;
      }
    }
    list[big].e = 0.95;
    list[big].hero = true;
    list.forEach(function (bb) {
      total += bb.r * bb.r + 0.003;
      bb.acc = total;
    });
    return { list: list, total: total };
  }

  /* Uber maps: hex bins over a city, height is demand around hotspots. */
  function hexCells(seed) {
    var rnd = seededRng(seed, 67);
    var hot = [
      [rnd() * 1.2 - 0.6, rnd() - 0.5, 0.8],
      [rnd() * 1.2 - 0.6, rnd() - 0.5, 0.6],
      [rnd() * 1.4 - 0.7, rnd() - 0.5, 0.45]
    ];
    var list = [];
    var total = 0;
    var q;
    var r;
    var x;
    var z;
    var h;
    for (q = -7; q <= 7; q++) {
      for (r = -6; r <= 6; r++) {
        x = HEX_S * 1.732 * (q + r / 2);
        z = HEX_S * 1.5 * r;
        if (x * x / 1.3 + z * z / 0.75 > 1) continue;
        h = 0.02 + 0.05 * rnd();
        hot.forEach(function (s) {
          var dx = x - s[0];
          var dz = z - s[1];
          h += s[2] * 1.2 * Math.exp(-(dx * dx + dz * dz) / 0.05);
        });
        h = Math.min(1, h);
        total += 0.08 + h;
        list.push({ x: x, z: z, h: h, ph: rnd() * 6.2832, acc: total });
      }
    }
    return { list: list, total: total };
  }

  function ribbonY(k, x, t, seed) {
    var ph = seed * 0.9 + k * 1.7 - t * 0.0004;
    return 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(x * 1.9 + ph)) +
      0.12 * (0.5 + 0.5 * Math.sin(x * 4.3 + ph * 1.6 + k)) + 0.04 * Math.sin(x * 9.1 + ph * 2.3);
  }

  /* Forex: a random walk of candles along a gently curving ribbon. */
  function candleSet(seed) {
    var rnd = seededRng(seed, 71);
    var list = [];
    var p = 0;
    var lo = Infinity;
    var hi = -Infinity;
    var total = 0;
    var k;
    var o;
    var cl;
    var sc;
    for (k = 0; k < CANDLES; k++) {
      o = p;
      cl = o + (rnd() - 0.44) * 0.2;
      list.push({ o: o, c: cl, hi: Math.max(o, cl) + rnd() * 0.07, lo: Math.min(o, cl) - rnd() * 0.07, vol: 0.2 + 0.8 * rnd() });
      p = cl;
    }
    list.forEach(function (cd) {
      lo = Math.min(lo, cd.lo);
      hi = Math.max(hi, cd.hi);
    });
    sc = 1.1 / Math.max(0.2, hi - lo);
    list.forEach(function (cd, n) {
      cd.o = -0.3 + (cd.o - lo) * sc;
      cd.c = -0.3 + (cd.c - lo) * sc;
      cd.hi = -0.3 + (cd.hi - lo) * sc;
      cd.lo = -0.3 + (cd.lo - lo) * sc;
      cd.n = n;
      cd.x = -1.2 + n * 2.4 / (CANDLES - 1);
      cd.z = 0.2 * Math.sin(cd.x * 1.4 + seed);
      total += Math.abs(cd.c - cd.o) + 0.03;
      cd.acc = total;
    });
    list.forEach(function (cd, n) {
      var s = 0;
      var m;
      for (m = Math.max(0, n - 4); m <= n; m++) s += list[m].c;
      cd.ma = s / (n - Math.max(0, n - 4) + 1);
    });
    return { list: list, total: total };
  }

  function liveClose(cd, t) {
    return cd.o + (cd.c - cd.o) * 0.3 + 0.09 * Math.sin(t * 0.0013) + 0.04 * Math.sin(t * 0.0037);
  }

  function poolPillar(k, up) {
    var ang = k / POOL_PILLARS * 6.2832 + 0.4;
    var h0 = 0.45 + 0.55 * Math.abs(Math.sin(k * 2.3 + 1));
    return { x: -0.65 + 0.38 * Math.cos(ang), z: 0.38 * Math.sin(ang), h0: h0, h: h0 * (1 - 0.35 * up) };
  }

  function projectPoint(kind, id, seed, a, b, c) {
    var sp = {
      mv: 'proj', kind: kind, a: a, b: b, c: c,
      f: mix01(id ^ 0x0badf00d), q: d7(id), g: gauss3(id)
    };
    var o = projLive(sp, seed, 0);
    sp.x = o.x;
    sp.y = o.y;
    sp.z = o.z;
    sp.e = o.e;
    sp.th = -9;
    sp.r = clamp01(Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z) / 1.3);
    return sp;
  }

  function projLive(sp, seed, t) {
    var a = sp.a;
    var b = sp.b;
    var c = sp.c;
    var f = sp.f;
    var q = sp.q;
    var g = sp.g;
    var dir = vNorm(g);
    var kind = sp.kind;
    var e = 0.4;
    var glow = 0;
    var fe = 1;
    var lit;
    var p;
    var o;
    var k;
    var s;
    var u;
    var v;
    var r;
    var h;
    var up;
    var set;
    var ang;
    var P;
    var Q;
    var x;
    var z;
    var top;
    var base;
    if (kind === 'bubbles') {
      set = perSeed('bubbles', seed, bubbleSet);
      o = pickAcc(set.list, a * set.total);
      r = o.r * (o.hero ? 1 + 0.06 * Math.sin(t * 0.0016) : 1);
      p = [o.x + dir[0] * r, o.y + dir[1] * r + 0.025 * Math.sin(t * 0.0011 + o.ph), o.z + dir[2] * r];
      e = o.e;
    } else if (kind === 'hexbin') {
      set = perSeed('hexbin', seed, hexCells);
      o = pickAcc(set.list, a * set.total);
      h = o.h * (0.88 + 0.12 * Math.sin(t * 0.0012 + o.ph));
      k = Math.floor(b * 6);
      s = b * 6 - k;
      ang = 0.5236 + k * 1.0472;
      u = HEX_S * 0.88;
      P = [(1 - s) * Math.cos(ang) + s * Math.cos(ang + 1.0472), (1 - s) * Math.sin(ang) + s * Math.sin(ang + 1.0472)];
      if (q < 0.35) {
        p = [o.x + u * P[0], HEX_GROUND + h, o.z + u * P[1]];
      } else if (q < 0.55) {
        r = Math.sqrt(c);
        p = [o.x + u * r * P[0], HEX_GROUND + h, o.z + u * r * P[1]];
      } else {
        p = [o.x + u * Math.cos(ang), HEX_GROUND + h * c, o.z + u * Math.sin(ang)];
      }
      e = 0.22 + 0.75 * clamp01(o.h / 0.9);
    } else if (kind === 'ribbons') {
      /* Back ribbons stand taller so each layer reads over the one in front. */
      k = Math.floor(a * RIBBONS);
      z = -0.6 + k * 0.3;
      s = 1 + 0.35 * (RIBBONS - 1 - k);
      base = -0.35;
      if (q < 0.3) {
        x = -1.2 + 2.4 * (Math.floor(b * 110) + 0.5) / 110;
        p = [x, base + ribbonY(k, x, t, seed) * s * 0.9, z];
        e = k === RIBBONS - 1 ? 0.85 : 0.55;
        glow = k === RIBBONS - 1 ? 0.5 : 0;
      } else if (q < 0.36) {
        p = [-1.2 + 2.4 * b, base, z];
        e = 0.2;
      } else {
        x = -1.2 + 2.4 * (Math.floor(b * 44) + 0.5) / 44;
        top = base + ribbonY(k, x, t, seed) * s * 0.9;
        p = [x, base + (top - base) * Math.pow(c, 0.6), z];
        e = 0.18 + 0.05 * k;
      }
    } else if (kind === 'pipeline') {
      if (f < 0.34) {
        k = Math.floor(a * 3);
        P = PIPE_SRC[k];
        Q = [(P[0] + PIPE_NODE[0]) / 2, P[1] * 0.7, P[2] * 0.3];
        s = f < 0.26 ? frac(b + t * 0.00035) : b;
        p = bez3(P, Q, PIPE_NODE, s);
        p = [p[0] + g[0] * 0.012, p[1] + g[1] * 0.012, p[2] + g[2] * 0.012];
        if (f < 0.26) {
          e = 0.6;
          glow = 0.8;
          fe = clamp01(Math.min(s, 1 - s) / 0.08);
        } else {
          e = 0.2;
        }
      } else if (f < 0.42) {
        ang = a * 6.2832;
        p = [PIPE_NODE[0] + g[0] * 0.01, Math.cos(ang) * 0.13 + g[1] * 0.01, Math.sin(ang) * 0.13];
        e = 0.85;
      } else if (f < 0.56) {
        k = Math.floor(a * 6);
        P = PIPE_TILES[k];
        s = frac(b + t * 0.0003);
        p = bez3(PIPE_NODE, [0.1, P[1] * 0.8, 0.25], [P[0], P[1], 0.03], s);
        p = [p[0] + g[0] * 0.01, p[1] + g[1] * 0.01, p[2] + g[2] * 0.01];
        e = 0.6;
        glow = 0.7;
        fe = clamp01(Math.min(s, 1 - s) / 0.08);
      } else {
        /* Dashboard tiles: an outline and a mini chart (bars, line, donut). */
        k = Math.floor(a * 6);
        P = PIPE_TILES[k];
        if (q < 0.4) {
          o = squareEdge(b);
          u = o[0];
          v = o[1];
          e = 0.38;
        } else if (k % 3 === 0) {
          s = Math.floor(b * 5);
          h = (0.25 + 0.6 * Math.abs(Math.sin(k * 3.1 + s * 1.7))) * (0.85 + 0.15 * Math.sin(t * 0.0015 + s));
          u = -0.7 + s * 0.35 + (b * 5 - s - 0.5) * 0.16;
          v = -0.75 + c * h * 1.5;
          e = 0.8;
        } else if (k % 3 === 1) {
          u = -0.8 + 1.6 * b;
          v = -0.1 + 0.4 * Math.sin(u * 3 + k + t * 0.001);
          if (c < 0.3) v = -0.75 + (v + 0.75) * c / 0.3;
          e = c < 0.3 ? 0.4 : 0.8;
        } else {
          ang = b * 6.2832;
          r = 0.55 + (c - 0.5) * 0.12;
          u = Math.cos(ang) * r;
          v = Math.sin(ang) * r;
          e = b < 0.68 ? 0.85 : 0.3;
        }
        p = [P[0] + u * PIPE_HALF, P[1] + v * PIPE_HALF, P[2]];
      }
    } else if (kind === 'iconwall') {
      /* App icons on a gently curved wall; the featured one steps forward. */
      k = Math.floor(a * ICON_COLS * ICON_ROWS);
      u = b * 2 - 1;
      v = c * 2 - 1;
      if (q < 0.3) {
        s = k % 4;
        if (s === 0) {
          ang = b * 6.2832;
          u = Math.cos(ang) * 0.45;
          v = Math.sin(ang) * 0.45;
        } else if (s === 1) {
          r = 0.38 * Math.sqrt(c);
          u = Math.cos(b * 6.2832) * r;
          v = Math.sin(b * 6.2832) * r;
        } else if (s === 2) {
          if (b + c > 1) {
            u = 1 - b;
            v = 1 - c;
          } else {
            u = b;
            v = c;
          }
          P = [-0.45 * u + 0.45 * v, 0.5 - 0.85 * u - 0.85 * v];
          u = P[0];
          v = P[1];
        } else {
          s = Math.floor(b * 4);
          u = (s & 1 ? 0.25 : -0.25) + g[0] * 0.05;
          v = (s & 2 ? 0.25 : -0.25) + g[1] * 0.05;
        }
        e = 0.55;
      } else {
        r = Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25);
        if (r > 1) {
          u /= r;
          v /= r;
        }
        e = 0.28;
      }
      up = 0;
      if (k === ICON_FEATURED) {
        up = fade(clamp01((t - 900) / 2400));
        e = q < 0.3 ? 1 : 0.75;
      }
      s = 0.1 * (1 + 0.5 * up);
      ang = ((k % ICON_COLS) - (ICON_COLS - 1) / 2) * ICON_PITCH / ICON_BEND;
      x = Math.sin(ang) * ICON_BEND;
      z = (1 - Math.cos(ang)) * ICON_BEND;
      h = ((ICON_ROWS - 1) / 2 - Math.floor(k / ICON_COLS)) * ICON_PITCH;
      p = [
        x + Math.cos(ang) * u * s - Math.sin(ang) * 0.45 * up,
        h + v * s,
        z + Math.sin(ang) * u * s + Math.cos(ang) * 0.45 * up
      ];
    } else if (kind === 'cloudfiles') {
      if (f < 0.4) {
        for (k = 0; k < CLOUD_LOBES.length - 1 && a * CLOUD_ACC[CLOUD_ACC.length - 1] > CLOUD_ACC[k]; k++) { /* pick lobe */ }
        P = CLOUD_LOBES[k];
        p = shell(P, P[3], dir);
        CLOUD_LOBES.forEach(function (L, n) {
          var d;
          var l;
          if (n === k) return;
          d = [p[0] - L[0], p[1] - L[1], p[2] - L[2]];
          l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
          if (l < L[3]) p = shell(L, L[3], vNorm(d));
        });
        if (p[1] < 0.3) p[1] = 0.3 + (p[1] - 0.3) * 0.35;
        e = 0.35 + 0.35 * clamp01((p[1] - 0.3) / 0.5);
        p[1] += 0.015 * Math.sin(t * 0.0008);
      } else if (f < 0.7) {
        /* A laptop (base plus a screen tilted back) and a phone. */
        if (q < 0.3) {
          p = boxPoint([-0.92, -0.52, -0.17], [-0.4, -0.5, 0.17], a, b, c, 0.6);
        } else if (q < 0.6) {
          o = boxPoint([-0.92, 0, 0], [-0.4, 0.34, 0.012], a, b, c, 0.6);
          p = [o[0], -0.5 + o[1] * 0.966, -0.17 - o[1] * 0.259 + o[2]];
        } else {
          p = boxPoint([0.61, -0.5, -0.01], [0.79, -0.16, 0.01], a, b, c, 0.6);
        }
        e = 0.45;
      } else {
        /* Files rise from one device into the cloud and settle on the other. */
        k = Math.floor(a * CLOUD_FILES);
        P = k % 2 ? PHONE_SCREEN : LAPTOP_SCREEN;
        Q = k % 2 ? LAPTOP_SCREEN : PHONE_SCREEN;
        o = [-0.45 + k * 0.08, 0.42 + 0.06 * Math.sin(k * 2.3), 0.05 * Math.cos(k)];
        s = frac(k / CLOUD_FILES + t * 0.00022);
        if (s < 0.4) {
          h = fade(s / 0.4);
          o = lerp3(P, o, h);
          o[1] += 0.12 * Math.sin(Math.PI * h);
          glow = 0.6;
        } else if (s < 0.6) {
          o = [o[0], o[1] + 0.02 * Math.sin((s - 0.4) * 15), o[2]];
          glow = 0.2;
        } else {
          h = fade((s - 0.6) / 0.4);
          o = lerp3(o, Q, h);
          o[1] += 0.12 * Math.sin(Math.PI * h);
          glow = 0.6;
        }
        if (q < 0.5) {
          P = squareEdge(b);
          u = P[0];
          v = P[1];
        } else {
          v = 0.5 - Math.floor(c * 3) * 0.45;
          u = -0.7 + 1.2 * b;
        }
        p = [o[0] + u * 0.045, o[1] + v * 0.06, o[2]];
        e = 0.7;
      }
    } else if (kind === 'pool') {
      /* Concentrated pillars pour into one diversified sphere: the pillars
         shorten and the sphere grows over the hold. */
      up = fade(clamp01((t - 600) / 4200));
      r = 0.3 + 0.1 * up;
      if (f < 0.36) {
        k = Math.floor(a * POOL_PILLARS);
        o = poolPillar(k, up);
        p = boxPoint([o.x - 0.05, POOL_GROUND, o.z - 0.05], [o.x + 0.05, POOL_GROUND + o.h, o.z + 0.05], b, c, q, 0.6);
        e = o.h0 > 0.9 ? 0.75 : 0.5;
      } else if (f < 0.6) {
        k = Math.floor(a * POOL_PILLARS);
        o = poolPillar(k, up);
        P = [o.x, POOL_GROUND + o.h + 0.02, o.z];
        Q = vNorm([P[0] - POOL_SPHERE[0], P[1] - POOL_SPHERE[1], P[2] - POOL_SPHERE[2]]);
        s = frac(b + t * 0.00045 + k * 0.13);
        p = bez3(P, [(P[0] + POOL_SPHERE[0]) / 2, Math.max(P[1], POOL_SPHERE[1]) + 0.45, P[2] * 0.4],
          [POOL_SPHERE[0] + Q[0] * r, POOL_SPHERE[1] + Q[1] * r, POOL_SPHERE[2] + Q[2] * r], s);
        p = [p[0] + g[0] * 0.01, p[1] + g[1] * 0.01, p[2] + g[2] * 0.01];
        e = 0.6;
        glow = 0.8;
        fe = clamp01(Math.min(s, 1 - s) / 0.08);
      } else {
        k = Math.floor(a * POOL_PATCHES);
        h = 1 - 2 * (k + 0.5) / POOL_PATCHES;
        s = Math.sqrt(1 - h * h);
        ang = k * 2.39996;
        o = vNorm([s * Math.cos(ang) + g[0] * 0.1, h + g[1] * 0.1, s * Math.sin(ang) + g[2] * 0.1]);
        p = [POOL_SPHERE[0] + o[0] * r, POOL_SPHERE[1] + o[1] * r, POOL_SPHERE[2] + o[2] * r];
        e = 0.4 + 0.45 * mix01(k * 977 + 13);
      }
    } else if (kind === 'truck') {
      if (f < 0.2) {
        p = boxPoint([-0.9, -0.13, -0.13], [-0.12, 0.2, 0.13], a, b, c, 0.5);
        e = 0.5;
      } else if (f < 0.3) {
        p = boxPoint([-0.09, -0.13, -0.12], [0.16, 0.1, 0.12], a, b, c, 0.55);
        e = 0.62;
      } else if (f < 0.36) {
        k = Math.floor(a * 10);
        ang = b * 6.2832;
        p = [TRUCK_WHEELS[k >> 1] + Math.cos(ang) * 0.05, TRUCK_GROUND + 0.05 + Math.sin(ang) * 0.05, (k & 1 ? 1 : -1) * 0.135];
        e = 0.4;
      } else if (f < 0.56) {
        k = Math.floor(a * 3);
        if (k === 1) {
          s = (-1.3 + 2.6 * b + t * 0.0005) / 0.16;
          x = wrapSpan((Math.floor(s) + (s - Math.floor(s)) * 0.45) * 0.16 - t * 0.0005, 1.3);
        } else {
          x = -1.3 + 2.6 * (Math.floor(b * 70) + 0.5) / 70;
        }
        p = [x, TRUCK_GROUND, TRUCK_LANES[k]];
        e = 0.3;
        fe = clamp01((1.3 - Math.abs(x)) / 0.15);
      } else if (f < 0.8) {
        /* Dash-cam view: a widening volume ahead of the cab. */
        s = Math.pow(a, 0.75);
        u = b * 2 - 1;
        u = (u < 0 ? -1 : 1) * Math.sqrt(Math.abs(u));
        p = [0.17 + s * 1.05, Math.max(TRUCK_GROUND + 0.01, 0.03 + (c * 2 - 1) * (0.02 + s * 0.16)), u * (0.03 + s * 0.45)];
        e = 0.28 + 0.2 * (1 - s);
        fe = 1 - 0.6 * s;
      } else {
        /* Road users; anything inside the camera's view lights up. */
        k = Math.floor(a * 3);
        if (k === 0) {
          x = 0.55 + 0.25 * Math.sin(t * 0.0005 + seed);
          z = 0;
        } else if (k === 1) {
          x = wrapSpan(0.9 - t * 0.00035, 1.3);
          z = 0.38;
        } else {
          x = wrapSpan(1.2 - t * 0.0005, 1.3);
          z = 0.72;
        }
        if (k < 2) {
          p = boxPoint([x - 0.11, TRUCK_GROUND, z - 0.06], [x + 0.11, TRUCK_GROUND + 0.1, z + 0.06], b, c, q, 0.6);
        } else if (q < 0.7) {
          p = [x + g[0] * 0.008, TRUCK_GROUND + c * 0.13, z + g[2] * 0.008];
        } else {
          p = shell([x, TRUCK_GROUND + 0.16, z], 0.022, dir);
        }
        lit = x > 0.2 && x < 1.22 && Math.abs(z) < 0.03 + (x - 0.17) * 0.45;
        glow = lit ? 0.7 : 0;
        e = lit ? 0.95 : 0.4;
        fe = clamp01((1.3 - Math.abs(x)) / 0.15);
      }
    } else if (kind === 'candles') {
      set = perSeed('candles', seed, candleSet);
      if (f < 0.6) {
        o = f < 0.45 ? pickAcc(set.list, a * set.total) : set.list[Math.floor(a * CANDLES)];
        v = o.n === CANDLES - 1 ? liveClose(o, t) : o.c;
        up = v >= o.o;
        if (f < 0.45) {
          p = boxPoint([o.x - 0.04, Math.min(o.o, v), o.z - 0.04], [o.x + 0.04, Math.max(o.o, v) + 0.015, o.z + 0.04], b, c, q, 0.5);
        } else {
          top = Math.max(o.hi, v + 0.03);
          base = Math.min(o.lo, v - 0.03);
          p = [o.x, base + Math.floor(b * (top - base) / 0.014) * 0.014, o.z];
        }
        e = up ? 0.78 : 0.36;
        if (o.n === CANDLES - 1) glow = 0.6;
      } else if (f < 0.75) {
        o = set.list[Math.floor(a * CANDLES)];
        p = boxPoint([o.x - 0.03, -0.5, o.z - 0.03], [o.x + 0.03, -0.5 + o.vol * 0.16, o.z + 0.03], b, c, q, 0.6);
        e = 0.22;
      } else {
        u = (Math.floor(b * 140) + 0.5) / 140 * (CANDLES - 1);
        k = Math.floor(u);
        s = u - k;
        o = set.list[k];
        P = set.list[Math.min(CANDLES - 1, k + 1)];
        p = [o.x + (P.x - o.x) * s, o.ma + (P.ma - o.ma) * s + 0.05, o.z + (P.z - o.z) * s];
        e = 0.62;
      }
    }
    return { x: p[0], y: p[1], z: p[2], e: e, glow: glow, lit: lit, fe: fe };
  }

  var topoCache = null;
  var topoCacheSeed = -1;
  var topoBox = null;

  /* Homes don't depend on time, so compute each once per cycle. The box
     lets every solid turn about its own centre, so it sits centred. */
  function shapePointCached(kind, i, j, seed, idx) {
    if (topoCacheSeed !== seed || !topoCache) {
      topoCache = new Array(cols * rows);
      topoCacheSeed = seed;
      topoBox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    }
    var hit = topoCache[idx];
    if (!hit) {
      hit = shapePoint(kind, i, j, seed);
      topoCache[idx] = hit;
      if (hit.x < topoBox[0]) topoBox[0] = hit.x;
      if (hit.y < topoBox[1]) topoBox[1] = hit.y;
      if (hit.z < topoBox[2]) topoBox[2] = hit.z;
      if (hit.x > topoBox[3]) topoBox[3] = hit.x;
      if (hit.y > topoBox[4]) topoBox[4] = hit.y;
      if (hit.z > topoBox[5]) topoBox[5] = hit.z;
    }
    return hit;
  }

  function projectShape(stage, sp) {
    var M = stage.M;
    var ox = topoBox ? (topoBox[0] + topoBox[3]) * 0.5 : 0;
    var oy = topoBox ? (topoBox[1] + topoBox[4]) * 0.5 : 0;
    var oz = topoBox ? (topoBox[2] + topoBox[5]) * 0.5 : 0;
    var px = sp.x - ox;
    var py = sp.y - oy;
    var pz = sp.z - oz;
    var x = M[0] * px + M[1] * py + M[2] * pz;
    var y = M[3] * px + M[4] * py + M[5] * pz;
    var z = M[6] * px + M[7] * py + M[8] * pz;
    var s = 3.4 / (3.4 - z);
    return {
      x: stage.cx + x * stage.S * s,
      y: stage.cy - y * stage.S * s,
      d: clamp01((z + 1.1) / 2.2)
    };
  }

  /* Condense centre-out; release rim-first. */
  function shapeK(stage, r, jit) {
    var d;
    if (stage.phase === 'form') {
      d = (0.55 * r + 0.15 * jit) * 0.72;
      return siteEase((stage.p - d) / (1 - d));
    }
    if (stage.phase === 'hold') return 1;
    d = (0.45 * (1 - r) + 0.15 * jit) * 0.7;
    return 1 - fade(clamp01((stage.p - d) / (1 - d)));
  }

  function syncViewport() {
    var vv = window.visualViewport;
    w = Math.max(1, Math.round((vv && vv.width) || window.innerWidth));
    h = Math.max(1, Math.round((vv && vv.height) || window.innerHeight));
  }

  var heroEl = null;
  var navEl = null;
  var titleEl = null;
  var statementEl = null;

  function findHero() {
    heroEl = document.querySelector('main > .hero') || document.querySelector('main .hero');
    navEl = document.querySelector('.nav');
    titleEl = heroEl && heroEl.querySelector('h1');
    statementEl = heroEl && heroEl.querySelector('.statement');
  }

  function updateField() {
    var hero = heroEl;
    var title = titleEl;
    var statement = statementEl;
    if (!hero) {
      field.ready = false;
      titleBox = null;
      return;
    }
    var hr = hero.getBoundingClientRect();
    var navBottom = navEl ? navEl.getBoundingClientRect().bottom : 0;
    /* Cinema measures the field as if unscrolled and slides it with the page,
       so scrolling never squeezes the solid. */
    var sy = cinema ? scrollTop() : 0;
    var top = Math.max(hr.top + sy, navBottom) + (w < 480 ? 8 : 12) - sy;
    var bottom;
    if (cinema) {
      bottom = hr.bottom + (w < 480 ? 16 : 28);
    } else {
      var anchor = statement || title;
      var ab = anchor ? anchor.getBoundingClientRect() : hr;
      bottom = Math.min(ab.bottom + (about ? 36 : 28), hr.bottom + 10, h * 0.6);
    }
    field.left = 0;
    field.right = w;
    field.top = top;
    field.bottom = bottom;
    field.width = w;
    field.height = Math.max(0, bottom - top);
    field.ready = field.height > (w < 480 ? 72 : 96) && field.bottom > 24;

    if (title) {
      var tb = title.getBoundingClientRect();
      titleBox = { top: tb.top, bottom: tb.bottom };
      if (cinema && statement) titleBox.bottom = statement.getBoundingClientRect().bottom;
      titleV0 = clamp01((tb.top - field.top) / Math.max(1, field.height));
      titleV1 = clamp01((tb.bottom - field.top) / Math.max(1, field.height));
      ridgeZ = clamp01(titleV0 - 0.12 + visit.ridgeNudge);
    } else {
      titleBox = null;
      titleV0 = 0.62;
      titleV1 = 0.82;
      ridgeZ = 0.4;
    }

    var cell = w < 480 ? 11 : w < 800 ? 9 : 7;
    cols = Math.max(36, Math.round(field.width / cell) + 1);
    rows = Math.max(18, Math.round(field.height / (cell * 0.85)) + 1);
    if (cols !== cellCols || rows !== cellRows) buildCells();
  }

  /* Everything about a mote that depends only on its grid cell, computed
     once per grid instead of every frame. */
  var cellCols = 0;
  var cellRows = 0;
  var cells = null;

  function buildCells() {
    var n = cols * rows;
    var i;
    var j;
    var k;
    var id;
    var C = {
      u: new Float32Array(n), z: new Float32Array(n), cull: new Float32Array(n),
      scat: new Float32Array(n), air: new Float32Array(n), air2: new Float32Array(n),
      fill: new Float32Array(n), ma: new Float32Array(n), mb: new Float32Array(n),
      mc: new Float32Array(n), md: new Float32Array(n), recruit: new Float32Array(n),
      join: new Float32Array(n), jit: new Float32Array(n), swirl: new Float32Array(n),
      ang: new Float32Array(n), fly: new Float32Array(n)
    };
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        k = j * cols + i;
        id = moteId(i, j);
        C.u[k] = clamp01((i + (j % 2) * 0.5 + (hash2(i * 17, j * 31) - 0.5) * 0.72) / Math.max(1, cols - 1));
        C.z[k] = clamp01((j + (hash2(i * 41 + 3, j * 19) - 0.5) * 0.58) / Math.max(1, rows - 1));
        C.cull[k] = hash2(i * 13, j * 7);
        C.scat[k] = hash2(i * 9, j * 11);
        C.air[k] = hash2(i + 4, j + 8);
        C.air2[k] = hash2(j, i);
        C.fill[k] = hash2(i * 23, j * 29);
        C.ma[k] = hash2(i * 3, j * 5);
        C.mb[k] = hash2(i * 11, j * 17);
        C.mc[k] = hash2(i * 19 + 1, j * 23);
        C.md[k] = hash2(i * 29, j * 7);
        C.recruit[k] = mix01(id ^ 0x1f83d9ab);
        C.join[k] = mix01(id ^ 0x3c6ef372);
        C.jit[k] = mix01(id ^ 0x7f4a7c15);
        C.swirl[k] = mix01(id ^ 0x6a09e667);
        C.ang[k] = mix01(id ^ 0x2545f491);
        C.fly[k] = mix01(id ^ 0x1b873593);
      }
    }
    cells = C;
    cellCols = cols;
    cellRows = rows;
    topoCache = null;
  }

  /* The crest profile is smooth in u, so sample it once per frame and
     interpolate rather than running three fbm stacks for every cell. */
  var TERRAIN_N = 768;
  var terrX = new Float32Array(TERRAIN_N + 1);
  var terrSil = new Float32Array(TERRAIN_N + 1);
  var terrN = new Float32Array(TERRAIN_N + 1);

  function sampleTerrain(t) {
    var k;
    var o;
    for (k = 0; k <= TERRAIN_N; k++) {
      o = terrainAt(k / TERRAIN_N, t);
      terrX[k] = o.x;
      terrSil[k] = o.sil;
      terrN[k] = o.n;
    }
  }

  /* Dots are stamped from a pre-rendered disc; each stamp still composites
     on its own, so overlaps brighten exactly as separate fills did. */
  var SPRITE = 32;
  var SPRITE_SCALE = SPRITE / (SPRITE / 2 - 1);

  function makeSprite(rgb) {
    var c = document.createElement('canvas');
    var x;
    c.width = SPRITE;
    c.height = SPRITE;
    x = c.getContext('2d');
    x.fillStyle = rgba(rgb, 1);
    x.beginPath();
    x.arc(SPRITE / 2, SPRITE / 2, SPRITE / 2 - 1, 0, Math.PI * 2);
    x.fill();
    return c;
  }

  var spriteGold = makeSprite(GOLD);
  var spriteCream = makeSprite(CREAM);

  function titleFalloff(y) {
    if (!titleBox) return 1;
    var y0 = titleBox.top - 28;
    var mid = titleBox.top + (titleBox.bottom - titleBox.top) * 0.46;
    var y2 = titleBox.bottom + 14;
    if (y <= y0 || y >= y2) return 1;
    if (y < mid) return 1 - 0.62 * fade((y - y0) / Math.max(1, mid - y0));
    return 0.38 + 0.62 * fade((y - mid) / Math.max(1, y2 - mid));
  }

  function scrollFade() {
    if (!field.ready) return 0;
    if (field.bottom < 28 || field.top > h - 24) return 0;
    if (field.top < 0) {
      return Math.max(0, Math.min(1, 1 + field.top / Math.max(90, field.height * (cinema ? 0.95 : 0.55))));
    }
    return 1;
  }

  function scrollTop() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  var blank = false;

  function draw(now) {
    updateField();
    var fadePage = field.ready ? scrollFade() * intensity : 0;
    if (fadePage < 0.02) {
      if (!blank) ctx.clearRect(0, 0, w, h);
      blank = true;
      lastNow = 0;
      return;
    }
    ctx.clearRect(0, 0, w, h);
    blank = false;

    if (!reduce) {
      if (!lastNow) lastNow = now;
      var dt = Math.min(50, now - lastNow);
      lastNow = now;
      lifeT += dt;
      enter = Math.min(1, enter + dt / 2600);
      if (cinema) morphClock += dt;
    }

    var t = reduce ? 20000 : lifeT;
    var reveal = easeOut(enter);
    var hourAmp = 0.7 + 0.4 * sky.dayness + 0.16 * sky.temp;
    var lift = hourAmp * (climate ? 1 + Math.max(-0.08, Math.min(0.08, climate.lastReturn * 6)) : 1);
    var volK = 0.42 + 0.7 * sky.wind + 0.5 * sky.storm + 0.22 * sky.cloud +
      (climate ? 0.2 * climate.vol : 0);
    var amp = field.height * ampScale * lift;
    var thick = field.height * 0.016 * volK;
    var crestY = field.top + ridgeZ * field.height;
    var dustK = (cinema ? 1 : 0.62) * (0.88 + 0.28 * sky.wind);
    var morph = morphState();
    var stage = morph.kind ? shapeStage(morph) : null;
    var C = cells;
    var i, j, u, z, scatter, air, x, y, a, rad, dens, atmos, horizon, floor, gate;
    var shelf, onRange, haze, rise, near, fill, loose;
    var k, sp, pt, depth, cream, swirl, tx, ty, recruit, idx;
    var tu, t0, tw, tX, tSil, tN, dz, core, body;
    var ma, mb, mc, md, t1, t2, t3, t4, mdx, mdy, glint, mrad;
    var ang, fly;
    /* Narrow grids are coarse and the range culls most cells; a solid needs
       roughly the desktop dot count, so shapes borrow otherwise-empty cells. */
    var recruitP = stage ? (w < 480 ? 0.9 : w < 800 ? 0.45 : 0) : 0;
    /* Scrolling scatters the dots: each flies off along its own heading
       from the solid's centre, farther the more the page has scrolled. */
    var scat = cinema && !reduce ? clamp01(scrollTop() / Math.max(1, field.height * 0.9)) : 0;
    var scatE = Math.pow(scat, 1.6);
    var scx = stage ? stage.cx : field.left + field.width * 0.5;
    var scy = stage ? stage.cy : field.top + field.height * 0.4;
    var flyMax = Math.max(w, h);
    var localAmp = amp * 0.92;
    var localThick = thick * (1.05 + 0.2 * sky.wind);
    var hazeK = 0.09 * (0.22 + 0.78 * sky.cloud);
    var densK = 0.8 + 0.1 * sky.cloud + 0.08 * sky.storm;
    var airCut = 0.86 - 0.12 * sky.cloud;
    var creamCut = 0.72 - 0.1 * (1 - sky.dayness);

    sampleTerrain(t);

    for (j = 0; j < rows; j++) {
      gate = fade(clamp01((reveal * 1.18 - j / Math.max(1, rows - 1)) / 0.22));
      if (gate < 0.04) continue;

      for (i = 0; i < cols; i++) {
        idx = j * cols + i;
        u = C.u[idx];
        z = C.z[idx];
        tu = u * TERRAIN_N;
        t0 = tu | 0;
        if (t0 >= TERRAIN_N) t0 = TERRAIN_N - 1;
        tw = tu - t0;
        tX = terrX[t0] + (terrX[t0 + 1] - terrX[t0]) * tw;
        tSil = terrSil[t0] + (terrSil[t0 + 1] - terrSil[t0]) * tw;
        tN = terrN[t0] + (terrN[t0 + 1] - terrN[t0]) * tw;
        dz = z - ridgeZ;
        core = Math.exp(-(dz * dz) / 0.007);
        body = Math.exp(-(dz * dz) / 0.03);
        shelf = titleShelf(z);
        onRange = (0.55 * core + 0.45 * body) * tSil * shelf;
        haze = tN * hazeK * (0.4 + 0.6 * body) * shelf;

        dens = (0.07 + 0.9 * Math.pow(onRange, 0.75) + 0.16 * haze) * densK;
        recruit = false;
        if (C.cull[idx] > dens) {
          if (!recruitP || C.recruit[idx] > recruitP) continue;
          recruit = true;
        }

        ma = C.ma[idx];
        mb = C.mb[idx];
        mc = C.mc[idx];
        if (reduce) {
          mdx = Math.sin(ma * 6.2832) * 0.35;
          mdy = Math.cos(mb * 6.2832) * 0.35;
          glint = mc;
          mrad = 0.72 + 0.4 * mb;
        } else {
          md = C.md[idx];
          t1 = t * (0.00038 + ma * 0.0007) + ma * 6.2832;
          t2 = t * (0.00024 + mb * 0.00058) + mb * 6.2832;
          t3 = t * (0.00052 + mc * 0.0005) + mc * 6.2832;
          t4 = t * (0.00016 + md * 0.00028) + md * 6.2832;
          mdx = Math.sin(t1) * 0.82 + Math.sin(t3) * 0.32;
          mdy = Math.cos(t2) * 0.88 + Math.sin(t1 * 0.62) * 0.36 + Math.sin(t4) * 0.48;
          glint = Math.sin(t3 + t2 * 0.28);
          mrad = 0.68 + 0.42 * mb + 0.18 * Math.sin(t2);
        }
        loose = 0.58 + 0.42 * (1 - onRange);
        scatter = (C.scat[idx] - 0.5) * localThick * (0.28 + onRange) * volK;
        air = C.air[idx] > airCut ? localThick * (0.7 + C.air2[idx] * 1.6) : 0;
        x = field.left + tX * field.width + mdx * field.width * 0.014 * dustK * loose;
        rise = tSil * localAmp * (0.72 * core + 0.28 * body) * shelf;
        near = Math.max(0, dz) * field.height * 0.38;
        fill = C.fill[idx] * body * tSil * field.height * 0.14 * shelf;
        y = onRange > 0.07
          ? crestY - rise + near + fill + scatter + air
          : field.top + z * field.height - haze * localAmp * 0.22 + scatter * 0.4;
        y += mdy * field.height * 0.03 * dustK * loose;

        atmos = 0.32 + 0.68 * fade(z);
        horizon = fade(clamp01(z / 0.08));
        floor = fade(clamp01((1 - z) / 0.16));
        a = fadePage * gate * atmos * horizon * floor * titleFalloff(y) *
          (0.14 + 0.78 * onRange + 0.1 * haze);
        rad = (0.36 + z * 0.7 + onRange * 0.95) * mrad * (0.5 + 0.5 * gate);
        cream = (glint > 0.62 && onRange > 0.28) || onRange > creamCut;
        if (recruit) a = 0;

        if (stage) {
          if (recruit || C.join[idx] < SHAPE_JOIN) {
            sp = shapePointCached(stage.kind, i, j, stage.seed, idx);
            if (sp.mv) sp = animatePoint(stage, sp);
            k = shapeK(stage, sp.r, C.jit[idx]);
            if (k > 0.001) {
              pt = projectShape(stage, sp);
              pt.x += mdx * 2.2;
              pt.y += mdy * 2.2;
              if (stage.phase === 'release') {
                pt.x += (pt.x - stage.cx) * 0.16 * (1 - k);
                pt.y += (pt.y - stage.cy) * 0.16 * (1 - k);
              }
              swirl = Math.sin(Math.PI * k) * (C.swirl[idx] - 0.5) * 0.34;
              tx = pt.x - x;
              ty = pt.y - y;
              x += tx * k - ty * swirl;
              y += ty * k + tx * swirl;
              depth = sp.e >= 0 ? 0.35 * pt.d + 0.65 * sp.e : pt.d;
              a = a * (1 - k) + fadePage * gate * titleFalloff(y) * (0.2 + 0.66 * depth) * k;
              rad = rad * (1 - k) + (0.46 + 0.95 * depth) * mrad * k;
              if (sp.fe !== undefined) a *= 1 - k + k * sp.fe;
              if (k > 0.5) {
                cream = sp.e >= 0 ? sp.e > 0.7
                  : depth > 0.8 || (glint > 0.72 && depth > 0.45);
                if (sp.lit !== undefined) cream = sp.lit;
                if (sp.glow > 0) {
                  cream = true;
                  rad *= 1 + 0.4 * sp.glow;
                }
                if (sp.th > -9) {
                  swirl = wrapAngle(stage.sweep - sp.th);
                  if (swirl > 0 && swirl < 0.6) {
                    cream = true;
                    rad *= 1 + 0.35 * (1 - swirl / 0.6);
                  }
                }
              }
            }
          } else {
            a *= 1 - 0.86 * stage.env;
          }
        }
        if (scatE > 0.001) {
          ang = C.ang[idx] * 6.2832 + t * 0.00008;
          fly = scatE * flyMax * (0.05 + 0.3 * C.fly[idx]);
          x += (x - scx) * 0.6 * scatE + Math.cos(ang) * fly;
          y += (y - scy) * 0.6 * scatE + Math.sin(ang) * fly * 0.7;
          rad *= 1 + 0.6 * scatE;
          a *= 1 - 0.3 * scatE;
        }
        if (a < 0.036) continue;

        ctx.globalAlpha = cream ? Math.min(1, a * 0.96) : Math.min(1, a);
        rad *= SPRITE_SCALE;
        ctx.drawImage(cream ? spriteCream : spriteGold, x - rad * 0.5, y - rad * 0.5, rad, rad);
      }
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    syncViewport();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateField();
    if (reduce) draw(performance.now());
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 80);
  }, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 80);
    }, { passive: true });
  }

  function dataUrl(name) {
    var day = new Date().toISOString().slice(0, 10);
    var el = document.querySelector('script[src*="data-weather"]');
    var url = (el && el.src)
      ? el.src.replace(/js\/data-weather\.js(\?.*)?$/, 'data/' + name)
      : './assets/data/' + name;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'd=' + day;
  }

  function loadWeather() {
    applyHour();
    var cached = null;
    try {
      cached = JSON.parse(sessionStorage.getItem('jianart-sky') || 'null');
    } catch (err) {
      cached = null;
    }
    if (cached && cached.at && Date.now() - cached.at < 15 * 60 * 1000 && cached.data) {
      ingestWeather(cached.data);
      return Promise.resolve();
    }
    return fetch(SKY_LIVE)
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; })
      .then(function (live) {
        if (live) return live;
        return fetch(dataUrl('weather.json'), { credentials: 'same-origin' })
          .then(function (res) { return res.ok ? res.json() : null; })
          .catch(function () { return null; });
      })
      .then(function (data) {
        if (!data) return;
        ingestWeather(data);
        try {
          sessionStorage.setItem('jianart-sky', JSON.stringify({ at: Date.now(), data: data }));
        } catch (err) { /* ignore */ }
      });
  }

  function start() {
    findHero();
    applyHour();
    resize();
    if (!reduce) {
      function tick(now) {
        draw(now);
        loopId = window.requestAnimationFrame(tick);
      }
      loopId = window.requestAnimationFrame(tick);
      window.addEventListener('pagehide', function () {
        window.cancelAnimationFrame(loopId);
      }, { once: true });
    }
  }

  start();
  Promise.all([
    fetch(dataUrl('climate.json'), { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; }),
    loadWeather()
  ]).then(function (pair) {
    ingestClimate(pair[0]);
  }).catch(function () { /* dust runs without climate */ });
})();
