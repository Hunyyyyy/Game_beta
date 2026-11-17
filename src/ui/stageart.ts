/**
 * The painted parts of a film stage (ui/stage.ts), drawn with canvas paths so they stay sharp at any zoom and can be swapped for real pictures later without touching the player.
 * Stage units: the hall is 1800 wide, the wall meets the floor at HORIZON. Every function paints one layer in stage units (the player sets the transform).
 */
export const SW = 1800;
export const HORIZON = 560;
/** The hall: the wall's window and door, the long stone table. */
export const WIN = { x0: 1150, x1: 1500, y0: 110, y1: 420 };
export const DOOR = { x0: 130, x1: 330, y0: 220 };
export const TABLE = { x0: 560, x1: 1080, far: 585, near: 625, bottom: 725 };

type G = CanvasRenderingContext2D;
const hash = (n: number): number => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** L0: the courtyard seen through the window and the door (the sky is filled by the player over the whole screen). */
export function paintCourt(g: G): void {
  g.fillStyle = '#9fb59a'; // far hills
  g.beginPath(); g.moveTo(600, 330); for (let x = 600; x <= 2100; x += 60) g.lineTo(x, 300 + hash(x) * 50); g.lineTo(2100, 420); g.lineTo(600, 420); g.fill();
  g.fillStyle = '#7c8f6a'; // roofs and trees of the village
  for (let i = 0; i < 9; i++) { const x = 700 + i * 150 + hash(i) * 40; g.fillRect(x, 350 - hash(i + 9) * 30, 70, 70); g.beginPath(); g.moveTo(x - 8, 350 - hash(i + 9) * 30); g.lineTo(x + 35, 318 - hash(i + 9) * 30); g.lineTo(x + 78, 350 - hash(i + 9) * 30); g.fill(); }
  const ground = g.createLinearGradient(0, 400, 0, 560); ground.addColorStop(0, '#c4a874'); ground.addColorStop(1, '#a3875a');
  g.fillStyle = ground; g.fillRect(-200, 400, 2600, 400);
}

/** L1: the wooden wall with its window and door, the shaft of sun and the dust in it. */
export function paintWall(g: G, t: number): void {
  g.save();
  g.beginPath(); g.rect(-400, -400, 2600, HORIZON + 400); g.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); g.rect(DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, HORIZON - DOOR.y0);
  g.clip('evenodd');
  for (let x = -400, i = 0; x < 2200; x += 54, i++) { g.fillStyle = ['#7a5634', '#6f4e2f', '#835d38'][i % 3]; g.fillRect(x, -400, 54, HORIZON + 400); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + 52, -400, 2, HORIZON + 400); }
  for (const y of [60, 300]) { g.fillStyle = '#4a3220'; g.fillRect(-400, y, 2600, 16); } // beams
  const top = g.createLinearGradient(0, -300, 0, 300); top.addColorStop(0, 'rgba(10,6,2,.7)'); top.addColorStop(1, 'rgba(10,6,2,0)');
  g.fillStyle = top; g.fillRect(-400, -300, 2600, 600);
  g.restore();
  g.fillStyle = '#3d2a1a'; g.fillRect(-400, HORIZON - 26, 2600, 26); // skirting
  g.strokeStyle = '#3d2a1a'; g.lineWidth = 14; g.strokeRect(WIN.x0 - 7, WIN.y0 - 7, WIN.x1 - WIN.x0 + 14, WIN.y1 - WIN.y0 + 14); // window frame and bars
  g.lineWidth = 8; g.beginPath(); g.moveTo((WIN.x0 + WIN.x1) / 2, WIN.y0); g.lineTo((WIN.x0 + WIN.x1) / 2, WIN.y1); g.moveTo(WIN.x0, (WIN.y0 + WIN.y1) / 2); g.lineTo(WIN.x1, (WIN.y0 + WIN.y1) / 2); g.stroke();
  g.lineWidth = 14; g.strokeRect(DOOR.x0 - 7, DOOR.y0 - 7, DOOR.x1 - DOOR.x0 + 14, HORIZON - DOOR.y0 + 7); // door frame
  // the slanted shaft of sun out of the window, and the dust turning in it
  const sh = g.createLinearGradient(WIN.x0, WIN.y0, WIN.x0 - 260, HORIZON); sh.addColorStop(0, 'rgba(255,240,190,.34)'); sh.addColorStop(1, 'rgba(255,240,190,.04)');
  g.fillStyle = sh; g.beginPath(); g.moveTo(WIN.x0, WIN.y0); g.lineTo(WIN.x1, WIN.y0); g.lineTo(WIN.x1 - 260, HORIZON); g.lineTo(WIN.x0 - 260, HORIZON); g.fill();
  for (let i = 0; i < 46; i++) {
    const u = (hash(i) + t * (0.01 + hash(i + 50) * 0.02)) % 1, y = HORIZON - u * (HORIZON - WIN.y0), x = WIN.x0 - 260 * (1 - (y - WIN.y0) / (HORIZON - WIN.y0)) + hash(i + 9) * (WIN.x1 - WIN.x0) + Math.sin(t * 0.7 + i) * 14;
    g.fillStyle = `rgba(255,248,215,${0.25 + 0.35 * hash(i + 3)})`; g.fillRect(x, y, 2.4, 2.4);
  }
}

/** L2 (floor): the boards, and the patch of sun on them. The table and the actors are drawn by the player (they need the order of depth). */
export function paintFloor(g: G): void {
  const f = g.createLinearGradient(0, HORIZON, 0, 1000); f.addColorStop(0, '#6a5440'); f.addColorStop(1, '#3a2d22');
  g.fillStyle = f; g.fillRect(-600, HORIZON, 3000, 700);
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3;
  for (let i = -24; i <= 28; i++) { const xh = 900 + i * 70; g.beginPath(); g.moveTo(xh, HORIZON); g.lineTo(900 + (xh - 900) * 2.2, 1000); g.stroke(); }
  for (let i = 0; i < 9; i++) { const y = HORIZON + (i * i * 7 + i * 16); g.beginPath(); g.moveTo(-600, y); g.lineTo(2400, y); g.stroke(); }
  g.fillStyle = 'rgba(255,236,170,.15)'; g.beginPath(); g.moveTo(780, 600); g.lineTo(1040, 600); g.lineTo(900, 820); g.lineTo(600, 820); g.fill();
  g.fillStyle = 'rgba(40,24,10,.22)'; g.fillRect(780, 640, 5, 160); g.fillRect(915, 640, 5, 160); // the window bars on the sun patch
}

/** The long stone table: the far edge is behind whoever sits there, the near edge in front. `half` 0 draws the whole table. */
export function paintTable(g: G): void {
  const { x0, x1, far, near, bottom } = TABLE;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse((x0 + x1) / 2, bottom + 6, (x1 - x0) / 2 + 30, 18, 0, 0, Math.PI * 2); g.fill();
  const face = g.createLinearGradient(0, near, 0, bottom); face.addColorStop(0, '#8d877b'); face.addColorStop(1, '#5c574e');
  g.fillStyle = face; g.fillRect(x0, near, x1 - x0, bottom - near);
  g.fillStyle = '#4c473f'; for (const x of [x0 + 20, x1 - 70, (x0 + x1) / 2 - 25]) g.fillRect(x, near, 50, bottom - near); // legs
  const top = g.createLinearGradient(0, far, 0, near); top.addColorStop(0, '#b3ac9c'); top.addColorStop(1, '#9a9384');
  g.fillStyle = top; g.beginPath(); g.moveTo(x0 + 24, far); g.lineTo(x1 - 24, far); g.lineTo(x1, near); g.lineTo(x0, near); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, near); g.lineTo(x1, near); g.stroke();
  g.fillStyle = 'rgba(255,236,170,.2)'; g.fillRect(x0 + 200, far + 6, 120, 22); // sun on the stone
}

/** The backs of the chairs along the far side of the table, drawn before the people (the one at `seat` is the biggest). */
export function paintChairs(g: G, seat: number): void {
  for (const x of [640, 760, 880, 1000, 1120]) {
    const big = Math.abs(x - seat) < 70;
    g.fillStyle = '#4a3220'; g.fillRect(x - 36, big ? 470 : 520, 72, big ? 190 : 150);
    g.fillStyle = '#5c4029'; g.fillRect(x - 30, big ? 480 : 528, 60, big ? 90 : 60);
  }
}

/** L3: a pillar of the hall, in front of everything. */
export function paintPillar(g: G, x: number): void {
  const p = g.createLinearGradient(x - 62, 0, x + 62, 0); p.addColorStop(0, '#1d1814'); p.addColorStop(0.45, '#4f4538'); p.addColorStop(1, '#171310');
  g.fillStyle = p; g.fillRect(x - 62, -500, 124, 1700);
  g.fillStyle = '#2a231c'; g.fillRect(x - 80, -500, 160, 60); g.fillRect(x - 80, 1000, 160, 60);
}

// ---------------------------------------------------------------- stills (the whole screen)
/** Insert: the old ledger, close up. Two drawings: the page flat under the thumb, then lifted. The dark round it is the edge of a blurred room. */
export function paintBook(g: G, W: number, H: number, t: number): void {
  g.fillStyle = '#0d0905'; g.fillRect(0, 0, W, H);
  const bw = Math.min(W * 0.78, H * 1.45), bh = bw * 0.62, x = (W - bw) / 2, y = (H - bh) / 2 + Math.sin(t * 1.3) * 2, mid = x + bw / 2;
  g.fillStyle = '#3a2314'; g.fillRect(x - 16, y - 14, bw + 32, bh + 30); // the cover, worn at the corners
  g.fillStyle = '#2b190d'; for (const [cx, cy] of [[x - 16, y - 14], [x + bw + 16, y - 14], [x - 16, y + bh + 16], [x + bw + 16, y + bh + 16]]) { g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.fill(); }
  const left = g.createLinearGradient(x, 0, mid, 0); left.addColorStop(0, '#e6d6ae'); left.addColorStop(1, '#c9b78a');
  g.fillStyle = left; g.fillRect(x, y, bw / 2, bh);
  const lifted = t >= 1;
  const right = g.createLinearGradient(mid, 0, x + bw, 0); right.addColorStop(0, '#c9b78a'); right.addColorStop(1, '#e6d6ae');
  g.fillStyle = right; g.fillRect(mid, y, bw / 2, bh);
  g.strokeStyle = 'rgba(40,24,10,.75)'; g.lineCap = 'round';
  // bad handwriting on the left page, a column of figures on the right one
  for (let r = 0; r < 12; r++) {
    const ly = y + 34 + r * (bh - 70) / 12; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 28, ly);
    for (let s = 0; s < 22; s++) g.lineTo(x + 28 + s * ((bw / 2 - 56) / 22) * (r === 11 ? 0.45 : 1), ly + (hash(r * 40 + s) - 0.5) * 9);
    g.stroke();
  }
  if (!lifted) for (let r = 0; r < 12; r++) { const ly = y + 34 + r * (bh - 70) / 12; g.lineWidth = 2.6; g.beginPath(); for (let d = 0; d < 3 + Math.floor(hash(r) * 3); d++) { const dx = mid + 40 + d * 22; g.moveTo(dx, ly - 6); g.lineTo(dx + 9, ly + 6); g.moveTo(dx + 9, ly - 6); g.lineTo(dx, ly + 6); } g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(mid - 5, y, 10, bh); // the gutter
  if (lifted) { // the page turning: a wedge lifted off the right side
    g.fillStyle = '#dccba0'; g.beginPath(); g.moveTo(mid, y); g.lineTo(x + bw - bw * 0.2, y - 18); g.lineTo(x + bw - bw * 0.2, y + bh - 28); g.lineTo(mid, y + bh); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(mid, y); g.lineTo(mid + bw * 0.18, y + 4); g.lineTo(mid + bw * 0.18, y + bh - 8); g.lineTo(mid, y + bh); g.fill();
  }
  // the hand: a thumb and fingers at the corner of the right page
  const hx = x + bw - (lifted ? bw * 0.2 : 20), hy = y + bh * (lifted ? 0.35 : 0.8);
  g.fillStyle = '#b87f45'; g.beginPath(); g.ellipse(hx + 36, hy + 20, 70, 34, -0.35, 0, Math.PI * 2); g.fill();
  for (let f = 0; f < 4; f++) { g.beginPath(); g.ellipse(hx - 14 - f * 6, hy + f * 18 - 10, 38, 11, 0.12, 0, Math.PI * 2); g.fill(); }
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.65); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.92)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

/** The river quay far off, in a thin mist: sky, hills, water, the stone bank. `camX` slides the layers at their own speeds. */
export function paintRiver(g: G, W: number, H: number, camX: number, t: number): void {
  const k = H / 700, shift = (p: number): number => W / 2 - (900 + (camX - 900) * p) * k;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9fb0b8'); sky.addColorStop(0.55, '#d9ddd2'); sky.addColorStop(1, '#c4cdc6'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.setTransform(k, 0, 0, k, shift(0.12), 0);
  g.fillStyle = 'rgba(120,138,140,.55)'; g.beginPath(); g.moveTo(-600, 380); for (let x = -600; x <= 2600; x += 70) g.lineTo(x, 300 + hash(x * 0.3) * 70); g.lineTo(2600, 420); g.lineTo(-600, 420); g.fill(); // far hills
  g.setTransform(k, 0, 0, k, shift(0.3), 0);
  g.fillStyle = 'rgba(96,114,112,.7)'; g.beginPath(); g.moveTo(-600, 440); for (let x = -600; x <= 2600; x += 55) g.lineTo(x, 370 + hash(x * 0.7 + 3) * 50); g.lineTo(2600, 450); g.lineTo(-600, 450); g.fill(); // the far shore
  // a three-sail boat, tiny, on the water
  g.fillStyle = '#4a4540'; g.fillRect(1010, 462, 120, 8); for (const sx of [1030, 1065, 1100]) { g.beginPath(); g.moveTo(sx, 380); g.lineTo(sx + 26, 458); g.lineTo(sx - 4, 458); g.fill(); }
  g.setTransform(k, 0, 0, k, shift(0.6), 0);
  const water = g.createLinearGradient(0, 450, 0, 700); water.addColorStop(0, '#9fb6b6'); water.addColorStop(1, '#6f8c90'); g.fillStyle = water; g.fillRect(-600, 450, 3200, 300);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = hash(i) * 3000 - 500, y = 470 + hash(i + 7) * 200 + Math.sin(t + i) * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + hash(i + 2) * 50, y); g.stroke(); }
  g.setTransform(k, 0, 0, k, shift(1), 0);
  g.fillStyle = '#6d6a63'; g.beginPath(); g.moveTo(-600, 700); for (let x = -600; x <= 2600; x += 90) g.lineTo(x, 640 + hash(x) * 40); g.lineTo(2600, 760); g.lineTo(-600, 760); g.fill(); // the steep stone bank
  g.setTransform(1, 0, 0, 1, 0, 0);
  const mist = g.createLinearGradient(0, H * 0.4, 0, H * 0.8); mist.addColorStop(0, 'rgba(235,238,230,0)'); mist.addColorStop(0.5, 'rgba(235,238,230,.45)'); mist.addColorStop(1, 'rgba(235,238,230,0)'); g.fillStyle = mist; g.fillRect(0, 0, W, H);
}
