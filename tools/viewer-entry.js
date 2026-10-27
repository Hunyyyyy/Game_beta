import { W, H, CX, HAND_Y, formatAnims, renderFrame, renderTool, bakeTool, toolAnchor, unpackShapes, packPixels, handTools } from '../src/character/rig.js';
import defaultAnims from '../src/data/anims.json';
import tiers from '../src/data/handtools/tiers.json';

const $ = (id) => document.getElementById(id);
const look = { sex: 'm', skin: '#e0ac69', hair: '#3b2a1a', hide: '#8b6a45', pants: '#3f63a8' };
let lastAnimText = '', anims = {}, cur = '', frame = 0, playing = true, last = 0, acc = 0, scale = 10;

const cv = $('cv'), g = cv.getContext('2d');
const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
const tg = tmp.getContext('2d');

// Accepts: {"name":{fps,loop,frames}} | {fps,loop,frames} | [frame,...] | the whole anims.json table
function normalize(data) {
  const isFrames = (a) => a.length && a[0] && typeof a[0] === 'object' && !Array.isArray(a[0]);
  if (Array.isArray(data)) return isFrames(data) ? { anim: { fps: 6, loop: true, frames: data } } : {};
  if (data && Array.isArray(data.frames)) return { anim: { fps: 6, loop: true, ...data } };
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (Array.isArray(v)) { if (isFrames(v)) out[k] = { fps: 6, loop: true, frames: v }; }
    else if (v && Array.isArray(v.frames)) out[k] = { fps: 6, loop: true, ...v };
  }
  return out;
}

const isToolDef = (v) => v && typeof v === 'object' && !Array.isArray(v) && (Array.isArray(v.side) || Array.isArray(v.shapes) || Array.isArray(v.head) || (v.poses && typeof v.poses === 'object'));

function refreshKinds() {
  const kinds = Object.keys(handTools), tk = $('tkind').value, te = $('tedit').value;
  $('tkind').innerHTML = '<option value="">from animation</option>' + kinds.map((k) => `<option>${k}</option>`).join('');
  $('tedit').innerHTML = kinds.map((k) => `<option>${k}</option>`).join('');
  $('tkind').value = kinds.includes(tk) ? tk : '';
  $('tedit').value = kinds.includes(te) ? te : kinds[0];
}

function parse() {
  try {
    const data = JSON.parse($('src').value);
    if (isToolDef(data) && !Array.isArray(data.frames)) {
      // A bare tool design was pasted in the animation box: it belongs in the tool box. Move it there and restore the animation text.
      const guess = String(data.name || '').toLowerCase(), kind = handTools[guess] ? guess : $('tedit').value;
      handTools[kind] = data; refreshKinds();
      $('tedit').value = kind; $('tkind').value = kind;
      $('src').value = lastAnimText;
      showTool(); activateTab('p-tool'); draw();
      $('note').textContent = `That is a tool design, so it was applied to "${kind}" (Tool JSON tab). The animation text was restored.`;
      return;
    }
    // A pasted document may also carry tool designs ({"axe": {side/front/shapes}}): apply them.
    const applied = [];
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [k, v] of Object.entries(data)) if (isToolDef(v)) { handTools[k] = v; applied.push(k); }
    }
    if (applied.length) { refreshKinds(); showTool(); }
    $('note').textContent = applied.length ? 'Applied tool design(s) from this JSON: ' + applied.join(', ') : '';
    const t = normalize(data);
    const names = Object.keys(t).filter((n) => t[n].frames.length);
    if (!names.length) throw new Error('No animation with "frames" found.');
    anims = t;
    $('anim').innerHTML = names.map((n) => `<option>${n}</option>`).join('');
    if (!names.includes(cur)) { cur = names[0]; frame = 0; }
    $('anim').value = cur;
    $('err').textContent = '';
    lastAnimText = $('src').value;
    draw();
  } catch (e) {
    $('err').textContent = 'Error: ' + e.message;
  }
}

// Text for the animation box: one frame per line when it is a table of animations (the shape of anims.json).
const fmt = (data) => (data && !Array.isArray(data) && Object.values(data).length && Object.values(data).every((v) => v && Array.isArray(v.frames)) ? formatAnims(data) : JSON.stringify(data, null, 1));

// "Use this angle for frame N": writes the preview angle (and the previewed tool) into that frame of the animation JSON.
const angleVal = () => { const n = parseFloat($('tanglenum').value); return Number.isNaN(n) ? +$('tangle').value : n; };
let applyKey = '';
function buildApplyBar() {
  const def = anims[cur], bar = $('applybar'); if (!def) return;
  const angles = def.frames.map((fr) => (fr.tool && fr.tool.on ? Math.round((fr.tool.a || 0) * 10) / 10 : null));
  const key = cur + ':' + angles.join(',');
  if (key !== applyKey) { // rebuilt only when the animation or an angle changes, never every tick (it would eat clicks)
    applyKey = key; bar.innerHTML = '';
    def.frames.forEach((_, i) => {
      const b = document.createElement('button');
      b.textContent = `frame ${i + 1} · ${angles[i] === null ? 'no tool' : angles[i] + '°'}`;
      b.title = `Set the angle of frame ${i + 1} to the Angle box, and its tool to the one being previewed`;
      b.onclick = () => applyAngle(i);
      bar.appendChild(b);
    });
  }
  [...bar.children].forEach((b, i) => b.classList.toggle('on', i === frame));
  const fa = angles[frame];
  $('curang').textContent = fa === null ? `Frame ${frame + 1} has no tool.` : `Frame ${frame + 1} uses ${fa}° (${def.frames[frame].tool.kind || 'axe'}${def.frames[frame].tool.pose ? ', hand-drawn pose' : ''})`;
}
function applyAngle(i) {
  try {
    const data = JSON.parse($('src').value), def = normalize(data)[cur], fr = def && def.frames[i];
    if (!fr) return;
    const ang = angleVal(), kind = $('tedit').value;
    const hadPose = fr.tool && fr.tool.pose;
    fr.tool = { ...(fr.tool || {}), on: true, a: ang, kind };
    delete fr.tool.pose; // an explicit angle means "auto-rotate this frame": a leftover pose would override it
    $('src').value = fmt(data);
    parse(); stop(); frame = i; draw();
    $('note').textContent = `Frame ${i + 1}: tool "${kind}" at ${ang}°` + (hadPose ? ` (hand-drawn pose "${hadPose}" removed from this frame)` : '') + '.';
  } catch (e) { $('terr').textContent = 'Error: ' + e.message; }
}

// Static tool preview: the tool alone (side view) around the hand point, no character.
function drawToolPreview() {
  const kind = $('tedit').value, tier = +$('tier').value || 1, ang = angleVal(), Z = 10;
  const c = $('tcv'); c.width = W * Z; c.height = H * Z;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { x.fillStyle = (i + j) % 2 ? '#3a3a3a' : '#333'; x.fillRect(i * Z, j * Z, Z, Z); }
  let px;
  try { px = renderTool(kind, tier, ang, undefined, $('tpose').value || undefined); } catch (e) { $('terr').textContent = 'Render error: ' + e.message; return; }
  tg.putImageData(new ImageData(new Uint8ClampedArray(px), W, H), 0, 0);
  x.drawImage(tmp, 0, 0, c.width, c.height);
  if ($('tgrid').checked) {
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; x.beginPath();
    for (let i = 0; i <= W; i++) { x.moveTo(i * Z + .5, 0); x.lineTo(i * Z + .5, H * Z); }
    for (let j = 0; j <= H; j++) { x.moveTo(0, j * Z + .5); x.lineTo(W * Z, j * Z + .5); }
    x.stroke();
  }
  x.fillStyle = '#ff3b3b'; x.fillRect(CX * Z - 2, HAND_Y * Z - 2, 4, 4); // hand / grip point = (0,0) of a "grip" tool
}

function render(f, v) {
  try {
    tg.putImageData(new ImageData(new Uint8ClampedArray(renderFrame(anims, cur, f, v, look, $('carry').value, { tier: +$('tier').value, kind: $('tkind').value || undefined })), W, H), 0, 0);
    return null;
  } catch (e) { return e; }
}

function draw() {
  const def = anims[cur]; if (!def) return;
  const n = def.frames.length;
  frame = ((frame % n) + n) % n;
  const view = $('view').value;
  cv.width = W * scale; cv.height = H * scale;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#6d8f4e'; g.fillRect(0, 0, cv.width, cv.height);
  const err = render(frame, view);
  if (err) { $('err').textContent = 'Render error in frame ' + (frame + 1) + ': ' + err.message; } else { $('err').textContent = ''; g.drawImage(tmp, 0, 0, cv.width, cv.height); }
  const hasTool = def.frames.some((fr) => fr.tool && fr.tool.on);
  $('hint').textContent = hasTool && +$('tier').value === 0 ? 'Tool tier is "bare hands", so the tool is hidden. Pick wood or stone.' : (!hasTool && !$('tkind').value ? 'This animation has no "tool":{"on":true} in any frame, so no tool is drawn.' : '');
  $('info').textContent = `${cur}  ·  frame ${frame + 1}/${n}  ·  ${def.fps} fps  ·  ${def.loop ? 'loop' : 'once'}`;
  const strip = $('strip'); strip.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas'); c.width = W * 3; c.height = H * 3;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#6d8f4e'; x.fillRect(0, 0, c.width, c.height);
    if (!render(i, view)) x.drawImage(tmp, 0, 0, c.width, c.height);
    c.className = i === frame ? 'on' : '';
    c.title = 'frame ' + (i + 1);
    c.onclick = () => { stop(); frame = i; draw(); };
    strip.appendChild(c);
  }
  drawToolPreview();
  drawEditor();
  drawGallery();
  buildApplyBar();
}

const stop = () => { playing = false; $('play').textContent = '▶ Play'; };
function tick(t) {
  if (playing && anims[cur]) {
    acc += t - last;
    const step = 1000 / (anims[cur].fps || 6);
    while (acc >= step) { acc -= step; frame++; draw(); }
  }
  last = t; requestAnimationFrame(tick);
}

refreshKinds();
const defaults = JSON.parse(JSON.stringify(handTools));
const refreshPoses = () => {
  const names = Object.keys((handTools[$('tedit').value] || {}).poses || {}), cur = $('tpose').value;
  $('tpose').innerHTML = '<option value="">auto-rotate (angle)</option>' + names.map((n) => `<option>${n}</option>`).join('');
  $('tpose').value = names.includes(cur) ? cur : '';
};
// One line per shape and per small object, so the JSON stays easy to read and edit.
const prettyTool = (def) => JSON.stringify(def, null, 2)
  .replace(/\{([^{}\[\]]*)\}/g, (m, inner) => '{ ' + inner.split('\n').map((l) => l.trim()).filter(Boolean).join(' ') + ' }')
  .replace(/\[\s+(-?\d+),\s+(-?\d+),\s+(\d+),\s+(\d+),\s+("[^"]+")\s+\]/g, '[$1, $2, $3, $4, $5]');
const showTool = () => { refreshPoses(); $('tsrc').value = prettyTool(handTools[$('tedit').value]); $('terr').textContent = ''; };
let ttimer;
$('tsrc').oninput = () => { clearTimeout(ttimer); ttimer = setTimeout(() => {
  try {
    const kind = $('tedit').value, v = JSON.parse($('tsrc').value);
    // Accept the bare design, or a document that wraps it ({"axe": {...}}).
    const def = isToolDef(v) ? v : isToolDef(v[kind]) ? v[kind] : Object.values(v).find(isToolDef);
    if (!def) { $('terr').textContent = 'No "head" (or "side") shapes found, so nothing would be drawn except the handle. Paste only the tool design (the part inside "axe": {...}). Not applied.'; return; }
    handTools[kind] = def; $('tkind').value = kind; $('terr').textContent = ''; draw(); // the character holds the tool being edited
  } catch (e) { $('terr').textContent = 'Error: ' + e.message; }
}, 250); };
$('tedit').onchange = () => { $('tkind').value = $('tedit').value; showTool(); draw(); };
$('treset').onclick = () => { const k = $('tedit').value; if (defaults[k]) handTools[k] = JSON.parse(JSON.stringify(defaults[k])); showTool(); draw(); };
$('tkind').onchange = draw;
$('tpose').onchange = drawToolPreview;
// Bake: for the given frames (default: all) that hold a tool, make a pose from the frame's angle and point the frame at it.
// Frames that already use an existing pose are left alone, so hand-drawn work is never overwritten.
function bakeFrames(only) {
  try {
    const data = JSON.parse($('src').value), t = normalize(data), def = t[cur];
    if (!def) return;
    const made = [], kept = []; let baked = null;
    def.frames.forEach((fr, i) => {
      if (only && !only.includes(i)) return;
      if (!fr.tool || !fr.tool.on) return;
      const kind = $('tkind').value || fr.tool.kind || 'axe';
      const tool = handTools[kind];
      if (!tool) return;
      if (fr.tool.pose && tool.poses && tool.poses[fr.tool.pose]) { kept.push(i + 1); return; }
      let name = cur + '_' + (i + 1);
      tool.poses = tool.poses || {};
      tool.poses[name] = bakeTool(kind, fr.tool.a || 0);
      fr.tool.pose = name; fr.tool.kind = kind;
      made.push(name); baked = kind;
    });
    $('src').value = fmt(data);
    parse();
    if (baked) { $('tedit').value = baked; $('tkind').value = baked; }
    showTool(); draw();
    $('note').textContent = (made.length ? 'Baked poses: ' + made.join(', ') + '. Paint on them in the pose editor. ' : 'Nothing to bake. ') + (kept.length ? 'Kept existing poses on frame(s) ' + kept.join(', ') + '.' : '');
  } catch (e) { $('terr').textContent = 'Error: ' + e.message; }
}
$('bake').onclick = () => bakeFrames(null);
$('mkpose').onclick = () => bakeFrames([frame]);

// ---- Pose editor: the current frame, zoomed; click a pixel to paint it into the frame's pose ----
const EZ = 14;
let brush = 'head', undo = [], painting = false, lastKey = '', anchor = null;
const swatchColor = (n) => (n === 'wood' ? '#8b5e34' : (tiers[+$('tier').value || 1] || tiers[1])[n]);
function buildPalette() {
  $('palette').innerHTML = ['head', 'light', 'dark', 'wood', 'erase'].map((n) =>
    `<button class="sw${n === brush ? ' on' : ''}" data-b="${n}" title="${n}" style="background:${n === 'erase' ? '#222' : swatchColor(n)}">${n === 'erase' ? '✕' : ''}</button>`).join('');
  for (const bt of $('palette').children) bt.onclick = () => { brush = bt.dataset.b; buildPalette(); };
}
function curPose() {
  const fr = anims[cur] && anims[cur].frames[frame];
  if (!fr || !fr.tool || !fr.tool.on) return null;
  const kind = $('tkind').value || fr.tool.kind || 'axe', tool = handTools[kind], name = fr.tool.pose;
  return { fr, kind, tool, name, ok: !!(name && tool && tool.poses && tool.poses[name]) };
}
function drawEditor() {
  const c = $('ecv'); if (!c) return;
  c.width = W * EZ; c.height = H * EZ;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { x.fillStyle = (i + j) % 2 ? '#5f8446' : '#6d8f4e'; x.fillRect(i * EZ, j * EZ, EZ, EZ); }
  const cp = curPose();
  if (!anims[cur]) return;
  if (!render(frame, 'right')) x.drawImage(tmp, 0, 0, c.width, c.height);
  anchor = toolAnchor();
  x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1; x.beginPath();
  for (let i = 0; i <= W; i++) { x.moveTo(i * EZ + .5, 0); x.lineTo(i * EZ + .5, H * EZ); }
  for (let j = 0; j <= H; j++) { x.moveTo(0, j * EZ + .5); x.lineTo(W * EZ, j * EZ + .5); }
  x.stroke();
  if (anchor) { x.strokeStyle = '#ff3b3b'; x.lineWidth = 2; x.strokeRect(anchor[0] * EZ + 1, anchor[1] * EZ + 1, EZ - 2, EZ - 2); } // the hand = (0,0) of a pose
  $('mkpose').disabled = !(cp && !cp.ok);
  $('undo').disabled = !undo.length;
  $('estatus').textContent = !cp ? 'This frame has no tool ("tool":{"on":true}). Pick a frame that holds one.'
    : !anchor ? 'Tool tier is "bare hands": choose wood or stone to see and paint the tool.'
    : cp.ok ? `Frame ${frame + 1}: painting pose "${cp.name}" of tool "${cp.kind}". Left-click or drag = paint, right-click = erase.`
    : `Frame ${frame + 1} has no hand-drawn pose yet. Press "Create pose for this frame" to start from its current look.`;
  buildPalette();
}
function paintAt(e) {
  const cp = curPose(); if (!cp || !cp.ok || !anchor) return;
  const r = $('ecv').getBoundingClientRect();
  // the canvas is letterboxed inside its box (object-fit: contain): map the mouse through the picture's real rectangle
  const cw = $('ecv').width, ch = $('ecv').height, k = Math.min(r.width / cw, r.height / ch);
  const X = Math.floor((e.clientX - r.left - (r.width - cw * k) / 2) / k / EZ), Y = Math.floor((e.clientY - r.top - (r.height - ch * k) / 2) / k / EZ);
  if (X < 0 || Y < 0 || X >= W || Y >= H) return;
  const erase = brush === 'erase' || e.button === 2 || (e.buttons & 2);
  const key = X + ',' + Y + ',' + erase + brush;
  if (key === lastKey) return; lastKey = key;
  const rx = X - anchor[0], ry = Y - anchor[1];
  const list = unpackShapes(cp.tool.poses[cp.name]).filter(([px, py]) => px !== rx || py !== ry);
  if (!erase) list.push([rx, ry, brush]);
  cp.tool.poses[cp.name] = packPixels(list);
  showTool(); draw();
}
$('ecv').onpointerdown = (e) => {
  const cp = curPose(); if (!cp || !cp.ok) return;
  stop(); painting = true; lastKey = '';
  undo.push({ kind: cp.kind, name: cp.name, shapes: JSON.parse(JSON.stringify(cp.tool.poses[cp.name])) });
  if (undo.length > 100) undo.shift();
  try { $('ecv').setPointerCapture(e.pointerId); } catch (_) {}
  paintAt(e);
};
$('ecv').onpointermove = (e) => { if (painting) paintAt(e); };
$('ecv').onpointerup = () => { painting = false; };
$('ecv').oncontextmenu = (e) => e.preventDefault();
$('undo').onclick = () => {
  const u = undo.pop(); if (!u) return;
  handTools[u.kind].poses[u.name] = u.shapes; showTool(); draw();
};

// ---- Pose gallery: one picture per pose of the tool being edited ----
function drawGallery() {
  const g = $('pgallery'); if (!g) return;
  const kind = $('tedit').value, poses = (handTools[kind] || {}).poses || {}, tier = +$('tier').value || 1;
  g.innerHTML = '';
  const names = Object.keys(poses);
  if (!names.length) { g.textContent = 'No poses yet. Bake poses for an animation, or add "poses" to the tool JSON.'; return; }
  for (const n of names) {
    const box = document.createElement('div'); box.className = 'pg' + (curPose() && curPose().name === n ? ' on' : '');
    const c = document.createElement('canvas'); c.width = W * 4; c.height = H * 4;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#6d8f4e'; x.fillRect(0, 0, c.width, c.height);
    try { tg.putImageData(new ImageData(new Uint8ClampedArray(renderTool(kind, tier, 0, undefined, n)), W, H), 0, 0); x.drawImage(tmp, 0, 0, c.width, c.height); } catch (_) {}
    const label = document.createElement('div'); label.textContent = n;
    box.appendChild(c); box.appendChild(label);
    box.onclick = () => {
      $('tpose').value = n;
      const i = anims[cur] ? anims[cur].frames.findIndex((fr) => fr.tool && fr.tool.pose === n) : -1;
      if (i >= 0) { stop(); frame = i; draw(); } else drawToolPreview();
    };
    g.appendChild(box);
  }
}

$('tangle').oninput = () => { $('tanglenum').value = $('tangle').value; drawToolPreview(); };
$('tanglenum').oninput = () => { $('tangle').value = $('tanglenum').value; drawToolPreview(); };
$('readang').onclick = () => {
  const fr = anims[cur] && anims[cur].frames[frame];
  if (!fr || !fr.tool || !fr.tool.on) return;
  $('tanglenum').value = fr.tool.a || 0; $('tangle').value = fr.tool.a || 0;
  if (fr.tool.kind && handTools[fr.tool.kind]) { $('tedit').value = fr.tool.kind; showTool(); }
  drawToolPreview();
};
$('tgrid').onchange = drawToolPreview;

let timer;
$('src').oninput = () => { clearTimeout(timer); timer = setTimeout(parse, 250); };
$('anim').onchange = () => { cur = $('anim').value; frame = 0; draw(); };
['view', 'tier', 'carry'].forEach((id) => ($(id).onchange = draw));
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? '⏸ Pause' : '▶ Play'; };
$('load').onclick = () => { $('src').value = formatAnims(defaultAnims); parse(); };

$('src').value = formatAnims(defaultAnims); cur = 'chop'; // the whole game table, so every animation is in the list
function activateTab(id) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.dataset.pane === id);
  for (const p of document.querySelectorAll('.pane')) p.classList.toggle('on', p.id === id);
}
for (const tab of document.querySelectorAll ? document.querySelectorAll('.tab') : []) tab.onclick = () => activateTab(tab.dataset.pane);
showTool(); parse(); requestAnimationFrame(tick);
