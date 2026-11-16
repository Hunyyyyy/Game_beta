// The ten specialist buildings of the legacy (doc/UPDATE_di_san_mo_khoa.md, table A2) and the blueprint prices of the specialists: one script, safe to run again.
//   node tools/gen-specialists.mjs
// Each building is a core kind in other colours with a pennant of its own: src/content/buildings/<id>/building.json (one level, medieval only) and A1.json (the art of the base kind's A2, recoloured),
// listed in data/specialists.json `buildings` (locked until isUnlocked('building:<id>')); data/story/unlocks.json gets their keys, with the price of a blueprint (blueprintFactor times the cost).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Draw, banner, PALETTE } from './art/kit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const W = (p, o, ind = 2) => { const crlf = existsSync(p) && readFileSync(p, 'utf8').includes('\r\n'); writeFileSync(p, JSON.stringify(o, null, ind).replace(/\n/g, crlf ? '\r\n' : '\n') + (crlf ? '\r\n' : '\n')); };
const spec = J(join(root, 'src/data/specialists.json')), unl = J(join(root, 'src/data/story/unlocks.json'));
const FACTOR = unl.blueprintFactor;

// fruit that opens it, id of the kind, name, the kind it is made from, the colour of its roof and of its pennant, what it does (done in Phase 5)
const B = [
  { id: 'elder_hall', from: 'fruit:TM1', name: 'Hội Quán Trưởng Lão', base: 'house', tint: 'purple', flag: ['purple', 'purpleD'], does: '+1 ô cố vấn, giảm bất ổn' },
  { id: 'tribute_post', from: 'fruit:TM2', name: 'Đồn Thu Cống', base: 'storage', tint: 'gray', flag: ['black', 'blackD'], does: 'thu tài nguyên định kỳ từ làng đã khuất phục' },
  { id: 'guild_exchange', from: 'fruit:TM3', name: 'Sàn Thương Hội', base: 'market', tint: 'gold', flag: ['gold', 'goldD'], does: 'đoàn thương lái, kho bản vẽ ở Chợ rộng hơn' },
  { id: 'bodyguard_lodge', from: 'fruit:TM4', name: 'Phòng Hộ Vệ', base: 'guardpost', tint: 'blue', flag: ['blue', 'blueD'], does: 'thêm 1 ô cận vệ gán nhân vật' },
  { id: 'liaison_post', from: 'fruit:TM5', name: 'Trạm Liên Lạc', base: 'scouttent', tint: 'teal', flag: ['teal', 'tealD'], does: 'gọi đồng minh viện trợ một lần mỗi mùa' },
  { id: 'twin_camp', from: 'fruit:TM6', name: 'Trại Kép', base: 'wartent', tint: 'green', flag: ['bushL', 'bush'], does: 'thêm 1 đội xuất quân song song' },
  { id: 'conquest_beacon', from: 'fruit:TM7', name: 'Đài Chinh Phạt', base: 'drill', tint: 'blue', flag: ['red', 'redD'], does: 'tăng tầm hành quân, dẹp loạn nhanh hơn' },
  { id: 'memorial_shrine', from: 'fruit:TM8', name: 'Đền Tưởng Niệm', base: 'house', tint: 'gray', flag: ['white', 'whiteD'], does: 'sĩ khí cộng thêm khi đánh kẻ thù đã gây thù' },
  { id: 'academy', from: 'fruit:TM9', name: 'Học Viện', base: 'lab', tint: 'teal', flag: ['blue', 'blueD'], does: '+1 ô nghiên cứu song song' },
  { id: 'hidden_forge', from: 'fruit:TM10', name: 'Xưởng Mật', base: 'workshop', tint: 'purple', flag: ['black', 'blackD'], does: 'chế một trang bị đặc biệt (chốt ở Phase 5)' },
];
const TINT = { purple: ([r, g, b]) => [r * 0.62, g * 0.7, r * 0.95], blue: ([r, g, b]) => [b, g * 0.95, r * 1.0], teal: ([r, g, b]) => [g * 0.6, r * 0.85, r * 0.8], green: ([r, g, b]) => [g * 0.85, r * 0.95, b], gold: ([r, g, b]) => [r * 1.0, g * 1.55, b * 1.1], gray: ([r, g, b]) => { const m = (r + g + b) / 3; return [m * 0.95, m * 0.97, m * 1.03]; } };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const reddish = (c) => c[0] > 140 && c[1] < 100 && c[2] < 100;
Object.assign(PALETTE, { purple: '#5a2a8a', purpleD: '#3a1a5a', teal: '#2a8a8a', tealD: '#1a5a5a', white: '#f2eee2', whiteD: '#c9c3b0', black: '#2a2a30', blackD: '#15151a' });

const outBuildings = [];
for (const b of B) {
  const baseDir = join(root, 'src/content/buildings', b.base), dir = join(root, 'src/content/buildings', b.id);
  mkdirSync(dir, { recursive: true });
  const bb = J(join(baseDir, 'building.json')), last = bb.levels.ancient[0];
  const lv = { ...last, name: b.name, cost: Object.fromEntries(Object.entries(last.cost).map(([r, v]) => [r, Math.round(v * 2)])), buildTime: Math.round(last.buildTime * 1.5), hp: Math.round(last.hp * 1.3) };
  delete lv.size;
  const def = { kind: b.id, name: b.name, group: bb.group, size: bb.size, buildable: true, unlockFire: 5, requires: bb.requires ?? ['builder'], levels: { stone: [], ancient: [lv] } };
  if (bb.produces) delete def.produces;
  W(join(dir, 'building.json'), def, 1);
  // the art: the base kind's A2 (or A1) in other colours, with a pennant above it
  const src = J(join(baseDir, existsSync(join(baseDir, 'A2.json')) ? 'A2.json' : 'A1.json')), art = structuredClone(src);
  const tint = TINT[b.tint];
  const pal = { ...PALETTE, ...art.palette };
  for (const [k, v] of Object.entries(pal)) if (typeof v === 'string' && v[0] === '#' && reddish(hex(v))) pal[k] = toHex(tint(hex(v)));
  art.palette = pal; art.name = b.name;
  const d = new Draw(), [fx, , fw] = art.footprint, y = art.anchor[1];
  d.group('st4', () => banner(d, fx + Math.round(fw / 2) - 14, y - 50, 11, 12, b.flag));
  art.layers = [...art.layers.filter((l, i) => !(i === art.layers.length - 1 && l.shape === 'outline')), ...d.root, { shape: 'outline', color: 'line' }, ...d.lateLayers];
  writeFileSync(join(dir, 'A1.json'), JSON.stringify(art) + '\n');
  const cost = Object.values(lv.cost).reduce((a, v) => a + v, 0);
  outBuildings.push({ id: b.id, key: `building:${b.id}`, name: b.name, base: b.base, from: b.from, does: b.does });
  const u = unl.unlocks.find((x) => x.key === `building:${b.id}`);
  const row = { key: `building:${b.id}`, kind: 'building', from: [b.from], sources: ['story', 'blueprint'], blueprintCost: { coin: Math.round((lv.cost.coin ?? 0) * FACTOR + cost * 0.5 * FACTOR) }, core: false };
  if (u) Object.assign(u, row); else unl.unlocks.push(row);
}
spec.buildings = outBuildings;
// the price of the blueprint of a specialist unit: FACTOR times what one costs at rank 8 (the level of the middle tip)
const ranks = J(join(root, 'src/data/ranks.json'));
for (const s of spec.units) {
  const base = ranks.branches[s.camp].find((r) => r.rank === 8).cost, price = {};
  for (const [r, v] of Object.entries(base)) price[r] = Math.round(v * s.costMult * FACTOR);
  const u = unl.unlocks.find((x) => x.key === s.key);
  if (u) u.blueprintCost = price;
}
W(join(root, 'src/data/specialists.json'), spec, 2);
W(join(root, 'src/data/story/unlocks.json'), unl, 2);
// the art of the specialist buildings: one art each, drawn the whole life of the house
const al = J(join(root, 'src/data/artlevels.json'));
for (const b of B) { al.upTo.kinds[b.id] = [1]; al.handMade[b.id] = 1; }
al.specialist = B.map((b) => b.id);
W(join(root, 'src/data/artlevels.json'), al, 2);
console.log(`gen-specialists: ${B.length} buildings, ${spec.units.length} unit prices`);
