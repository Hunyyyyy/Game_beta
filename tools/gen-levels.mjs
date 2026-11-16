// The levels of every building up to the Nhà chung's level 10: one script, safe to run again.
//   node tools/gen-levels.mjs
// Reads src/data/artlevels.json (growth, names, sizes) and each src/content/buildings/<kind>/building.json; writes the `ancient` levels after the hand-made ones, `limit` for every Nhà chung level,
// the Nhà chung's popByFire, and src/data/progression.json (what each Nhà chung level lets the houses reach).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = join(root, 'src/data/artlevels.json');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const cfg = readJson(cfgPath), G = cfg.growth, MAX = cfg.maxLevel;
const dirs = join(root, 'src/content/buildings');
const kinds = readdirSync(dirs).filter((k) => existsSync(join(dirs, k, 'building.json')));
const crlfOf = (p) => readFileSync(p, 'utf8').includes('\r\n');
const save = (p, o, indent) => writeFileSync(p, JSON.stringify(o, null, indent).replace(/\n/g, crlfOf(p) ? '\r\n' : '\n') + (crlfOf(p) ? '\r\n' : '\n'));
const round = (x) => Math.round(x);

let firstRun = false;
for (const k of kinds) {
  const p = join(dirs, k, 'building.json'), b = readJson(p), st = b.levels.stone ?? [], an = b.levels.ancient ?? [];
  if (k === 'fieldtent') continue;
  if (cfg.handMade[k] === undefined) { cfg.handMade[k] = an.length; firstRun = true; }
  const hand = cfg.handMade[k], medOnly = cfg.medievalOnly.includes(k), total = medOnly ? MAX - 3 : MAX, want = total - st.length;
  const levels = an.slice(0, hand), last = levels[levels.length - 1] ?? st[st.length - 1];
  const campfire = k === 'campfire';
  for (let n = hand + 1; n <= want; n++) {
    const lv = st.length + n, fire = medOnly ? lv + 3 : lv, steps = n - hand, f = (campfire ? G.campfireCost : G.cost) ** steps;
    const scale = Math.min(4, Math.max(0.5, ((last.cost.wood ?? 0) + (last.cost.stone ?? 0)) / 150));
    const cost = {};
    for (const [r, v] of Object.entries(last.cost)) cost[r] = Math.max(1, round(v * f));
    if (fire >= cfg.materials.steel && !campfire) cost.steel = (cost.steel ?? 0) + Math.max(1, round(2 * (fire - 5) * scale));
    if (fire >= cfg.materials.coin && !campfire) cost.coin = (cost.coin ?? 0) + round(15 * (fire - 6) * scale);
    if (fire >= cfg.materials.fine_steel && !campfire) cost.fine_steel = Math.max(1, round(1.5 * (fire - 7) * scale));
    const next = {
      name: cfg.tierName[String(fire)] ?? last.name, cost,
      buildTime: round(last.buildTime * G.time ** steps), cap: last.cap > 0 ? round(last.cap * G.cap ** steps) : 0,
      craftSpeed: Math.round((last.craftSpeed + G.craft * steps) * 100) / 100, slots: last.slots > 0 ? Math.max(last.slots + steps, round(last.slots * G.slots ** steps)) : 0,
      hp: round(last.hp * G.hp ** steps), sight: last.sight > 0 ? last.sight + G.sight * steps : 0,
    };
    if (campfire) next.name = ['Nhà chính', 'Dinh thự', 'Thành chính', 'Cung điện', 'Hoàng cung', 'Đại cung điện'][n - hand - 1] ?? last.name;
    levels.push(next);
  }
  // the footprint: the campfire by its table, the rest by the default rule (n tiles more from the given levels)
  const sizes = cfg.sizes[k] ?? null, base = b.size, def = cfg.sizes.default;
  levels.forEach((l, i) => {
    const lv = st.length + i + 1;
    if (i < hand) return; // hand-made levels keep their own
    let size;
    if (sizes) size = sizes[String(lv)];
    else if (!['fence', 'gate', 'trap', 'field', 'drill', 'ranch'].includes(k)) { const add = lv >= def.from[1] ? def.add[1] : lv >= def.from[0] ? def.add[0] : 0; size = add ? [base[0] + add, base[1] + add] : undefined; }
    if (size) l.size = size; else delete l.size;
  });
  b.levels.ancient = levels;
  // the count allowed for each Nhà chung level: the old entries stay, the rest grow
  if (Array.isArray(b.limit) && b.limit.length < MAX) { const lim = [...b.limit]; while (lim.length < MAX) lim.push(Math.max(lim[lim.length - 1] + 1, round(lim[lim.length - 1] * (1 + G.limit)))); b.limit = lim; }
  if (campfire) b.popByFire = cfg.popByFire;
  save(p, b, 1);
}
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

// progression.json: every house may reach the level of the Nhà chung; to leave a level the producers must stand at it
{
  const p = join(root, 'src/data/progression.json'), pr = readJson(p);
  pr.campfire.levels = Array.from({ length: MAX }, (_, i) => ({ level: i + 1, buildingMaxLevel: i + 1, upgradeNeeds: i + 1 < MAX ? { groupAtLeastLevel: { production: i + 1 } } : null }));
  writeFileSync(p, JSON.stringify(pr, null, 2) + '\n');
}
console.log(`gen-levels: ${kinds.length} kinds to level ${MAX}${firstRun ? ' (first run: handMade recorded)' : ''}`);
