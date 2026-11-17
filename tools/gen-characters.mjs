// The named characters of the story and the side quests (doc/story_tree.md, PLAN.md Phase 4): one preset of the villager rig each, no hand-drawn body. Safe to run again.
//   node tools/gen-characters.mjs                 writes src/data/characters/<id>.json
//   node tools/gen-characters.mjs --spec <file>   also writes a sheet spec for tools/art-preview.mjs (one row a character, medieval suit)
// A preset: look (sex, skin, hair, hide = the stone-age garment, pants), and for each age the armour of the rig he wears (data/armors, null = his own clothes),
// the weapon he fights with if struck (weapons.json, null = none) and the tool in his hand in a picture (data/handtools).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/data/characters');
const SKIN = { pale: '#f0c8a0', fair: '#e0ac69', tan: '#c68642', dark: '#8d5524' };
const HAIR = { black: '#1f1611', brown: '#3b2a1a', grey: '#9a968c', white: '#e4e0d4', red: '#7a3516', bald: '#c68642' };

// id, title (shown before the name), role, sex, skin, hair, hide, pants, stone [armor, weapon, tool], medieval [armor, weapon, tool], shape (one line), fixed (a name of his own instead of a drawn one)
const C = [
  ['firekeeper', 'Người giữ lửa', 'keeper', 'f', 'tan', 'white', '#a0522d', '#6b4a2a', ['hide', null, null], ['peasant_hood_grey', null, null], 'Bà lão lưng còng, tóc bạc, áo choàng nâu đỏ, luôn ám mùi khói.'],
  ['old_master', 'Thợ già', 'mentor', 'm', 'tan', 'grey', '#7b6a4c', '#4a4032', ['grass', null, ['hammer', 2]], ['peasant_straw_brown', null, ['hammer', 4]], 'Ông thợ gầy, tóc muối tiêu, tay chai, búa không rời tay.'],
  ['merchant', 'Thương lái', 'merchant', 'm', 'fair', 'brown', '#b8893c', '#5a3d7a', ['hide', null, null], ['peasant_hood_brown', null, null], 'Người buôn béo tốt, áo vàng đất, quần tím, túi da bên hông.'],
  ['envoy', 'Sứ giả', 'envoy', 'f', 'fair', 'black', '#3f63a8', '#2c3e6b', ['hide', null, null], ['archer', null, null], 'Người đưa tin dáng cao, áo xanh của làng bạn, đi nhẹ và nhanh.'],
  ['sleuth', 'Thám tử', 'sleuth', 'm', 'pale', 'black', '#5c5c58', '#33332f', ['grass', null, null], ['watchman', 'bronze_sword', ['bronze_sword', 3]], 'Người gầy, áo xám tro, mắt không bao giờ nhìn một chỗ lâu.'],
  ['assassin', 'Người bí ẩn', 'assassin', 'm', 'pale', 'black', '#2a2a30', '#1c1c20', ['hide', 'hatchet', ['hatchet', 2]], ['archer', 'arming_sword', ['arming_sword', 4]], 'Kẻ trùm kín, áo sẫm màu, dao ngắn giấu trong tay áo.'],
  ['mole', 'Nội gián', 'mole', 'f', 'fair', 'brown', '#8b6a45', '#3f63a8', ['grass', null, null], ['peasant_hood_brown', null, null], 'Trông như mọi người dân khác: đó chính là cái nghề của cô ta.'],
  ['boss_chief', 'Thủ lĩnh', 'chief', 'm', 'dark', 'black', '#6e1f1f', '#2a1a12', ['bone', 'mace', ['mace', 2]], ['templar', 'knight_sword', ['knight_sword', 5]], 'Thủ lĩnh làng mạnh nhất: vai rộng, giáp nặng, áo choàng đỏ sẫm.'],
  ['general', 'Tướng', 'general', 'm', 'tan', 'brown', '#3f63a8', '#2c3e6b', ['bone', 'spear', ['spear', 2]], ['sergeant', 'arming_sword', ['arming_sword', 4]], 'Tướng của làng: mặt sẹo, giáp gọn, giọng ra lệnh quen miệng.'],
  ['bodyguard', 'Cận vệ', 'bodyguard', 'm', 'fair', 'black', '#4a5560', '#2f3840', ['hide', 'spear', ['spear', 2]], ['warden', 'ward_sword', ['arming_sword', 5]], 'Người cao lớn, giáp kín, đứng sau lưng người mình giữ nửa bước.'],
  ['elder', 'Trưởng lão', 'elder', 'm', 'tan', 'white', '#d9cfb4', '#8a7c5a', ['hide', null, null], ['peasant_hood_grey', null, null], 'Cụ già râu trắng, áo sáng màu, nói chậm, ai cũng im khi cụ nói.'],
  ['monk', 'Nhà sư lang thang', 'monk', 'm', 'tan', 'bald', '#c9722a', '#8a4a1c', ['grass', null, null], ['peasant_straw_grey', null, null], 'Đầu trọc, áo vải màu nghệ, chân trần, một cái bát gỗ.'],
  ['apprentice', 'Đứa học việc', 'apprentice', 'f', 'fair', 'red', '#7fa35a', '#4d6b38', ['grass', null, ['hammer', 1]], ['peasant_straw_brown', null, ['hammer', 3]], 'Cô bé tóc hung, áo xanh lá, tay lúc nào cũng dính than.'],
  ['smith', 'Thợ rèn', 'smith', 'm', 'dark', 'black', '#4a3a2e', '#2e241c', ['hide', null, ['hammer', 2]], ['peasant_hood_brown', null, ['hammer', 5]], 'Thợ rèn vai u, tạp dề da cháy sém, cánh tay to như bắp chân.'],
  ['ba_muc', 'Bà Mực', 'scribe', 'f', 'tan', 'grey', '#5a4a6a', '#3a3040', ['hide', null, null], ['peasant_hood_grey', null, null], 'Bà lão ghi sổ của làng, tóc muối tiêu, tay dính mực, cuốn sổ da mòn góc không rời tay.'],
];

const suit = ([armor, weapon, tool]) => ({ armor, weapon, handtool: tool ? { kind: tool[0], tier: tool[1] } : null });
const W = (p, o) => { const crlf = existsSync(p) && readFileSync(p, 'utf8').includes('\r\n'); writeFileSync(p, JSON.stringify(o, null, 2).replace(/\n/g, crlf ? '\r\n' : '\n') + (crlf ? '\r\n' : '\n')); };
mkdirSync(dir, { recursive: true });
const out = C.map(([id, title, role, sex, skin, hair, hide, pants, stone, ancient, shape]) => ({
  id, name: title, role, look: { sex, skin: SKIN[skin], hair: HAIR[hair], hide, pants }, stone: suit(stone), ancient: suit(ancient), shape,
}));
for (const c of out) W(join(dir, `${c.id}.json`), c);
console.log(`${out.length} characters -> src/data/characters/`);

const at = process.argv.indexOf('--spec');
if (at > 0 && process.argv[at + 1]) {
  const cell = (c, age) => ({ look: c.look, armor: c[age].armor ?? undefined, tool: c[age].handtool ?? { tier: 0 } });
  // two rows of one person a cell: the stone age, then the medieval age
  writeFileSync(process.argv[at + 1], JSON.stringify({ scale: 3, rows: ['stone', 'ancient'].map((age) => ({ anim: 'idle', view: 'right', cells: out.map((c) => cell(c, age)) })) }, null, 1));
  console.log(`spec -> ${process.argv[at + 1]}`);
}
