// Lõi vẽ nhân vật procedural (giữ JS thuần, kiểu dữ liệu khai báo trong rig.d.ts).
/* ---- Lõi vẽ dân pixel: không phụ thuộc DOM ---- */
const W = 40, H = 48, CX = 20;
const rad = d => d * Math.PI / 180;
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mul = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

function palette(look, kind) {
  const skin = hexRgb(look.skin), hair = hexRgb(look.hair), hide = hexRgb(look.hide), pants = hexRgb(look.pants || '#3f63a8');
  return {
    skin, skinD: mul(skin, 0.8), cheek: [Math.min(255, skin[0] + 18), Math.round(skin[1] * 0.86), Math.round(skin[2] * 0.86)], mouth: mul(skin, 0.6), hair, hairD: mul(hair, 0.72), hairL: mul(hair, 1.45),
    pants, pantsD: mul(pants, 0.72), pantsL: mul(pants, 1.25),
    hide, hideD: mul(hide, 0.7),
    wood: [139, 94, 52], woodD: [104, 70, 38], woodL: [196, 160, 108],
    cb: (kind === 'stone' ? [120, 126, 130] : kind === 'food' ? [150, 60, 60] : [139, 94, 52]),
    cbD: (kind === 'stone' ? [84, 90, 94] : kind === 'food' ? [96, 40, 44] : [104, 70, 38]),
    cbL: (kind === 'stone' ? [182, 188, 192] : kind === 'food' ? [220, 110, 100] : [196, 160, 108]),
    stone: [142, 148, 150], stoneD: [98, 104, 108], stoneL: [192, 198, 198],
    tw: [184, 140, 84], twD: [128, 92, 52], twL: [222, 184, 126],
    eye: [30, 20, 16], line: [30, 20, 16]
  };
}

function put(b, x, y, c, a) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = a === undefined ? 255 : a;
}
function rect(b, x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c);
}
function line(b, x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    rect(b, Math.round(cx - w / 2), Math.round(cy - w / 2), w, w, c);
  }
}

function rr(b, x, y, w, h, c) { rect(b, x + 1, y, w - 2, h, c); rect(b, x, y + 1, w, h - 2, c); }

const HM = {
  front: [
    '..HHHHHHHH..', '.HLLLHHHHHH.', 'HHLLHHHHHHHH', 'HHHHHHHHHHHH',
    'HHSHHHSHHSHH', 'HSSSSSSSSSSH', 'HSSESSSSESSH', 'sSSESSSSESSs',
    '.ScSSSSSScS.', '.SSSSmmSSSS.', '..ssssssss..'],
  back: [
    '..HHHHHHHH..', '.HLLLHHHHHH.', 'HHLLHHHHHHHH', 'HHHHHHHHHHHH',
    'HHHHHDDHHHHH', 'HHHHHHDHHHHH', 'HHHHHHHHHHHH', 'HDHHHHHHHHDH',
    '.DDDDDDDDDD.', '..SSSSSSSS..', '..ssssssss..'],
  side: [
    '..HHHHHHHH...', '.HLLLHHHHHH..', 'HHLLHHHHHHHH.', 'HHHHHHHHHHHH.',
    'HHHHHHHHHHSS.', 'HHHHHHSSSSSS.', 'HHHHHHsSSESS.', 'HHHHHHsSSESSS',
    'HHHHHHSSScSS.', 'DDDDDDSSSSmS.', '.DDDDsssss...']
};
function femaleOf(view) {
  const m = HM[view], out = [];
  if (view === 'side') {
    m.forEach((r, i) => out.push(i < 3 ? '..' + r : 'HH' + (i === 10 ? r.replace(/^\./, 'H') : r)));
    out.push('.HHHDDD........', '..HDDDD........', '...DDD.........');
    return out;
  }
  m.forEach((r, i) => {
    if (i < 3) { out.push('.' + r + '.'); return; }
    let x = r;
    if (view === 'front' && i >= 5) x = x.replace(/^[.sS]/, 'H').replace(/[.sS]$/, 'H');
    out.push('H' + x + 'H');
  });
  if (view === 'front') out.push('HD..........DH', '.DD........DD.');
  else { out.splice(8, 3, 'HHHHHHHHHHHHHH', 'HHHHHHHHHHHHHH', 'HDHHHHHHHHHHDH'); out.push('.DDHHHHHHHHDD.', '..DDDDDDDDDD..'); }
  return out;
}
const HF = { front: femaleOf('front'), back: femaleOf('back'), side: femaleOf('side') };

function drawHead(b, view, hx, hy, P, sex) {
  const F = sex === 'f', rows = (F ? HF : HM)[view];
  const ox = F ? (view === 'side' ? -2 : -1) : 0;
  const col = { H: P.hair, L: P.hairL, D: P.hairD, S: P.skin, s: P.skinD, E: P.eye, c: P.cheek, m: P.mouth };
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = col[r[i]]; if (c) put(b, hx + ox + i, hy + j, c); } });
}

function drawTorso(b, x, y, view, P, sex) {
  const F = sex === 'f';
  if (view === 'side') {
    rect(b, x, y, 7, 6, P.skin); rect(b, x + 6, y, 1, 6, P.skinD);
    if (F) rect(b, x, y, 7, 3, P.hide);
    else for (let i = 0; i < 6; i++) rect(b, x + i, y + i, 2, 1, P.hide);
    rect(b, x, y + 6, 7, 1, P.hideD); rect(b, x, y + 7, 7, 3, P.pants); rect(b, x, y + 10, 7, 1, P.pantsD);
    rect(b, x, y + 7, 1, 3, P.pantsL);
    return;
  }
  const front = view === 'front';
  rect(b, x, y, 10, 6, P.skin);
  rect(b, x, y + 1, 1, 5, P.skinD); rect(b, x + 9, y + 1, 1, 5, P.skinD);
  if (F) { rect(b, x, y, 10, 3, P.hide); rect(b, x, y + 3, 10, 1, P.hideD); }
  else for (let i = 0; i < 6; i++) rect(b, front ? x + i : x + 8 - i, y + i, 2, 1, P.hide);
  rect(b, x, y + 6, 10, 1, P.hideD);
  rect(b, x, y + 7, 10, 3, P.pants); rect(b, x, y + 10, 10, 1, P.pantsD);
  rect(b, x + 1, y + 7, 2, 2, P.pantsL); rect(b, x + 4, y + 8, 2, 3, P.pantsD);
}

function drawCharacter(b, view, f, P, sex, ov) {
  const side = view === 'side', back = view === 'back', front = view === 'front';
  const bob = f.bob || 0, lean = f.lean || 0;
  const tool = f.tool && f.tool.on ? f.tool : null;
  const carry = f.carry && f.carry.on ? f.carry : null;
  const hold = !!(tool || carry);
  const tDx = side ? Math.trunc(lean / 2) : 0, hDx = side ? lean : 0;
  const hipY = 35 + bob, shY = 27 + bob, TY = 25 + bob, HY = 14 + bob;
  const gl = (o, k, d) => (o && typeof o[k] === 'number') ? o[k] : d;

  const leg = (L, hx, col) => {
    const a = rad(gl(L, 'a', 0));
    const fx = side ? hx + 7 * Math.sin(a) : hx;
    const fy = 42 - gl(L, 'lift', 0) - 7 * (1 - Math.cos(a));
    line(b, hx, hipY, fx, fy, 3, col);
    rect(b, Math.round(fx) - 1, Math.round(fy) + 1, 3, 1, P.skinD);
  };
  const armPts = (A, sx) => {
    const a1 = gl(A, 'a', 0), a2 = a1 + gl(A, 'b', 0), L = 3.5;
    if (side) {
      const ex = sx + L * Math.sin(rad(a1)), ey = shY + L * Math.cos(rad(a1));
      return { sx, ex, ey, hx: ex + L * Math.sin(rad(a2)), hy: ey + L * Math.cos(rad(a2)) };
    }
    const k = (hold && !back) ? 0.55 : 0;
    const ey = shY + L * Math.cos(rad(a1));
    return { sx, ex: sx + (CX - sx) * k * 0.4, ey, hx: sx + (CX - sx) * k, hy: ey + L * Math.cos(rad(a2)) };
  };
  const arm = (p, col) => {
    line(b, p.sx, shY, p.ex, p.ey, 3, col);
    line(b, p.ex, p.ey, p.hx, p.hy, 3, col);
  };
  const axe = (hx, hy) => {
    // ov = { kind, tier }: công cụ dân đang cầm. tier 0 = tay không, 1 = gỗ, 2 = đá.
    const tier = ov && ov.tier !== undefined ? ov.tier : 2;
    if (tier <= 0) return;
    const a = rad(tool.a || 0);
    const ex = side ? hx + 7 * Math.sin(a) : hx, ey = hy + 7 * Math.cos(a);
    line(b, hx, hy, ex, ey, 1, P.wood);
    const bx = Math.round(ex), by = Math.round(ey), kind = (ov && ov.kind) || tool.kind || 'axe';
    const C = tier === 1 ? P.tw : P.stone, CL = tier === 1 ? P.twL : P.stoneL, CD = tier === 1 ? P.twD : P.stoneD;
    if (kind === 'pick') {
      rect(b, bx - 3, by - 1, 7, 2, C); rect(b, bx - 3, by - 1, 7, 1, CL); rect(b, bx - 3, by, 1, 2, CD); rect(b, bx + 3, by, 1, 2, CD);
    } else if (kind === 'hammer') {
      rect(b, bx - 2, by - 2, 5, 4, C); rect(b, bx - 2, by - 2, 5, 1, CL); rect(b, bx + 2, by - 1, 1, 3, CD);
    } else if (kind === 'hoe') {
      if (side) { rect(b, bx, by - 1, 4, 2, C); rect(b, bx, by - 1, 4, 1, CL); rect(b, bx + 3, by, 1, 3, CD); }
      else { rect(b, bx - 2, by - 1, 5, 2, C); rect(b, bx - 2, by - 1, 5, 1, CL); rect(b, bx - 2, by, 1, 3, CD); }
    } else if (kind === 'shovel') {
      rect(b, bx - 1, by, 3, 4, C); rect(b, bx - 1, by, 3, 1, CL); rect(b, bx + 1, by + 1, 1, 3, CD); rect(b, bx, by + 3, 1, 1, CD);
    } else if (side) {
      rect(b, bx - 1, by - 1, 4, 3, C); rect(b, bx - 1, by - 1, 4, 1, CL); rect(b, bx + 2, by, 1, 2, CD);
    } else {
      rect(b, bx - 2, by - 1, 5, 3, C); rect(b, bx - 2, by - 1, 5, 1, CL); rect(b, bx + 2, by, 1, 2, CD);
    }
  };
  const bundle = () => {
    const dy = gl(carry, 'dy', 0) + bob;
    if (side) {
      const x = CX + 2 + tDx, y = 28 + dy;
      rect(b, x, y, 7, 6, P.cb); rect(b, x, y + 5, 7, 1, P.cbD);
      [[1, 1], [3, 1], [5, 1], [2, 3], [4, 3]].forEach(([i, j]) => put(b, x + i, y + j, P.cbL));
    } else if (!back) {
      const x = CX - 7, y = 28 + dy;
      rect(b, x, y, 14, 2, P.cb); rect(b, x, y + 2, 14, 2, P.cbD); rect(b, x + 1, y + 4, 12, 2, P.cb);
      rect(b, x, y, 1, 2, P.cbL); rect(b, x + 13, y + 2, 1, 2, P.cbL); rect(b, x + 1, y + 4, 1, 2, P.cbL);
    } else {
      rect(b, CX - 8, 29 + bob, 1, 3, P.cbL); rect(b, CX + 7, 29 + bob, 1, 3, P.cbL);
    }
  };

  if (side) {
    const hx0 = CX + 0.5;
    const pL = armPts(f.armL, hx0 + tDx), pR = armPts(f.armR, hx0 + tDx);
    arm(pL, P.skinD);
    leg(f.legL, hx0, P.skinD);
    leg(f.legR, hx0, P.skin);
    drawTorso(b, CX - 3 + tDx, TY, 'side', P, sex);
    drawHead(b, 'side', CX - 6 + hDx, HY, P, sex);
    if (carry) bundle();
    arm(pR, P.skin);
    if (tool) axe(pR.hx, pR.hy);
    return;
  }
  const pR = armPts(f.armR, front ? CX - 5.5 : CX + 5.5);
  const pL = armPts(f.armL, front ? CX + 5.5 : CX - 5.5);
  if (back && tool) axe(CX + 6, (pR.hy + pL.hy) / 2);
  leg(f.legR, front ? CX - 2.5 : CX + 2.5, P.skin);
  leg(f.legL, front ? CX + 2.5 : CX - 2.5, P.skin);
  if (!hold || back) { arm(pR, P.skin); arm(pL, P.skin); }
  drawTorso(b, CX - 5, TY, view, P, sex);
  drawHead(b, view, CX - 6, HY, P, sex);
  if (hold) {
    if (carry) bundle();
    if (!back) { arm(pR, P.skin); arm(pL, P.skin); }
    if (!back && tool) axe(CX - 0.5, (pR.hy + pL.hy) / 2);
  }
}

function outline(b, c) {
  const o = new Uint8ClampedArray(b);
  const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (b[i + 3]) continue;
    const touch = N.some(([dx, dy]) => {
      const xx = x + dx, yy = y + dy;
      return xx >= 0 && yy >= 0 && xx < W && yy < H && b[(yy * W + xx) * 4 + 3] > 0;
    });
    if (touch) { o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255; }
  }
  return o;
}
function shadow(b, dx) {
  [[43, -7, 14], [44, -7, 14], [45, -5, 10]].forEach(([y, x0, n]) => {
    for (let i = 0; i < n; i++) {
      const x = CX + dx + x0 + i, k = (y * W + x) * 4;
      if (x >= 0 && x < W && !b[k + 3]) { b[k] = 0; b[k + 1] = 0; b[k + 2] = 0; b[k + 3] = 70; }
    }
  });
}
function flipH(b) {
  const o = new Uint8ClampedArray(b.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = (y * W + x) * 4, d = (y * W + (W - 1 - x)) * 4;
    o[d] = b[s]; o[d + 1] = b[s + 1]; o[d + 2] = b[s + 2]; o[d + 3] = b[s + 3];
  }
  return o;
}

/* view: front | back | right | left (left = right lật ngang) */
function renderFrame(anims, name, idx, view, look, kind, toolOv) {
  const an = anims[name];
  const f = an.frames[((idx % an.frames.length) + an.frames.length) % an.frames.length];
  const P = palette(look, kind);
  const b = new Uint8ClampedArray(W * H * 4);
  const v = (view === 'left' || view === 'right') ? 'side' : view;
  drawCharacter(b, v, f, P, look.sex, toolOv);
  const o = outline(b, P.line);
  shadow(o, v === 'side' ? 1 : 0);
  return view === 'left' ? flipH(o) : o;
}

/* ---- Dữ liệu keyframe mặc định ---- */
function defaultAnims() {
  const r = Math.round;
  const idle = [0, 1, 2, 3].map(i => ({
    bob: [0, 0, 1, 1][i], lean: 0,
    legR: { a: 2, lift: 0 }, legL: { a: -2, lift: 0 },
    armR: { a: [4, 6, 8, 6][i], b: 8 }, armL: { a: [-4, -6, -8, -6][i], b: 8 }
  }));
  const walk = (amp, armAmp, holdArms) => [0, 1, 2, 3, 4, 5].map(i => {
    const p = rad(i * 60), s = Math.sin(p), c = Math.cos(p);
    const fr = {
      bob: Math.abs(s) < 0.5 ? -1 : 0, lean: 1,
      legR: { a: r(amp * s) + 0, lift: Math.max(0, r(c * 2)) },
      legL: { a: r(-amp * s) + 0, lift: Math.max(0, r(-c * 2)) }
    };
    if (holdArms) {
      fr.armR = { a: 48, b: 50 }; fr.armL = { a: 52, b: 46 };
      fr.carry = { on: true, dy: 0 };
    } else {
      fr.armR = { a: r(-armAmp * s) + 0, b: 14 }; fr.armL = { a: r(armAmp * s) + 0, b: 14 };
    }
    return fr;
  });
  const chop = [
    { bob: 0, lean: 0, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 80, b: 40 }, armL: { a: 70, b: 40 }, tool: { on: true, a: 165 } },
    { bob: -1, lean: -1, legR: { a: 12, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 125, b: 25 }, armL: { a: 115, b: 25 }, tool: { on: true, a: 195 } },
    { bob: -1, lean: -2, legR: { a: 10, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 150, b: 15 }, armL: { a: 140, b: 15 }, tool: { on: true, a: 215 } },
    { bob: 0, lean: 1, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 100, b: 20 }, armL: { a: 92, b: 20 }, tool: { on: true, a: 130 } },
    { bob: 1, lean: 2, legR: { a: 18, lift: 0 }, legL: { a: -16, lift: 0 }, armR: { a: 45, b: 30 }, armL: { a: 40, b: 30 }, tool: { on: true, a: 70 } },
    { bob: 0, lean: 1, legR: { a: 14, lift: 0 }, legL: { a: -14, lift: 0 }, armR: { a: 70, b: 35 }, armL: { a: 62, b: 35 }, tool: { on: true, a: 125 } }
  ];
  return {
    idle: { fps: 4, loop: true, frames: idle },
    walk: { fps: 8, loop: true, frames: walk(32, 26, false) },
    carry_walk: { fps: 8, loop: true, frames: walk(24, 0, true) },
    chop: { fps: 8, loop: true, frames: chop }
  };
}
function formatAnims(anims) {
  return '{\n' + Object.entries(anims).map(([k, v]) =>
    '  "' + k + '": { "fps": ' + v.fps + ', "loop": ' + v.loop + ', "frames": [\n' +
    v.frames.map(f => '    ' + JSON.stringify(f)).join(',\n') + '\n  ] }').join(',\n') + '\n}';
}
export { W, H, CX, renderFrame, defaultAnims, formatAnims, palette };
