// Soldier ranks 6..10 of the four branches (foot, archer, cavalry, guard): one script, safe to run again.
//   node tools/gen-ranks.mjs
// Writes: ranks.json (names, gear, costs, power/ration of ranks 8-10 from `curve`), weapons.json (gear of ranks 6-10 with craft costs), mounts.json + animals/bodies.json (3 new mounts),
//   research.json (recipeLevel), researchtree.json (research that opens ranks 8-10 + rank costs), handtools/*.json, armors/*.json, blueprints/medieval/tools/ranked.json (icons), and registers the hand tools and armours in character/rig.js.
// The look of a new suit is its base suit with other colours (see ARMOR_LOOK); the new hand tools are drawn here from rectangles.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = (p) => join(root, 'src', 'data', p);

// ---------------------------------------------------------------- the ranks
// weapon / armor: ids of data/weapons.json; mount: id of data/mounts.json; cost: price of one soldier
const RANKS = {
  foot: [
    { rank: 6, name: 'Trọng giáp binh', weapon: 'greatsword', armor: 'guard', cost: { coin: 60 } },
    { rank: 7, name: 'Dũng sĩ thánh giáo', weapon: 'knight_sword', armor: 'templar', cost: { coin: 100 } },
    { rank: 8, name: 'Kích thủ giáp lá', weapon: 'halberd', armor: 'halberdier', cost: { coin: 150 } },
    { rank: 9, name: 'Hiệp sĩ bộ', weapon: 'bastard_sword', armor: 'footknight', cost: { coin: 220 } },
    { rank: 10, name: 'Đội trưởng cấm quân', weapon: 'royal_blade', armor: 'captain', cost: { coin: 320 } },
  ],
  archer: [
    { rank: 6, name: 'Xạ thủ trường cung', weapon: 'longbow', armor: 'marksman', cost: { coin: 60 } },
    { rank: 7, name: 'Nỏ thủ', weapon: 'alloy_crossbow', armor: 'sniper', cost: { coin: 100 } },
    { rank: 8, name: 'Nỏ thủ nặng', weapon: 'heavy_crossbow', armor: 'arbalist', cost: { coin: 150 } },
    { rank: 9, name: 'Hỏa thương thủ', weapon: 'fire_lance', armor: 'firelancer', cost: { coin: 220 } },
    { rank: 10, name: 'Pháo thủ tay', weapon: 'hand_cannon', armor: 'gunner', cost: { coin: 320 } },
  ],
  cavalry: [
    { rank: 6, name: 'Kỵ binh bọc giáp', weapon: 'heavy_lance', armor: 'royalrider', mount: 'warhorse', cost: { coin: 260, food: 400, hide: 120 } },
    { rank: 7, name: 'Thánh kỵ sĩ', weapon: 'paladin_lance', armor: 'paladin', mount: 'silverhorse', cost: { coin: 500, food: 600, hide: 180 } },
    { rank: 8, name: 'Kỵ binh nặng giáo dài', weapon: 'long_lance', armor: 'heavyrider', mount: 'destrier', cost: { coin: 650, food: 800, hide: 240 } },
    { rank: 9, name: 'Hiệp sĩ kỵ', weapon: 'knight_lance', armor: 'knight', mount: 'knighthorse', cost: { coin: 850, food: 1000, hide: 300 } },
    { rank: 10, name: 'Kỵ sĩ vương', weapon: 'royal_lance', armor: 'kingsrider', mount: 'royalhorse', cost: { coin: 1100, food: 1300, hide: 380 } },
  ],
  guard: [
    { rank: 6, name: 'Lính gác chuyên nghiệp', weapon: 'pike', armor: 'sergeant', cost: { coin: 60 } },
    { rank: 7, name: 'Cận vệ thành trì', weapon: 'ward_sword', armor: 'warden', cost: { coin: 100 } },
    { rank: 8, name: 'Cấm vệ', weapon: 'glaive', armor: 'royalguard', cost: { coin: 150 } },
    { rank: 9, name: 'Cận vệ tinh nhuệ', weapon: 'poleaxe', armor: 'eliteguard', cost: { coin: 220 } },
    { rank: 10, name: 'Cận vệ vương', weapon: 'partisan', armor: 'kingsguard', cost: { coin: 320 } },
  ],
};

// ---------------------------------------------------------------- the gear (weapons.json): ranks 6-7 only gain a craft cost, ranks 8-10 are new
const W = (name, type, range, damage, cycle, style, rank, cost, time, more = {}) => ({ name, type, range, damage, cycle, ...more, style, tier: 5, rank, cost, time });
const WEAPONS = {
  pike: { cost: { steel: 3, hardwood: 3 }, time: 110 },
  heavy_lance: { cost: { steel: 4, hardwood: 4 }, time: 120 },
  greatsword: { cost: { steel: 5, hardwood: 1, leather: 1 }, time: 120 },
  longbow: { cost: { yew: 3, sinew: 3, feather: 3, steel: 1 }, time: 120 },
  ward_sword: { cost: { fine_steel: 2, steel: 2, leather: 1 }, time: 140 },
  knight_sword: { cost: { fine_steel: 3, steel: 2, leather: 1 }, time: 150 },
  paladin_lance: { cost: { fine_steel: 3, hardwood: 4, cloth: 1 }, time: 150 },
  alloy_crossbow: { cost: { fine_steel: 3, hardwood: 3, sinew: 3, steel: 1 }, time: 160 },
  halberd: W('Kích giáp lá', 'slash', 1.8, 36, 1.5, 'thrust', 8, { fine_steel: 3, steel: 3, hardwood: 4 }, 170),
  heavy_crossbow: W('Nỏ nặng', 'pierce', 15, 62, 3.4, 'crossbow', 8, { fine_steel: 4, hardwood: 4, sinew: 4, steel: 2 }, 180, { ranged: true, projectile: 'arrow' }),
  long_lance: W('Giáo kỵ dài', 'pierce', 2.9, 52, 1.8, 'rider_lance', 8, { fine_steel: 4, hardwood: 5, cloth: 1 }, 180),
  glaive: W('Đao cán dài', 'slash', 2.3, 22, 1.5, 'guard_pike', 8, { fine_steel: 3, steel: 2, hardwood: 4 }, 170),
  bastard_sword: W('Kiếm hiệp sĩ', 'slash', 1.3, 44, 1.3, 'sword_shield', 9, { fine_steel: 6, steel: 3, leather: 2 }, 210, { shield: 'tower' }),
  fire_lance: W('Hỏa thương', 'pierce', 9, 80, 3.0, 'crossbow', 9, { fine_steel: 4, steel: 4, hardwood: 3, coal: 4 }, 220, { ranged: true, projectile: 'arrow' }),
  knight_lance: W('Thương hiệp sĩ kỵ', 'pierce', 3.1, 66, 1.9, 'rider_lance', 9, { fine_steel: 5, hardwood: 5, cloth: 2 }, 210),
  poleaxe: W('Rìu thương', 'slash', 2.3, 28, 1.5, 'guard_pike', 9, { fine_steel: 5, steel: 3, hardwood: 4 }, 210),
  royal_blade: W('Kiếm cấm quân', 'slash', 1.4, 54, 1.3, 'sword_shield', 10, { fine_steel: 9, steel: 4, leather: 2 }, 260, { shield: 'aegis' }),
  hand_cannon: W('Súng thần công tay', 'pierce', 11, 100, 4.2, 'crossbow', 10, { fine_steel: 7, steel: 6, coal: 6, hardwood: 3 }, 280, { ranged: true, projectile: 'arrow' }),
  royal_lance: W('Thương vương kỵ', 'pierce', 3.3, 82, 2.0, 'rider_lance', 10, { fine_steel: 7, hardwood: 6, cloth: 3 }, 260),
  partisan: W('Thương cận vệ vương', 'pierce', 2.4, 36, 1.5, 'guard_pike', 10, { fine_steel: 7, steel: 4, hardwood: 4, cloth: 1 }, 250),
};
const A = (name, defm, defr, cost, time) => ({ name, defm, defr, tier: 5, cost, time });
const ARMORS = {
  sergeant: { cost: { steel: 6, leather: 3, iron: 2 }, time: 180 },
  guard: { cost: { steel: 9, leather: 3 }, time: 200 },
  marksman: { cost: { steel: 4, leather: 4, cloth: 2 }, time: 170 },
  royalrider: { cost: { steel: 8, leather: 3, cloth: 1 }, time: 210 },
  templar: { cost: { fine_steel: 6, steel: 6, cloth: 2, leather: 2 }, time: 260 },
  sniper: { cost: { steel: 4, leather: 5, cloth: 3 }, time: 200 },
  paladin: { cost: { fine_steel: 6, steel: 5, cloth: 3, leather: 2 }, time: 270 },
  warden: { cost: { fine_steel: 5, steel: 6, leather: 2 }, time: 250 },
  halberdier: A('Giáp lá kích thủ', 215, 190, { fine_steel: 7, steel: 7, cloth: 3, leather: 2 }, 300),
  arbalist: A('Giáp nỏ thủ nặng', 120, 140, { fine_steel: 3, steel: 4, leather: 6, cloth: 3 }, 260),
  heavyrider: A('Giáp kỵ binh nặng', 205, 180, { fine_steel: 7, steel: 6, cloth: 4, leather: 3 }, 310),
  royalguard: A('Giáp cấm vệ', 190, 165, { fine_steel: 6, steel: 7, cloth: 2, leather: 3 }, 300),
  footknight: A('Giáp hiệp sĩ bộ', 245, 215, { fine_steel: 10, steel: 9, cloth: 5, leather: 3 }, 360),
  firelancer: A('Giáp hỏa thương thủ', 135, 155, { fine_steel: 4, steel: 5, leather: 7, cloth: 4 }, 320),
  knight: A('Giáp hiệp sĩ kỵ', 230, 200, { fine_steel: 10, steel: 8, cloth: 5, leather: 4 }, 370),
  eliteguard: A('Giáp cận vệ tinh nhuệ', 215, 190, { fine_steel: 9, steel: 9, cloth: 4, leather: 4 }, 350),
  captain: A('Giáp đội trưởng cấm quân', 280, 245, { fine_steel: 14, steel: 12, cloth: 6, leather: 4 }, 440),
  gunner: A('Giáp pháo thủ', 150, 170, { fine_steel: 6, steel: 6, leather: 8, cloth: 5 }, 380),
  kingsrider: A('Giáp kỵ sĩ vương', 260, 225, { fine_steel: 14, steel: 11, cloth: 7, leather: 5 }, 450),
  kingsguard: A('Giáp cận vệ vương', 245, 215, { fine_steel: 13, steel: 12, cloth: 5, leather: 5 }, 430),
};
const RANK_OF_GEAR = {}; // gear id -> rank, for recipeLevel and icons
for (const list of Object.values(RANKS)) for (const r of list) { RANK_OF_GEAR[r.weapon] = r.rank; RANK_OF_GEAR[r.armor] = r.rank; }

const MOUNTS = {
  destrier: { name: 'Chiến mã phủ giáp', hidden: true, tier: 7, species: 'horse_barded', speed: 1.25, guard: 0.5, ride: 19, dx: -8, cost: { food: 800, hide: 240, coin: 400 }, time: 1500 },
  knighthorse: { name: 'Chiến mã hiệp sĩ', hidden: true, tier: 8, species: 'horse_caparison', speed: 1.2, guard: 0.45, ride: 19, dx: -8, cost: { food: 1000, hide: 300, coin: 600 }, time: 1800 },
  royalhorse: { name: 'Chiến mã vương giả', hidden: true, tier: 9, species: 'horse_royal', speed: 1.15, guard: 0.4, ride: 19, dx: -8, cost: { food: 1300, hide: 380, coin: 850 }, time: 2200 },
};
const BODIES = {
  horse_barded: { from: 'horse_armored', palette: { base: '#6a4a30', light: '#8e6a46', dark: '#3a2616' }, gear: { blanket: '#3a3f4a', saddle: '#2a1c10', chest: '#8e9aa4', plate: '#8e9aa4', plateH: '#d4dde3', plateD: '#4a555e' } },
  horse_caparison: { from: 'horse_silver', palette: {}, gear: { blanket: '#2f56a6', chest: '#e6edf2', stud: '#e0b84e', plate: '#cfd6dc', plateH: '#ffffff', plateD: '#8a939b' } },
  horse_royal: { from: 'horse_silver', palette: { base: '#2a2a30', light: '#4a4a54', dark: '#15151a', accent: '#d8b04a' }, gear: { blanket: '#5a2a8a', chest: '#e0b84e', stud: '#f6d56a', bridle: '#e0b84e', plate: '#e0b84e', plateH: '#f6e08a', plateD: '#a8802a' } },
};

// ---------------------------------------------------------------- the pictures of the new suits: a base suit with other colours (tint: steel parts x rgb; set: palette keys; crest: a coloured top on the helmet)
const ARMOR_LOOK = {
  halberdier: { base: 'guard', note: 'Kích thủ giáp lá (Bộ binh bậc 8): giáp tấm của hộ vệ, tông ấm, lông mào đỏ thẫm.', tint: [1.0, 0.97, 0.92], set: { royal: '#a8372c', royalD: '#6e2018' } },
  footknight: { base: 'templar', note: 'Hiệp sĩ bộ (Bộ binh bậc 9): giáp tấm thánh giáo, áo choàng xanh sẫm, chữ thập vàng.', tint: [0.95, 0.97, 1.04], set: { cloth: '#243e7a', clothD: '#18295a', cross: '#e0b84e' } },
  captain: { base: 'templar', note: 'Đội trưởng cấm quân (Bộ binh bậc 10): giáp tấm mạ vàng, áo choàng đỏ thẫm.', tint: [1.04, 1.0, 0.9], set: { cloth: '#8a1f2b', clothD: '#5e1520', cross: '#f2d26a', gold: '#f6d56a' } },
  arbalist: { base: 'sniper', note: 'Nỏ thủ nặng (Cung thủ bậc 8): giáp da bồi và áo xích, màu nâu.', tint: [0.92, 0.94, 0.97], set: { lea: '#6b4a2a', leaD: '#4a321c', pants: '#3a2c20', pantsD: '#2a2018' } },
  firelancer: { base: 'sniper', note: 'Hỏa thương thủ (Cung thủ bậc 9): giáp da nâu đỏ, áo xích sẫm.', tint: [0.88, 0.88, 0.92], set: { lea: '#7a2f26', leaD: '#52201a', pants: '#3a2a24', pantsD: '#2a1c18' } },
  gunner: { base: 'sniper', note: 'Pháo thủ tay (Cung thủ bậc 10): giáp da đen, đinh tán vàng.', tint: [0.8, 0.82, 0.88], set: { lea: '#22262c', leaD: '#14171b', stud: '#e0b84e', pants: '#1e2126', pantsD: '#14161a', fR: '#e0b84e' } },
  heavyrider: { base: 'paladin', note: 'Kỵ binh nặng giáo dài (Kỵ binh bậc 8): giáp tấm xám than, lông mào đỏ.', tint: [0.88, 0.9, 0.94], set: { cloth: '#3a3f4a', clothD: '#262a32', plume: '#a8372c', plumeD: '#6e2018', cross: '#e0b84e' } },
  knight: { base: 'paladin', note: 'Hiệp sĩ kỵ (Kỵ binh bậc 9): giáp tấm sáng, áo choàng đỏ, lông mào xanh.', tint: [1.0, 1.0, 1.02], set: { cloth: '#b8322a', clothD: '#7a2018', plume: '#2f56a6', plumeD: '#1f3a74', cross: '#f2eee2' } },
  kingsrider: { base: 'paladin', note: 'Kỵ sĩ vương (Kỵ binh bậc 10): giáp mạ vàng, áo choàng tím vương giả.', tint: [1.04, 1.0, 0.9], set: { cloth: '#5a2a8a', clothD: '#3a1a5a', plume: '#e0b84e', plumeD: '#b08a2e', cross: '#f6d56a', gold: '#f6d56a' } },
  royalguard: { base: 'warden', note: 'Cấm vệ (Lính gác bậc 8): giáp tấm 3/4, mào tím.', tint: [0.95, 0.97, 1.03], crest: ['#6b2a8a', '#45195e'] },
  eliteguard: { base: 'warden', note: 'Cận vệ tinh nhuệ (Lính gác bậc 9): giáp tấm 3/4 viền vàng, mào vàng.', tint: [1.02, 1.0, 0.95], set: { gold: '#f0cd5a' }, crest: ['#e0b84e', '#a8802a'] },
  kingsguard: { base: 'warden', note: 'Cận vệ vương (Lính gác bậc 10): giáp tấm mạ vàng, mào đỏ thắm.', tint: [1.05, 1.0, 0.9], set: { gold: '#f6d56a' }, crest: ['#c0282d', '#7e1a1e'] },
};

// ---------------------------------------------------------------- small helpers
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mul = (h, f) => toHex(hex(h).map((v, i) => v * f[i]));
const read = (p) => { const raw = readFileSync(p, 'utf8'); return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') }; };
const write = (p, text, crlf) => writeFileSync(p, crlf ? text.replace(/\n/g, '\r\n') : text);
const json = (p) => JSON.parse(read(p).text);
const writeJson = (p, o, indent = 1) => writeFileSync(p, JSON.stringify(o, null, indent) + '\n');
/** The index of the bracket that closes the one at `open` (strings are skipped). */
function closeOf(s, open) {
  const o = s[open], c = o === '{' ? '}' : ']';
  let depth = 0, inStr = false;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === o) depth++; else if (ch === c && --depth === 0) return i;
  }
  throw new Error('unbalanced');
}
const indentBlock = (txt, n) => txt.split('\n').map((l, i) => (i ? ' '.repeat(n) + l : l)).join('\n');

// ---------------------------------------------------------------- ranks.json
{
  const p = D('ranks.json'), r = json(p);
  const c = (r.curve ??= { _note: 'Ranks past 7 follow this: power x growth per rank, ration + rationStep per rank (data/ranks.json arrays are written by tools/gen-ranks.mjs). The game reads the arrays.', from: 7, growth: 1.35, rationStep: 0.28 });
  const maxRank = 10;
  for (let k = r.power.length; k < maxRank; k++) {
    r.power[k] = Math.round(r.power[c.from - 1] * c.growth ** (k + 1 - c.from) * 10) / 10;
    r.ration[k] = Math.round((r.ration[c.from - 1] + c.rationStep * (k + 1 - c.from)) * 100) / 100;
  }
  r.eraRanks.ancient = Array.from({ length: maxRank }, (_, i) => i + 1);
  for (const [branch, list] of Object.entries(RANKS)) for (const d of list) {
    const old = r.branches[branch].find((x) => x.rank === d.rank), next = { rank: d.rank, name: d.name, weapon: d.weapon, armor: d.armor, ...(d.mount ? { mount: d.mount } : {}), cost: d.cost };
    if (old) r.branches[branch][r.branches[branch].indexOf(old)] = next; else r.branches[branch].push(next);
  }
  r._note = r._note.replace(/ soon: chưa luyện được[^.]*\./, '').replace(/thời Trung cổ là 4\.\.7/, 'thời Trung cổ là 4..10');
  if (!r._note.includes('Bậc 8-10')) r._note += ' Bậc 8-10 (tools/gen-ranks.mjs, `curve`): sức mạnh x1.35 mỗi bậc; lính bậc N cần Nhà chung cấp N (hoặc cấp cao nhất đã có).';
  writeJson(p, r, 2);
}

// ---------------------------------------------------------------- weapons.json
{
  const p = D('weapons.json'), { text: raw, crlf } = read(p);
  let text = raw;
  const patch = (section, entries) => {
    const open = text.indexOf('{', text.indexOf(`  "${section}": {`)), close = closeOf(text, open);
    let body = text.slice(open + 1, close);
    for (const id of Object.keys(entries)) {
      const m = new RegExp(`\\n    "${id}": \\{`).exec(body);
      if (!m) continue;
      const brace = body.indexOf('{', m.index), end = closeOf(body, brace);
      let cut = end + 1; if (body[cut] === ',') cut++;
      const old = JSON.parse(body.slice(brace, end + 1));
      entries[id] = { ...old, ...entries[id] }; // what is already there is kept, the new fields win
      body = body.slice(0, m.index) + body.slice(cut);
    }
    body = body.replace(/,?\s*$/, '');
    for (const [id, o] of Object.entries(entries)) body += `,\n    "${id}": ${indentBlock(JSON.stringify(o, null, 2), 4)}`;
    text = text.slice(0, open + 1) + body + '\n  ' + text.slice(close);
  };
  patch('weapons', structuredClone(WEAPONS));
  patch('armor', structuredClone(ARMORS));
  write(p, text, crlf);
  JSON.parse(text); // still valid
}

// ---------------------------------------------------------------- mounts.json and the bodies of the mounts
{
  const p = D('mounts.json'), { text: raw, crlf } = read(p);
  let text = raw;
  for (const id of Object.keys(MOUNTS)) text = text.replace(new RegExp(`\\n    "${id}": \\{[^\\n]*\\},?(?=\\n)`), '');
  const close = text.lastIndexOf('\n  }\n}');
  let body = text.slice(0, close).replace(/,?\s*$/, '');
  for (const [id, o] of Object.entries(MOUNTS)) body += `,\n    "${id}": ${JSON.stringify(o).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`;
  text = body + text.slice(close);
  write(p, text, crlf);
  JSON.parse(text);
  const bp = D('animals/bodies.json'), bodies = json(bp);
  for (const [id, b] of Object.entries(BODIES)) { const base = structuredClone(bodies[b.from]); base.name = MOUNTS[Object.keys(MOUNTS).find((k) => MOUNTS[k].species === id)].name; base.palette = { ...base.palette, ...b.palette }; base.gear = { ...base.gear, ...b.gear }; bodies[id] = base; }
  writeJson(bp, bodies, 1);
}

// ---------------------------------------------------------------- research.json: the workshop level each piece of gear needs (the level of the rank)
{
  const p = D('research.json'), { text, crlf } = read(p);
  const m = /"recipeLevel": (\{[^}]*\})/.exec(text), levels = JSON.parse(m[1]);
  for (const [id, rank] of Object.entries(RANK_OF_GEAR)) levels[`${id}5`] = rank;
  const out = JSON.stringify(levels).replace(/":/g, '": ').replace(/,"/g, ', "');
  write(p, text.replace(m[1], out), crlf);
}

// ---------------------------------------------------------------- researchtree.json: the research that opens ranks 8-10 and what it costs
{
  const p = D('researchtree.json'), { text: raw, crlf } = read(p);
  let text = raw;
  const LAB = 4, LABS = { 8: 6, 9: 7, 10: 8 }, costs = {
    8: { cost: { food: 6000, wood: 3000, stone: 2200, hide: 700, coin: 1400, fine_steel: 50, cloth: 30, steel: 60, leather: 45 }, time: 30000 },
    9: { cost: { food: 9000, wood: 4500, stone: 3300, hide: 1000, coin: 2200, fine_steel: 75, cloth: 45, steel: 90, leather: 65 }, time: 42000 },
    10: { cost: { food: 14000, wood: 7000, stone: 5000, hide: 1500, coin: 3500, fine_steel: 110, cloth: 65, steel: 130, leather: 90 }, time: 60000 },
  };
  // the cost of each rank
  const rt = text.indexOf('"rankTiers"');
  const rolesAt = text.indexOf('        "roles": [', rt);
  if (!/"8": \{/.test(text.slice(rt, rolesAt))) {
    const add = Object.entries(costs).map(([n, c]) => `        "${n}": ${indentBlock(JSON.stringify({ needLab: LABS[n], ...c }, null, 2), 8)},\n`).join('');
    text = text.slice(0, rolesAt) + add + text.slice(rolesAt);
  }
  // the rows of each arm: after the row of rank 7 come five rows, rows 1, 3 and 5 hold the leaps of ranks 8, 9 and 10
  const CROSS = { 8: ['craft_ms2'], 9: ['research_ms2'], 10: ['craft_ms2', 'research_ms2'] };
  for (const role of Object.keys(RANKS)) {
    if (text.includes(`"id": "${role}_tier8"`)) continue;
    const at = text.indexOf(`"id": "${role}_tier7"`), start = text.lastIndexOf('\n              {\n', at) + 1 + 14, end = closeOf(text, start);
    const row7 = JSON.parse(text.slice(start, end + 1));
    // the row two rows before the leap row holds the stats of the other half (move, attack, stamina)
    const strand = JSON.parse(text).pillars.list.flatMap((q) => q.strands).find((s) => s.rows.some((r) => r.leap?.id === `${role}_tier7`));
    const rowPrev = strand.rows[strand.rows.findIndex((r) => r.leap?.id === `${role}_tier7`) - 2];
    const prefix = row7.group.replace(/m\d+$/, 'm');
    const leapRow = (n, g) => {
      const d = RANKS[role].find((x) => x.rank === n).name, row = structuredClone(row7);
      row.group = `${prefix}${g}`;
      row.leap = { id: `${role}_tier${n}`, share: 0.9, lab: LABS[n], side: { name: `Giá luyện ${d.toLowerCase()}`, short: `Giá ${d.toLowerCase()}`, desc: `Giảm giá luyện ${d.toLowerCase()} 5% mỗi cấp.`, effect: { [`train_${role}_${n}`]: 5 } } };
      row.cross = CROSS[n];
      return row;
    };
    const statRow = (g) => { const row = structuredClone(rowPrev); row.group = `${prefix}${g}`; delete row.leap; delete row.cross; return row; };
    const rows = [leapRow(8, 11), statRow(12), leapRow(9, 13), statRow(14), leapRow(10, 15)];
    text = text.slice(0, end + 1) + rows.map((r) => ',\n' + ' '.repeat(14) + indentBlock(JSON.stringify(r, null, 2), 14)).join('') + text.slice(end + 1);
  }
  write(p, text, crlf);
  JSON.parse(text);
}

// ---------------------------------------------------------------- hand tools (side view, pivot at the handle end; head and handle only)
const R = (x, y, w, h, color) => ({ x, y, w, h, color });
const GOLD = '#e0b84e', RED = '#a8372c';
const polePoses = (head) => { const shaft = (h) => R(0, -30, 1, h, 'wood'); const up = head.map((r) => ({ ...r, y: r.y - 30 })); return { planted: [shaft(43), ...up], planted1: [shaft(44), ...up] }; };
const TOOLS = {
  halberd: { name: 'Halberd', handle: { length: 20, width: 1, color: 'wood' }, head: [R(0, -10, 1, 4, 'head'), R(0, -10, 1, 1, 'light'), R(1, -6, 4, 6, 'head'), R(4, -6, 1, 6, 'light'), R(1, -6, 1, 6, 'dark'), R(-3, -4, 3, 2, 'dark'), R(-3, -4, 1, 1, 'light'), R(-1, 0, 3, 1, 'dark'), R(0, 1, 1, 3, RED)] },
  bastard_sword: { name: 'Bastard sword', handle: { length: 8, width: 1, color: '#2a1c10' }, head: [R(-4, -1, 9, 1, GOLD), R(-4, -2, 1, 1, GOLD), R(4, -2, 1, 1, GOLD), R(-1, -23, 3, 22, 'head'), R(-1, -24, 2, 1, 'light'), R(-1, -23, 1, 22, 'light'), R(1, -22, 1, 20, 'dark'), R(0, -18, 1, 14, 'dark'), R(-1, 0, 3, 1, GOLD), R(-1, 8, 3, 2, GOLD), R(0, 3, 1, 4, RED)] },
  royal_blade: { name: 'Royal blade', handle: { length: 8, width: 1, color: '#2a1c10' }, head: [R(-5, -1, 11, 1, GOLD), R(-5, -3, 1, 2, GOLD), R(5, -3, 1, 2, GOLD), R(-1, -25, 4, 24, 'head'), R(0, -26, 2, 1, 'light'), R(-1, -25, 1, 24, 'light'), R(2, -24, 1, 22, 'dark'), R(1, -20, 1, 14, GOLD), R(0, -3, 2, 2, '#b8322a'), R(-1, 0, 4, 1, GOLD), R(-1, 8, 4, 3, GOLD), R(0, 9, 2, 1, '#b8322a')] },
  heavy_crossbow: { name: 'Heavy crossbow', handle: { length: 13, width: 2, color: '#3a2410' }, head: [R(-7, -2, 15, 2, '#6a4424'), R(-8, -3, 1, 1, '#c98a3a'), R(8, -3, 1, 1, '#c98a3a'), R(-7, 0, 1, 1, '#cfc3a0'), R(7, 0, 1, 1, '#cfc3a0'), R(-5, 1, 1, 1, '#cfc3a0'), R(5, 1, 1, 1, '#cfc3a0'), R(0, -6, 1, 5, '#d8d2bf'), R(0, -7, 1, 1, 'light'), R(0, 0, 1, 11, '#d8d2bf'), R(-2, 3, 5, 1, '#8e9aa4'), R(-1, 10, 3, 2, '#3a2410')] },
  fire_lance: { name: 'Fire lance', handle: { length: 10, width: 2, color: '#3a2410' }, head: [R(0, -20, 1, 4, 'head'), R(0, -20, 1, 1, 'light'), R(-1, -16, 3, 3, 'head'), R(0, -13, 2, 14, '#3e3a36'), R(0, -13, 1, 14, '#5c564f'), R(-1, -9, 4, 1, '#c98a3a'), R(-1, -4, 4, 1, '#c98a3a'), R(0, -14, 2, 1, '#1a1815'), R(0, 0, 1, 7, '#6a4424'), R(-1, 6, 3, 2, '#3a2410'), R(1, -17, 1, 1, '#e8a23a')] },
  hand_cannon: { name: 'Hand cannon', handle: { length: 8, width: 2, color: '#3a2410' }, head: [R(-1, -11, 4, 11, '#3e3a36'), R(-1, -11, 1, 11, '#5c564f'), R(-1, -12, 4, 1, '#1a1815'), R(-2, -8, 6, 1, '#c98a3a'), R(-2, -3, 6, 1, '#c98a3a'), R(0, 0, 1, 8, '#6a4424'), R(1, 0, 1, 7, '#4a2d16'), R(-1, 7, 3, 3, '#3a2410'), R(2, -1, 1, 1, '#e8a23a')] },
  long_lance: { name: 'Long lance', handle: { length: 24, width: 1, color: 'wood' }, head: [R(0, -11, 1, 3, 'light'), R(-1, -9, 3, 7, 'head'), R(-1, -9, 1, 6, 'light'), R(1, -8, 1, 6, 'dark'), R(-2, -2, 5, 1, 'dark'), R(-3, 19, 7, 2, 'dark')] },
  knight_lance: { name: 'Knight lance', handle: { length: 25, width: 1, color: 'wood' }, head: [R(0, -12, 1, 3, 'light'), R(-1, -10, 3, 8, 'head'), R(-1, -10, 1, 7, 'light'), R(1, -9, 1, 7, 'dark'), R(-2, -2, 5, 1, 'dark'), R(1, -1, 4, 5, '#b8322a'), R(-3, 20, 7, 2, GOLD)] },
  royal_lance: { name: 'Royal lance', handle: { length: 26, width: 1, color: 'wood' }, head: [R(0, -13, 1, 4, GOLD), R(-1, -10, 3, 9, 'head'), R(-1, -10, 1, 8, 'light'), R(1, -9, 1, 8, 'dark'), R(-2, -1, 5, 1, GOLD), R(1, 0, 5, 6, '#5a2a8a'), R(1, 0, 5, 1, GOLD), R(-3, 21, 7, 2, GOLD)] },
  glaive: { name: 'Glaive', handle: { length: 15, width: 1, color: 'wood' }, head: [R(0, -15, 1, 2, 'head'), R(-1, -13, 3, 12, 'head'), R(-1, -12, 1, 10, 'light'), R(1, -11, 1, 9, 'dark'), R(2, -9, 1, 5, 'head'), R(-1, 0, 3, 1, 'dark'), R(-1, 1, 1, 3, '#2f56a6'), R(1, 1, 1, 4, '#2f56a6')] },
  poleaxe: { name: 'Poleaxe', handle: { length: 15, width: 1, color: 'wood' }, head: [R(0, -13, 1, 5, 'head'), R(0, -13, 1, 1, 'light'), R(1, -8, 4, 6, 'head'), R(4, -8, 1, 6, 'light'), R(1, -8, 1, 6, 'dark'), R(-4, -7, 3, 3, 'dark'), R(-4, -7, 1, 1, 'light'), R(-1, 0, 3, 1, GOLD), R(-1, 1, 1, 3, '#7a2018'), R(1, 1, 1, 4, '#7a2018')] },
  partisan: { name: 'Partisan', handle: { length: 15, width: 1, color: 'wood' }, head: [R(0, -14, 1, 3, 'light'), R(-2, -11, 5, 10, 'head'), R(-2, -11, 1, 9, 'light'), R(2, -10, 1, 9, 'dark'), R(0, -9, 1, 7, 'dark'), R(-4, -3, 3, 2, 'head'), R(3, -3, 2, 2, 'head'), R(-2, 0, 5, 1, GOLD), R(-1, 1, 1, 4, '#c0282d'), R(1, 1, 1, 5, '#c0282d'), R(0, 4, 1, 1, GOLD)] },
};
for (const id of ['glaive', 'poleaxe', 'partisan']) { const t = TOOLS[id]; t._note = `Guard rank ${RANK_OF_GEAR[id]}: a pole weapon in the pose "planted" like pike.json (generated by tools/gen-ranks.mjs).`; t.poses = polePoses(t.head); }
for (const [id, t] of Object.entries(TOOLS)) writeJson(D(`handtools/${id}.json`), t, 1);

// ---------------------------------------------------------------- armours: the base suit in other colours
function suit(id, look) {
  const a = structuredClone(json(D(`armors/${look.base}.json`)));
  a._note = `${look.note} (Bậc ${RANK_OF_GEAR[id]}; tạo bởi tools/gen-ranks.mjs từ ${look.base}.)`;
  a.name = ARMORS[id].name;
  const steelish = /^(steel|plate|iron|chain|mail)/, keep = /^(slit|belt|scab|eye|boot|glove|hair)/;
  for (const k of Object.keys(a.palette)) if (steelish.test(k) && !keep.test(k)) a.palette[k] = mul(a.palette[k], look.tint);
  for (const [k, v] of Object.entries(look.set ?? {})) if (k in a.palette) a.palette[k] = v;
  if (look.crest) {
    a.palette.crest = look.crest[0]; a.palette.crestD = look.crest[1];
    for (const view of ['side', 'front', 'back']) { const h = a[view].head; h.legend.C = 'crest'; h.rows[0] = h.rows[0].replace(/[^.]/g, 'C'); }
  }
  return a;
}
for (const [id, look] of Object.entries(ARMOR_LOOK)) writeJson(D(`armors/${id}.json`), suit(id, look), 1);

// ---------------------------------------------------------------- icons 16 x 16 of every piece of gear of ranks 6-10 (keyed like the recipes: id + tier)
const PAL = { line: '#2b1d10', wood: '#8a5e34', woodL: '#aa7c48', steel: '#aeb6bd', steelL: '#dfe5ea', steelD: '#6f7880', gold: '#e0b84e', goldD: '#a8802a', dark: '#3e3a36', red: '#a8372c', blue: '#2f56a6', purple: '#5a2a8a', leather: '#6a4424', leatherD: '#3a2410', cloth: '#d8d2bf' };
const L = (from, to, w, color) => ({ shape: 'line', from, to, w, color });
const RC = (x, y, w, h, color) => ({ shape: 'rect', x, y, w, h, color });
const PO = (points, color) => ({ shape: 'poly', points, color });
const ICONS = {
  sword: (c = 'steel', g = 'gold') => [L([4, 12], [14, 1], 2, c), L([5, 11], [13, 2], 1, 'steelL'), L([2, 9], [7, 14], 2, g), L([2, 13], [4, 15], 2, 'leatherD')],
  greatsword: () => [L([4, 12], [14, 1], 3, 'steel'), L([5, 11], [13, 2], 1, 'steelL'), L([2, 9], [7, 14], 2, 'steelD'), L([2, 13], [4, 15], 2, 'leatherD')],
  pole: (head, shaft = 'wood') => [L([3, 14], [12, 3], 1, shaft), ...head],
  lance: (flag) => [L([2, 14], [14, 2], 1, 'wood'), PO([[12, 1], [15, 1], [15, 4], [14, 4]], 'steelL'), L([11, 4], [13, 6], 1, flag), RC(1, 13, 3, 2, 'steelD')],
  crossbow: (limb) => [L([2, 5], [14, 5], 2, limb), L([8, 3], [8, 14], 2, 'steelL'), RC(6, 12, 5, 3, 'leatherD'), L([8, 3], [8, 1], 1, 'steel')],
  gun: (len) => [L([2, 10], [len, 3], 3, 'dark'), L([2, 11], [len - 1, 4], 1, 'steelD'), L([2, 11], [6, 14], 3, 'leather'), RC(4, 8, 2, 2, 'gold'), RC(len - 3, 4, 2, 2, 'gold')],
  armor: (main, trim, cloth) => [PO([[3, 3], [6, 2], [10, 2], [13, 3], [15, 7], [12, 8], [12, 15], [4, 15], [4, 8], [1, 7]], main), RC(6, 4, 4, 4, 'steelL'), RC(4, 9, 8, 1, trim), ...(cloth ? [RC(6, 10, 4, 5, cloth), RC(7, 10, 2, 5, trim)] : [RC(4, 12, 8, 1, 'steelD')])],
};
const ICON_OF = {
  pike: ICONS.pole([PO([[11, 1], [14, 4], [12, 5], [10, 3]], 'steelL')], 'wood'), heavy_lance: ICONS.lance('red'), greatsword: ICONS.greatsword(), longbow: [L([4, 2], [12, 14], 1, 'wood'), L([4, 2], [4, 14], 1, 'steelL'), L([4, 14], [12, 14], 1, 'woodL')],
  ward_sword: ICONS.sword('steel', 'steelD'), knight_sword: ICONS.sword('steel', 'gold'), paladin_lance: ICONS.lance('cloth'), alloy_crossbow: ICONS.crossbow('steel'),
  halberd: ICONS.pole([PO([[10, 2], [14, 3], [14, 8], [10, 7]], 'steelL'), L([11, 1], [12, 0], 1, 'steel')]), heavy_crossbow: ICONS.crossbow('leather'),
  long_lance: ICONS.lance('blue'), glaive: ICONS.pole([PO([[10, 1], [14, 2], [12, 8], [9, 6]], 'steelL')], 'wood'),
  bastard_sword: ICONS.sword('steelL', 'gold'), fire_lance: [L([3, 14], [11, 4], 1, 'wood'), L([5, 10], [12, 4], 2, 'dark'), PO([[11, 1], [14, 1], [13, 4], [11, 4]], 'steelL'), RC(11, 0, 2, 1, 'gold')], knight_lance: ICONS.lance('red'), poleaxe: ICONS.pole([PO([[10, 2], [14, 4], [14, 8], [10, 7]], 'steelL'), RC(7, 3, 3, 3, 'steelD')]),
  royal_blade: [L([4, 12], [14, 1], 3, 'steelL'), L([5, 11], [13, 2], 1, 'gold'), L([1, 9], [7, 14], 2, 'gold'), L([2, 13], [4, 15], 2, 'red')], hand_cannon: ICONS.gun(13), royal_lance: ICONS.lance('purple'), partisan: ICONS.pole([PO([[10, 0], [14, 3], [13, 8], [9, 6]], 'steelL'), RC(8, 4, 2, 2, 'steelD')], 'wood'),
};
const SUIT_COLORS = { sergeant: ['steel', 'gold', 'blue'], guard: ['steelL', 'gold', 'blue'], marksman: ['steel', 'gold', 'red'], royalrider: ['steel', 'gold', 'blue'], templar: ['steelL', 'gold', 'cloth'], sniper: ['steelD', 'steelL', 'leather'], paladin: ['steelL', 'gold', 'cloth'], warden: ['steel', 'gold', null],
  halberdier: ['steel', 'gold', 'red'], arbalist: ['steelD', 'steelL', 'leather'], heavyrider: ['steelD', 'gold', 'red'], royalguard: ['steel', 'gold', 'purple'], footknight: ['steelL', 'gold', 'blue'], firelancer: ['steelD', 'steelL', 'red'], knight: ['steelL', 'gold', 'red'], eliteguard: ['steelL', 'gold', null], captain: ['steelL', 'gold', 'red'], gunner: ['dark', 'gold', 'leatherD'], kingsrider: ['steelL', 'gold', 'purple'], kingsguard: ['steelL', 'gold', 'red'] };
const blueprint = (name, layers) => ({ name, type: 'prop', size: [16, 16], anchor: [8, 15], params: {}, palette: PAL, layers: [...layers, { shape: 'outline', color: 'line' }] });
{
  const out = {};
  for (const [id, layers] of Object.entries(ICON_OF)) out[`${id}5`] = blueprint(WEAPONS[id].name ?? id, layers);
  for (const [id, [main, trim, cloth]] of Object.entries(SUIT_COLORS)) out[`${id}5`] = blueprint(ARMORS[id].name ?? id, ICONS.armor(main, trim, cloth));
  writeFileSync(join(root, 'src/data/blueprints/medieval/tools/ranked.json'), JSON.stringify(out) + '\n');
}

// ---------------------------------------------------------------- character/rig.js: register the new hand tools and suits
{
  const p = join(root, 'src/character/rig.js'), { text: raw, crlf } = read(p);
  let text = raw;
  const camel = (s) => s.replace(/_(\w)/g, (_, c) => c.toUpperCase());
  const tools = Object.keys(TOOLS), suits = Object.keys(ARMOR_LOOK);
  const imports = [...tools.map((t) => `import ${camel(t)}Tool from '../data/handtools/${t}.json';`), ...suits.map((s) => `import ${s}Armor from '../data/armors/${s}.json';`)];
  const marker = '// gen-ranks:imports';
  const block = `${marker}\n${imports.join('\n')}\n// gen-ranks:end`;
  if (text.includes(marker)) text = text.replace(new RegExp(`${marker}[\\s\\S]*?// gen-ranks:end`), block);
  else text = text.replace("import peasantStrawGreyArmor from '../data/armors/peasant_straw_grey.json';\n", (m) => `${m}${block}\n`);
  const patchObj = (name, entries) => {
    const start = text.indexOf(`const ${name} = {`), end = text.indexOf('};', start);
    const body = text.slice(start + `const ${name} = {`.length, end).replace(/,?\s*\/\*gen-ranks\*\/.*$/, '');
    text = text.slice(0, start) + `const ${name} = {` + body.trimEnd().replace(/,$/, '') + `, /*gen-ranks*/ ${entries} ` + text.slice(end);
  };
  patchObj('handTools', tools.map((t) => `${t}: ${camel(t)}Tool`).join(', '));
  patchObj('armors', suits.map((s) => `${s}: ${s}Armor`).join(', '));
  write(p, text, crlf);
}
console.log('gen-ranks: ranks 6-10 written');
