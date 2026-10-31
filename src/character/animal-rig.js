// Procedural pixel animals. One drawing routine per body type (quadruped, hopper, biped, fish); each species only supplies
// its palette and proportions (src/data/animals/bodies.json) and each body type its own clips (src/data/animals/anims/<body>.json).
// Everything faces right; callers mirror the sprite for the other direction.

const rad = (d) => (d * Math.PI) / 180;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const shade = (c, k) => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k), 255];
const num = (o, k, d) => (o && typeof o[k] === 'number' ? o[k] : d);

function buf(w, h) { return { w, h, d: new Uint8ClampedArray(w * h * 4) }; }
function put(b, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = (y * b.w + x) * 4; b.d[i] = c[0]; b.d[i + 1] = c[1]; b.d[i + 2] = c[2]; b.d[i + 3] = c[3];
}
function rect(b, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function ell(b, cx, cy, rx, ry, c) {
  rx = Math.max(0.5, rx); ry = Math.max(0.5, ry);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) put(b, x, y, c);
  }
}
function line(b, x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)), o = Math.floor(w / 2);
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) put(b, x - o + i, y - o + j, c);
  }
}
function poly(b, pts, c) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j], px = x + 0.5, py = y + 0.5;
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) put(b, x, y, c);
  }
}
/** Dark rim around the silhouette, like the blueprint outline. */
function outline(b, c) {
  const snap = new Uint8ClampedArray(b.d);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (snap[(y * b.w + x) * 4 + 3]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < b.w && ny < b.h && snap[(ny * b.w + nx) * 4 + 3]) { put(b, x, y, c); break; }
    }
  }
}
function flipY(b) {
  const o = new Uint8ClampedArray(b.d);
  for (let y = 0; y < b.h; y++) b.d.set(o.subarray((b.h - 1 - y) * b.w * 4, (b.h - y) * b.w * 4), y * b.w * 4);
}

function colors(def) {
  const P = def.palette, base = hex(P.base);
  return { base, light: hex(P.light), dark: hex(P.dark), acc: hex(P.accent), eye: hex(P.eye), far: shade(base, 0.72), rim: shade(hex(P.dark), 0.5), beak: P.beak ? hex(P.beak) : hex(P.accent) };
}

// ------------------------------------------------------------------ four legs: deer, boar, wolf
function quadruped(b, def, f) {
  const S = def.shape, C = colors(def), has = (n) => S.feature === n || (Array.isArray(S.features) && S.features.includes(n)), gy = b.h - 2, lay = num(f, 'lay', 0), side = num(f, 'side', 0);
  const legL = Math.max(2, S.legL * (1 - lay * 0.75)), bodyH = S.bodyH * (1 - 0.18 * side);
  const rise = num(f, 'rise', 0), bob = num(f, 'bob', 0);
  const cx = b.w / 2 - 4, cy = gy - legL - bodyH / 2 + 1 + bob + lay * 1.5;
  const hipX = cx - S.bodyL / 2 + 3, shX = cx + S.bodyL / 2 - 3, jy = cy + bodyH / 2 - 1;
  const leg = (x, p, col, w) => {
    const a = num(p, 'a', 0), lift = num(p, 'lift', 0);
    const fx = x + Math.sin(rad(a)) * legL, fy = Math.min(gy, jy + Math.cos(rad(a)) * legL - lift);
    line(b, x, jy, fx, fy, w, col); put(b, fx, fy, C.dark); put(b, fx + (a > 0 ? 1 : 0), fy, C.dark);
  };
  const thick = S.legW || 2;
  leg(hipX - 1, f.br, C.far, thick); leg(shX - 1, f.fr, C.far, thick);
  // body: a chain of ellipses so the front can rise (rearing, pouncing)
  for (let i = 0; i <= 4; i++) { const t = i / 4; ell(b, cx - S.bodyL / 2 + 2 + t * (S.bodyL - 4), cy - rise * t, S.bodyL / 4 + 1.5, bodyH / 2, C.base); }
  for (let i = 0; i <= 4; i++) { const t = i / 4; ell(b, cx - S.bodyL / 2 + 2 + t * (S.bodyL - 4), cy - rise * t + bodyH * 0.22, S.bodyL / 4 + 0.5, bodyH * 0.27, C.light); }
  for (let i = 0; i <= 4; i++) { const t = i / 4; ell(b, cx - S.bodyL / 2 + 2 + t * (S.bodyL - 4), cy - rise * t - bodyH * 0.32, S.bodyL / 4 + 1, bodyH * 0.2, C.dark); }
  if (has('antlers')) for (const [dx, dy] of [[-4, -1], [0, -2], [4, -1], [-2, 1], [2, 1]]) put(b, cx + dx, cy - bodyH * 0.2 + dy, C.light);
  if (has('tusks')) for (let i = 0; i < S.bodyL - 4; i += 2) put(b, cx - S.bodyL / 2 + 3 + i, cy - bodyH / 2 - 1 - rise * (i / S.bodyL), C.dark); // bristle mane
  if (has('bear')) ell(b, shX - 1, cy - bodyH / 2 - rise, 4, 3, C.base); // shoulder hump
  if (has('shaggy')) for (let i = 0; i < S.bodyL - 2; i += 2) { const sx2 = cx - S.bodyL / 2 + 2 + i; line(b, sx2, cy + bodyH / 2 - 2, sx2 - 1, cy + bodyH / 2 + 3, 1, C.dark); } // long hair hanging
  leg(hipX + 1, f.bl, C.base, thick); leg(shX + 1, f.fl, C.base, thick);
  // neck and head
  const sx = shX + 1, sy = cy - bodyH / 2 + 2 - rise, ang = rad(num(f.head, 'a', S.neckA)), dy = num(f.head, 'dy', 0);
  const hx = sx + Math.cos(ang) * S.neck, hy = sy - Math.sin(ang) * S.neck + dy;
  line(b, sx, sy, hx, hy, Math.max(2, Math.round(bodyH * 0.45)), C.base);
  if (has('mane')) ell(b, hx - 2, hy + 1, S.headR + 3, S.headR + 3, C.dark);
  if (has('trunk')) ell(b, hx - 1, hy - S.headR * 0.6, S.headR * 0.9, S.headR * 0.8, C.base); // domed forehead
  ell(b, hx, hy, S.headR * 1.1, S.headR, C.base);
  const open = num(f, 'mouth', 0) > 0.5;
  ell(b, hx + S.headR + S.snout / 2 - 1, hy + 1 - (open ? 1 : 0), S.snout / 2 + 1, S.headR * 0.55, C.light);
  const nx = hx + S.headR + S.snout - 1;
  put(b, nx, hy + (open ? 0 : 1), C.dark);
  if (open) { rect(b, hx + 1, hy + 1, S.snout + 2, 2, C.rim); put(b, hx + S.headR + 1, hy + 1, C.acc); put(b, hx + S.headR + 3, hy + 1, C.acc); }
  if (has('tusks')) { put(b, nx - 1, hy + 2, C.acc); put(b, nx - 1, hy + 1, C.acc); }
  const asleep = lay > 0.5;
  if (asleep) put(b, hx + 1, hy - 1, C.dark); else put(b, hx + 1, hy - 1, C.eye);
  const earL = S.ear || 3;
  if (has('bear')) ell(b, hx - 2, hy - S.headR + 1, 1.8, 1.8, C.dark);
  else poly(b, [[hx - 2, hy - S.headR + 1], [hx - 3 - (asleep ? 2 : 0), hy - S.headR - earL + (asleep ? 3 : 0)], [hx, hy - S.headR]], C.dark);
  if (has('antlers')) {
    const t = hy - S.headR;
    line(b, hx, t, hx - 3, t - 7, 1, C.acc); line(b, hx - 1, t - 3, hx + 2, t - 6, 1, C.acc); line(b, hx - 2, t - 5, hx - 5, t - 8, 1, C.acc);
  }
  if (has('horns')) {
    const t = hy - S.headR, h = S.horn || 5, back = !!S.hornBack;
    for (const dx of [-1, 1]) {
      const bx = hx + dx, tipx = back ? bx - h * 0.8 : bx + (dx > 0 ? 3 : -1), tipy = t - h * (back ? 0.9 : 0.8);
      line(b, bx, t, tipx, tipy, 1, C.acc); put(b, tipx, tipy - 1, C.acc);
    }
  }
  if (has('palmate')) {
    const t = hy - S.headR;
    for (const side of [-1, 1]) {
      const bx = hx + side * 2;
      line(b, bx, t, bx + side * 4, t - 5, 1, C.acc);
      for (let k = 0; k < 4; k++) line(b, bx + side * (3 + k), t - 4 - (k % 2), bx + side * (4 + k), t - 8 - k, 1, C.acc);
    }
  }
  if (has('trunk')) {
    const tl = S.trunk || 12, sway = num(f, 'bob', 0);
    line(b, hx + S.headR - 1, hy + 1, hx + S.headR + 1 + sway, hy + tl * 0.7, 3, C.base); line(b, hx + S.headR + 1 + sway, hy + tl * 0.7, hx + S.headR + 3 + sway, hy + tl, 2, C.base);
    line(b, hx + S.headR - 2, hy + 3, hx + S.headR + 5, hy + 9, 2, C.acc); put(b, hx + S.headR + 6, hy + 8, C.acc); // tusk curling forward
  }
  // tail
  const tb = [cx - S.bodyL / 2 - 1, cy - bodyH * 0.25], ta = rad(num(f.tail !== undefined ? { a: f.tail } : null, 'a', 15)), tl = S.tail;
  const tx = tb[0] - Math.cos(ta) * tl, ty = tb[1] - Math.sin(ta) * tl;
  line(b, tb[0], tb[1], tx, ty, has('bushy') ? 3 : 2, C.base);
  if (has('bushy')) ell(b, tx, ty, 2, 2, C.dark);
  outline(b, C.rim);
}

// ------------------------------------------------------------------ hopping: rabbit
function hopper(b, def, f) {
  const S = def.shape, C = colors(def), gy = b.h - 2, lay = num(f, 'lay', 0), side = num(f, 'side', 0);
  const lift = num(f, 'lift', 0), stretch = num(f, 'stretch', 0), crouch = num(f, 'crouch', 0);
  const bodyH = S.bodyH - crouch * 0.6 - side * 1.5, L = S.bodyL + stretch, cx = b.w / 2 - 2;
  const cy = gy - bodyH / 2 - 2 - lift + lay * 1.5, hind0 = cx - L / 2 + 2, jy = cy + bodyH / 2 - 1;
  // hind foot, then body, then forelegs, head, ears
  const ha = rad(num(f.hind, 'a', 0)), hl = S.legL * 1.4;
  const fx = hind0 + Math.sin(ha) * hl, fy = Math.min(gy, jy + Math.cos(ha) * S.legL);
  line(b, hind0, jy, fx, fy, 2, C.far); rect(b, Math.round(fx), Math.round(fy), 3, 1, C.dark);
  ell(b, cx, cy, L / 2, bodyH / 2, C.base);
  ell(b, cx + 1, cy + bodyH * 0.25, L / 2 - 1, bodyH * 0.27, C.light);
  ell(b, hind0 + 1, cy + 1, 3.5, bodyH / 2, C.base);
  const fa = rad(num(f.fore, 'a', 0)), fl = S.legL * 0.8, fx0 = cx + L / 2 - 1;
  line(b, fx0, jy, fx0 + Math.sin(fa) * fl, Math.min(gy, jy + Math.cos(fa) * fl), 1, C.base);
  const hx = cx + L / 2 + 1, hy = cy - 1 + num(f, 'headDy', 0) + lay;
  ell(b, hx, hy, S.headR, S.headR * 0.9, C.base);
  ell(b, hx + S.headR - 1, hy + 1, 1.8, 1.2, C.light);
  put(b, hx + S.headR + 1, hy + 1, C.dark);
  if (num(f, 'mouth', 0) > 0.5) { put(b, hx + S.headR, hy + 2, C.rim); put(b, hx + S.headR - 1, hy + 2, C.acc); }
  put(b, hx + 1, hy - 1, lay > 0.5 ? C.dark : C.eye);
  const e = rad(num(f, 'ear', 10)), el = S.ear;
  for (const ox of [-1, 1]) {
    const bx = hx - 1 + ox, by = hy - S.headR + 1, tx = bx - Math.sin(e) * el - ox * 0.5, ty = by - Math.cos(e) * el;
    line(b, bx, by, tx, ty, 2, C.base); line(b, bx, by - 1, tx, ty + 1, 1, C.light);
  }
  ell(b, hind0 - 2, cy, 1.8, 1.8, C.acc);
  outline(b, C.rim);
}

// ------------------------------------------------------------------ two legs: wild fowl
function biped(b, def, f) {
  const S = def.shape, C = colors(def), gy = b.h - 2, lay = num(f, 'lay', 0), side = num(f, 'side', 0);
  const legL = Math.max(2, S.legL * (1 - lay * 0.7)), bodyH = S.bodyH - side * 2, bob = num(f, 'bob', 0);
  const cx = b.w / 2 - 2, cy = gy - legL - bodyH / 2 + bob + lay;
  const leg = (x, p, col) => {
    const a = num(p, 'a', 0), lift = num(p, 'lift', 0), jy = cy + bodyH / 2 - 1;
    const fx = x + Math.sin(rad(a)) * legL, fy = Math.min(gy, jy + Math.cos(rad(a)) * legL - lift);
    line(b, x, jy, fx, fy, 1, col); rect(b, Math.round(fx), Math.round(fy), 3, 1, col);
  };
  leg(cx - 1, f.r, shade(C.beak, 0.7)); // far leg
  ell(b, cx - 2, cy + 1, S.bodyL / 2 - 1, bodyH / 2, C.base);
  ell(b, cx + 1, cy, S.bodyL / 2 - 1, bodyH / 2, C.base);
  ell(b, cx, cy + bodyH * 0.25, S.bodyL / 2 - 2, bodyH * 0.27, C.light);
  // tail feathers fan
  const ta = num(f, 'tail', 0);
  for (const base of [35, 55, 75]) { const a = rad(base + ta); line(b, cx - S.bodyL / 2 + 1, cy - 1, cx - S.bodyL / 2 + 1 - Math.cos(a) * S.tail, cy - 1 - Math.sin(a) * S.tail, 1, base === 55 ? C.dark : C.base); }
  // wing; a flap raises it
  const flap = num(f, 'wing', 0);
  ell(b, cx - 1, cy, 3.5, 2.5, C.dark);
  if (flap > 25) line(b, cx - 1, cy - 1, cx - 2 - flap / 14, cy - 2 - flap / 10, 2, C.dark);
  leg(cx + 1, f.l, C.beak);
  // neck and head
  const nx = cx + S.bodyL / 2 - 2, ny = cy - bodyH / 2 + 2, nk = f.neck || {};
  const hx = nx + 2 + num(nk, 'dx', 0), hy = ny - S.neck * 0.8 + num(nk, 'dy', 0) + num(f, 'headDy', 0) + lay * 2;
  line(b, nx, ny, hx, hy, 2, C.base);
  ell(b, hx, hy, S.headR + 0.5, S.headR, C.base);
  const open = num(f, 'mouth', 0) > 0.5;
  poly(b, [[hx + S.headR, hy - 1], [hx + S.headR + 3, hy + (open ? -1 : 0)], [hx + S.headR, hy + 1]], C.beak);
  if (open) put(b, hx + S.headR + 1, hy + 1, C.rim);
  put(b, hx, hy - 1, lay > 0.5 ? C.dark : C.eye);
  rect(b, hx - 1, hy - S.headR - 1, 2, 2, C.acc); put(b, hx + S.headR, hy + 2, C.acc);
  outline(b, C.rim);
}

// ------------------------------------------------------------------ fish
function fish(b, def, f) {
  const S = def.shape, C = colors(def), flip = num(f, 'flip', 0) >= 0.5;
  const bend = num(f, 'bend', 0), fin = num(f, 'fin', 0), cx = b.w / 2 + 2, cy = b.h / 2 + num(f, 'bob', 0) - (flip ? 1 : 0);
  const rx = cx - S.bodyL / 2, ry = cy + bend * 0.4, T = S.tail + fin;
  poly(b, [[rx - T, ry - 3 + bend * 0.5], [rx, ry], [rx - T, ry + 3 + bend * 0.5]], C.acc); // tail fin
  poly(b, [[cx + S.bodyL / 2, cy], [cx + 3, cy - S.bodyH / 2], [cx - 3, cy - S.bodyH / 3 + bend * 0.15], [rx, ry - 1], [rx, ry + 1], [cx - 3, cy + S.bodyH / 3 + bend * 0.15], [cx + 3, cy + S.bodyH / 2]], C.base);
  poly(b, [[cx + S.bodyL / 2 - 1, cy + 1], [cx - 3, cy + 1 + bend * 0.1], [cx - 3, cy + S.bodyH / 3 + bend * 0.15], [cx + 3, cy + S.bodyH / 2 - 1]], C.light);
  poly(b, [[cx - 1, cy - S.bodyH / 2 + 1], [cx + 2, cy - S.bodyH / 2 - 2], [cx + 3, cy - S.bodyH / 2 + 1]], C.acc);
  poly(b, [[cx + 1, cy + S.bodyH / 3], [cx - 1, cy + S.bodyH / 3 + 2], [cx + 2, cy + S.bodyH / 3 + 1]], C.acc);
  for (let i = 0; i < 4; i++) put(b, cx - 2 + i * 2, cy - 1 + (i % 2) * 2, C.dark);
  put(b, cx + S.bodyL / 2 - 3, cy - 1, flip ? C.dark : C.eye);
  if (num(f, 'mouth', 0) > 0.5) put(b, cx + S.bodyL / 2, cy, C.rim);
  outline(b, C.rim);
  if (flip) flipY(b);
}

const DRAW = { quadruped, hopper, biped, fish };

/** Draw one frame of a clip. Returns { w, h, data } RGBA, facing right. */
export function renderAnimal(def, clip, frameIdx) {
  const b = buf(def.size[0], def.size[1]);
  const frames = clip.frames, f = frames[Math.max(0, Math.min(frames.length - 1, frameIdx))] || {};
  (DRAW[def.body] || quadruped)(b, def, f);
  return { w: b.w, h: b.h, data: b.d };
}
