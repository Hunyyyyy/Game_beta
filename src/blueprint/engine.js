// Bộ máy vẽ vật thể từ JSON (cùng bản với trang "Bản vẽ vật thể"). Gắn vào globalThis.Blueprint.
/* Blueprint engine: vẽ vật thể pixel 2D từ JSON. Thuần JS, không phụ thuộc DOM. */
(function (root) {
  'use strict';
  var OPS_LIMIT = 6000000;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function mulberry32(a) {
    a >>>= 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function hstr(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var mod = function (a, n) { return ((a % n) + n) % n; };

  function parseColor(c, pal, depth) {
    if (typeof c !== 'string') return null;
    depth = depth || 0;
    if (pal && Object.prototype.hasOwnProperty.call(pal, c) && depth < 6) return parseColor(pal[c], pal, depth + 1);
    var m;
    if ((m = /^#([0-9a-f]{3,8})$/i.exec(c))) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(function (x) { return x + x; }).join('');
      if (h.length === 6) h += 'ff';
      if (h.length !== 8) return null;
      return [0, 2, 4, 6].map(function (i) { return parseInt(h.substr(i, 2), 16); });
    }
    if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(c))) {
      return [clamp(+m[1], 0, 255) | 0, clamp(+m[2], 0, 255) | 0, clamp(+m[3], 0, 255) | 0, m[4] === undefined ? 255 : Math.round(clamp(+m[4], 0, 1) * 255)];
    }
    if (c === 'none' || c === 'transparent') return [0, 0, 0, 0];
    return null;
  }

  /** Số: hằng, [min,max] ngẫu nhiên (nguyên nếu cả hai nguyên), hoặc {"cycle":[...]} theo khung hình. */
  function num(v, d, ctx, rng) {
    if (v === undefined || v === null) return d;
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
      var a = Math.min(v[0], v[1]), b = Math.max(v[0], v[1]), r = rng();
      return Number.isInteger(v[0]) && Number.isInteger(v[1]) ? a + Math.floor(r * (b - a + 1)) : a + r * (b - a);
    }
    if (v && typeof v === 'object' && Array.isArray(v.cycle) && v.cycle.length) {
      var x = v.cycle[ctx.frame % v.cycle.length]; return typeof x === 'number' ? x : d;
    }
    return d;
  }

  function cond(s, ctx) {
    var p = ctx.params;
    var test = function (k) { var neg = false; if (typeof k !== 'string') return true; if (k[0] === '!') { neg = true; k = k.slice(1); } var v = !!p[k]; return neg ? !v : v; };
    if (s['if'] !== undefined) { var a = [].concat(s['if']); if (!a.every(test)) return false; }
    if (s.ifNot !== undefined) { var b = [].concat(s.ifNot); if (b.some(function (k) { return !!p[k]; })) return false; }
    return true;
  }

  function blend(buf, i, c, a, mode) {
    var dA = buf[i + 3] / 255;
    if (mode === 'erase') { buf[i + 3] = Math.round(dA * (1 - a) * 255); return; }
    var sA = a, topA, botA, top, bot;
    if (mode === 'under') { top = [buf[i], buf[i + 1], buf[i + 2]]; topA = dA; bot = c; botA = sA; }
    else { top = c; topA = sA; bot = [buf[i], buf[i + 1], buf[i + 2]]; botA = dA; }
    var oA = topA + botA * (1 - topA);
    if (oA <= 0) { buf[i + 3] = 0; return; }
    for (var k = 0; k < 3; k++) buf[i + k] = Math.round((top[k] * topA + bot[k] * botA * (1 - topA)) / oA);
    buf[i + 3] = Math.round(oA * 255);
  }

  function put(ctx, s, lx, ly, c) {
    if (++ctx.ops > OPS_LIMIT) throw new Error('Bản vẽ quá nặng (quá nhiều điểm ảnh phải vẽ)');
    var x = lx + ctx.ox, y = ly + ctx.oy, w = ctx.w, h = ctx.h;
    if (ctx.flip) x = w - 1 - x;
    if (ctx.wrap) { x = mod(x, w); y = mod(y, h); } else if (x < 0 || y < 0 || x >= w || y >= h) return;
    var i = (y * w + x) * 4, buf = ctx.buf, dA = buf[i + 3];
    if (s.clip === 'inside' && dA === 0) return;
    if (s.clip === 'outside' && dA > 0) return;
    if (s._over) {
      if (dA === 0) return;
      var ok = false;
      for (var q = 0; q < s._over.length; q++) { var o = s._over[q]; if (buf[i] === o[0] && buf[i + 1] === o[1] && buf[i + 2] === o[2]) { ok = true; break; } }
      if (!ok) return;
    }
    var al = (c[3] / 255) * (s.alpha === undefined ? 1 : s.alpha);
    if (al <= 0) return;
    blend(buf, i, c, Math.min(1, al), s.mode);
  }

  function painter(s, ctx, rng) {
    var cache = ctx.cc;
    var get = function (e) {
      var key = e;
      if (cache.has(key)) return cache.get(key);
      var c = parseColor(e, ctx.palette);
      if (!c) ctx.warn('Màu không hợp lệ: ' + JSON.stringify(e));
      cache.set(key, c); return c;
    };
    if (Array.isArray(s.colors) && s.colors.length) {
      var list = s.colors.map(function (e) { return typeof e === 'object' && e ? { c: e.color, w: e.weight === undefined ? 1 : e.weight } : { c: e, w: 1 }; });
      var tot = list.reduce(function (a, b) { return a + b.w; }, 0);
      return function (x, y) {
        var r = rng() * tot, k = 0;
        for (; k < list.length - 1; k++) { r -= list[k].w; if (r < 0) break; }
        var c = get(list[k].c); if (c) put(ctx, s, x, y, c);
      };
    }
    var c0 = s.color === undefined ? null : get(s.color);
    if (s.color === undefined) ctx.warn('Thiếu "color" ở layer ' + (s.shape || '?'));
    return function (x, y) { if (c0) put(ctx, s, x, y, c0); };
  }

  function pip(px, py, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function area(s, ctx, rng) {
    var a = Array.isArray(s.area) && s.area.length === 4 ? s.area : [0, 0, ctx.w, ctx.h];
    return a.map(function (v, i) { return Math.round(num(v, i < 2 ? 0 : (i === 2 ? ctx.w : ctx.h), ctx, rng)); });
  }

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function valueNoiseWrap(u, v, Px, Py, salt) {
    var ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash2(mod(ix, Px), mod(iy, Py), salt), b = hash2(mod(ix + 1, Px), mod(iy, Py), salt);
    var c = hash2(mod(ix, Px), mod(iy + 1, Py), salt), d = hash2(mod(ix + 1, Px), mod(iy + 1, Py), salt);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  var SHAPES = {
    rect: function (s, ctx, rng) {
      var x = Math.round(num(s.x, 0, ctx, rng)), y = Math.round(num(s.y, 0, ctx, rng));
      var w = Math.round(num(s.w, 1, ctx, rng)), h = Math.round(num(s.h, 1, ctx, rng)), p = painter(s, ctx, rng);
      for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) p(x + i, y + j);
    },
    ellipse: function (s, ctx, rng) {
      var cx = num(s.cx, 0, ctx, rng), cy = num(s.cy, 0, ctx, rng);
      var rx = Math.max(0.5, num(s.rx, num(s.r, 4, ctx, rng), ctx, rng)), ry = Math.max(0.5, num(s.ry, num(s.r, rx, ctx, rng), ctx, rng)), p = painter(s, ctx, rng);
      for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) p(x, y);
      }
    },
    poly: function (s, ctx, rng) {
      if (!Array.isArray(s.points) || s.points.length < 3) { ctx.warn('poly cần "points" với ít nhất 3 đỉnh'); return; }
      var j = num(s.jitter, 0, ctx, rng);
      var pts = s.points.map(function (p) {
        var x = num(p[0], 0, ctx, rng), y = num(p[1], 0, ctx, rng);
        if (j) { x += Math.round((rng() * 2 - 1) * j); y += Math.round((rng() * 2 - 1) * j); }
        return [x, y];
      });
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      var pt = painter(s, ctx, rng);
      for (var y = Math.floor(y0); y <= Math.ceil(y1); y++) for (var x = Math.floor(x0); x <= Math.ceil(x1); x++) if (pip(x + 0.5, y + 0.5, pts)) pt(x, y);
    },
    line: function (s, ctx, rng) {
      var f = s.from || [0, 0], t = s.to || [0, 0];
      var x0 = num(f[0], 0, ctx, rng), y0 = num(f[1], 0, ctx, rng), x1 = num(t[0], 0, ctx, rng), y1 = num(t[1], 0, ctx, rng);
      var w = Math.max(1, Math.round(num(s.w, 1, ctx, rng))), n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)), p = painter(s, ctx, rng), o = Math.floor(w / 2);
      var seen = {};
      for (var k = 0; k <= n; k++) {
        var cx = Math.round(x0 + ((x1 - x0) * k) / n), cy = Math.round(y0 + ((y1 - y0) * k) / n);
        for (var j = 0; j < w; j++) for (var i = 0; i < w; i++) { var kx = cx - o + i, ky = cy - o + j, key = kx + ',' + ky; if (!seen[key]) { seen[key] = 1; p(kx, ky); } }
      }
    },
    pixels: function (s, ctx, rng) {
      if (!Array.isArray(s.at)) { ctx.warn('pixels cần "at": [[x,y],...]'); return; }
      var p = painter(s, ctx, rng);
      s.at.forEach(function (q) { p(Math.round(num(q[0], 0, ctx, rng)), Math.round(num(q[1], 0, ctx, rng))); });
    },
    scatter: function (s, ctx, rng) {
      var a = area(s, ctx, rng), n = clamp(Math.round(num(s.count, 10, ctx, rng)), 0, 5000), p = painter(s, ctx, rng);
      var sz = Array.isArray(s.size) ? s.size : [s.size === undefined ? 1 : s.size, s.size === undefined ? 1 : s.size];
      var cw = Math.max(1, Math.round(num(sz[0], 1, ctx, rng))), ch = Math.max(1, Math.round(num(sz[1], cw, ctx, rng)));
      for (var i = 0; i < n; i++) {
        var x = a[0] + Math.floor(rng() * a[2]), y = a[1] + Math.floor(rng() * a[3]);
        for (var j = 0; j < ch; j++) for (var k = 0; k < cw; k++) p(x + k, y + j);
      }
    },
    noise: function (s, ctx, rng, id) {
      var a = area(s, ctx, rng), scale = Math.max(1, num(s.scale, 4, ctx, rng)), oct = clamp(Math.round(num(s.octaves, 1, ctx, rng)), 1, 4);
      var contrast = num(s.contrast, 1.8, ctx, rng);
      var bands = Array.isArray(s.bands) ? s.bands.slice().sort(function (p, q) { return p[0] - q[0]; }) : null;
      if (!bands || !bands.length) { ctx.warn('noise cần "bands": [[ngưỡng, màu], ...]'); return; }
      var cols = bands.map(function (b) { return b[1] === null ? null : parseColor(b[1], ctx.palette); });
      var salt = (ctx.seed * 31 + hstr(id)) & 0x7fffffff, Px = Math.max(1, Math.round(ctx.w / scale)), Py = Math.max(1, Math.round(ctx.h / scale));
      for (var y = a[1]; y < a[1] + a[3]; y++) for (var x = a[0]; x < a[0] + a[2]; x++) {
        var v = 0, amp = 1, norm = 0, f = 1;
        for (var o = 0; o < oct; o++) { v += valueNoiseWrap(((x + 0.5) / ctx.w) * Px * f, ((y + 0.5) / ctx.h) * Py * f, Px * f, Py * f, salt + o * 77) * amp; norm += amp; amp *= 0.5; f *= 2; }
        v = clamp(((v / norm) - 0.5) * contrast + 0.5, 0, 0.9999);
        var k = -1; for (var q = 0; q < bands.length; q++) if (v >= bands[q][0]) k = q;
        if (k >= 0 && cols[k]) put(ctx, s, x, y, cols[k]);
      }
    },
    gradient: function (s, ctx, rng) {
      var a = area(s, ctx, rng), list = Array.isArray(s.colors) ? s.colors : [s.from, s.to];
      var cols = list.map(function (c) { return parseColor(c, ctx.palette); });
      if (cols.length < 2 || cols.some(function (c) { return !c; })) { ctx.warn('gradient cần "from"/"to" hoặc "colors" hợp lệ'); return; }
      var dir = s.dir || 'down', steps = cols.length - 1;
      for (var y = 0; y < a[3]; y++) for (var x = 0; x < a[2]; x++) {
        var t;
        if (dir === 'down') t = (y + 0.5) / a[3]; else if (dir === 'up') t = 1 - (y + 0.5) / a[3];
        else if (dir === 'right') t = (x + 0.5) / a[2]; else if (dir === 'left') t = 1 - (x + 0.5) / a[2];
        else t = clamp(Math.hypot((x + 0.5) / a[2] - 0.5, (y + 0.5) / a[3] - 0.5) * 2, 0, 1);
        var pos = clamp(t, 0, 1) * steps, i = Math.min(steps - 1, Math.floor(pos)), fr = pos - i;
        var th = (BAYER[((y + a[1]) & 3) * 4 + ((x + a[0]) & 3)] + 0.5) / 16;
        put(ctx, s, a[0] + x, a[1] + y, fr > th ? cols[i + 1] : cols[i]);
      }
    },
    bevel: function (s, ctx, rng) {
      var snap = new Uint8ClampedArray(ctx.buf), w = ctx.w, h = ctx.h;
      var li = parseColor(s.light === undefined ? '#ffffff' : s.light, ctx.palette), da = parseColor(s.dark === undefined ? '#000000' : s.dark, ctx.palette);
      var la = num(s.lightAlpha, 0.3, ctx, rng), dk = num(s.darkAlpha, 0.3, ctx, rng);
      if (!li || !da) { ctx.warn('bevel: màu không hợp lệ'); return; }
      var empty = function (x, y) {
        if (ctx.wrap) { x = mod(x, w); y = mod(y, h); } else if (x < 0 || y < 0 || x >= w || y >= h) return true;
        return snap[(y * w + x) * 4 + 3] === 0;
      };
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4; if (snap[i + 3] === 0) continue;
        if (empty(x, y - 1) || empty(x - 1, y)) blend(ctx.buf, i, li, la * (li[3] / 255), 'normal');
        else if (empty(x, y + 1) || empty(x + 1, y)) blend(ctx.buf, i, da, dk * (da[3] / 255), 'normal');
      }
    },
    outline: function (s, ctx, rng) {
      var snap = new Uint8ClampedArray(ctx.buf), w = ctx.w, h = ctx.h;
      var c = parseColor(s.color === undefined ? '#1e1410' : s.color, ctx.palette);
      if (!c) { ctx.warn('outline: màu không hợp lệ'); return; }
      var diag = !!s.corners, N = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4; if (snap[i + 3] !== 0) continue;
        var hit = N.some(function (d) {
          var xx = x + d[0], yy = y + d[1];
          if (ctx.wrap) { xx = mod(xx, w); yy = mod(yy, h); } else if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false;
          return snap[(yy * w + xx) * 4 + 3] > 0;
        });
        if (hit) blend(ctx.buf, i, c, (c[3] / 255) * (s.alpha === undefined ? 1 : s.alpha), 'normal');
      }
    },
    group: function (s, ctx, rng, id) {
      if (!Array.isArray(s.layers)) { ctx.warn('group cần "layers": [...]'); return; }
      drawLayers(s.layers, ctx, id + '.');
    }
  };
  SHAPES.circle = function (s, ctx, rng) { SHAPES.ellipse(Object.assign({}, s, { rx: s.r, ry: s.r }), ctx, rng); };

  function drawShape(s, ctx, id) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) { ctx.warn('Một layer không phải object'); return; }
    var fn = SHAPES[s.shape];
    if (!fn) { ctx.warn('Không biết lệnh "' + s.shape + '" (layer ' + id + ')'); return; }
    if (!cond(s, ctx)) return;
    if (Array.isArray(s.onFrames) && s.onFrames.indexOf(ctx.frame) < 0) return;
    var over = null;
    if (s.onlyOver !== undefined) {
      over = [].concat(s.onlyOver).map(function (n) { return parseColor(n, ctx.palette); }).filter(Boolean);
    }
    var sh = over ? Object.assign({}, s, { _over: over }) : s;
    var rep = s.repeat && typeof s.repeat === 'object' ? s.repeat : null;
    var n = rep ? clamp(Math.round(rep.n === undefined ? 1 : rep.n), 0, 500) : 1;
    for (var i = 0; i < n; i++) {
      if (rep && rep.phase && ctx.frame % rep.phase !== i % rep.phase) continue;
      var seed = ((Math.imul(ctx.seed, 7919) ^ hstr(id) ^ Math.imul(i + 1, 1013)) >>> 0);
      var ox = (s.offset && s.offset[0]) || 0, oy = (s.offset && s.offset[1]) || 0;
      if (rep) {
        ox += i * (rep.dx || 0); oy += i * (rep.dy || 0);
        if (rep.jitter) {
          var jr = mulberry32(seed ^ 0x5bd1e995), jx = Array.isArray(rep.jitter) ? rep.jitter[0] : rep.jitter, jy = Array.isArray(rep.jitter) ? rep.jitter[1] : rep.jitter;
          ox += Math.round((jr() * 2 - 1) * jx); oy += Math.round((jr() * 2 - 1) * jy);
        }
      }
      var passes = s.mirror ? [false, true] : [false];
      for (var q = 0; q < passes.length; q++) {
        var sv = { ox: ctx.ox, oy: ctx.oy, flip: ctx.flip };
        ctx.ox += ox; ctx.oy += oy; if (passes[q]) ctx.flip = !ctx.flip;
        fn(sh, ctx, mulberry32(seed), id);
        ctx.ox = sv.ox; ctx.oy = sv.oy; ctx.flip = sv.flip;
      }
    }
  }
  function drawLayers(layers, ctx, prefix) {
    layers.forEach(function (l, i) { drawShape(l, ctx, prefix + i); });
  }

  function renderFrame(def, o) {
    var ctx = { w: o.w, h: o.h, buf: new Uint8ClampedArray(o.w * o.h * 4), palette: def.palette && typeof def.palette === 'object' ? def.palette : {}, seed: o.seed, frame: o.frame, params: o.params, warn: o.warn, wrap: o.wrap, ox: 0, oy: 0, flip: false, ops: 0, cc: new Map() };
    if (def.bg !== undefined) {
      var c = parseColor(def.bg, ctx.palette);
      if (c) for (var i = 0; i < o.w * o.h; i++) { ctx.buf[i * 4] = c[0]; ctx.buf[i * 4 + 1] = c[1]; ctx.buf[i * 4 + 2] = c[2]; ctx.buf[i * 4 + 3] = c[3]; }
      else o.warn('"bg" không phải màu hợp lệ');
    }
    drawLayers(def.layers, ctx, 'L');
    return ctx.buf;
  }

  /** render(def, {seed, params}) -> {w,h,frames:[Uint8ClampedArray],fps,warnings:[]} */
  function render(def, opts) {
    opts = opts || {};
    var warns = [], warn = function (m) { if (warns.indexOf(m) < 0) warns.push(m); };
    if (!def || typeof def !== 'object' || Array.isArray(def)) throw new Error('JSON phải là một object { ... }');
    if (!Array.isArray(def.layers)) throw new Error('Thiếu mảng "layers": [ ... ]');
    var size = Array.isArray(def.size) ? def.size : [32, 32];
    var w = clamp(Math.round(+size[0] || 32), 1, 512), h = clamp(Math.round(+size[1] || 32), 1, 512);
    var seed = (opts.seed !== undefined ? opts.seed : def.seed !== undefined ? def.seed : 1) | 0;
    var nf = def.animate && def.animate.frames > 1 ? clamp(Math.round(def.animate.frames), 2, 16) : 1;
    var params = Object.assign({}, def.params || {}, opts.params || {});
    var wrap = def.wrap !== undefined ? !!def.wrap : def.type === 'tile';
    var frames = [];
    for (var f = 0; f < nf; f++) frames.push(renderFrame(def, { w: w, h: h, seed: seed, frame: f, params: params, warn: warn, wrap: wrap }));
    return { w: w, h: h, frames: frames, fps: (def.animate && def.animate.fps) || 4, warnings: warns, anchor: def.anchor, footprint: def.footprint, type: def.type || 'prop' };
  }

  root.Blueprint = { render: render, parseColor: parseColor, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);

