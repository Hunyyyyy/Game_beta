// Story tree simulator: plays the tree of src/data/story without the game and prints the story as text.
//   node tools/simStory.mjs --seed 12345 --mode normal --policy kind     one game, told day by day
//   node tools/simStory.mjs --check                                      only check the data (exit 1 on errors)
//   node tools/simStory.mjs --runs 200 [--seed 1] [--policy mix]         many seeds: dead ends and how often each tip comes
// mode: easy | normal | harsh.  policy (how the pretend player answers): kind | hard | trade | random | mix (runs only).
// The rules are the game's own (src/sim/storydata.ts, bundled here with esbuild); only the world is pretend: the Nhà chung rises on a fixed calendar, visitors come by the dice of the seed,
// wars are fought on fixed days of the medieval age (more of them for the hard policy) and the hold on the land (`power`) grows with the days, by the policy.
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i < 0 ? dflt : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; };

const bundle = await build({
  stdin: { contents: "export * from './src/sim/storydata'; export * from './src/sim/storyscenes'; export { evalCond, seedRoll } from './src/sim/encounterdata';", resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error',
});
const tmp = mkdtempSync(join(tmpdir(), 'simstory-'));
writeFileSync(join(tmp, 'story.mjs'), bundle.outputFiles[0].text);
const S = await import(pathToFileURL(join(tmp, 'story.mjs')).href);
rmSync(tmp, { recursive: true, force: true });
const { STORY } = S;

// ---------------------------------------------------------------- the checker
const report = S.validateStory();
const showReport = (all) => {
  for (const e of report.errors) console.log(`ERROR  ${e}`);
  if (all) for (const w of report.warnings) console.log(`warn   ${w}`);
  console.log(`check: ${report.errors.length} errors, ${report.warnings.length} warnings (${STORY.threads.length} branches, ${STORY.knots.length} knots, ${STORY.leaves.length} leaves, ${STORY.fruits.length} fruits, ${STORY.tips.length} tips)`);
};
if (arg('check')) { showReport(true); process.exit(report.errors.length ? 1 : 0); }

// ---------------------------------------------------------------- one pretend game
const WANT = { kind: { nhan: 2, hop: 1, tin: 1 }, hard: { uy: 2, nhan: -1, lo: -1 }, trade: { tin: 2, cua: 2, lo: 1, luat: 1 } };
const scenes = new Map(S.STORY_SCENES.map((s) => [s.id, s.scene]));
const nameOf = (id) => STORY.threads.flatMap((t) => t.chapters).find((c) => c.id === id)?.name ?? S.storyLeaf(id)?.name ?? STORY.fruits.find((f) => f.id === id)?.name ?? id;

function play(seed, mode, policy, quiet) {
  const st = S.initialStory(), deeds = [], seen = {}, lines = [], arrivals = [];
  st.mode = mode;
  const dice = (tag) => S.seedRoll(seed, `sim|${tag}`), say = (d, text) => { if (!quiet) lines.push(`Ngày ${String(d).padStart(3)}  ${text}`); };
  // the calendar of the pretend village: Nhà chung 2 and 3, a leader village mapped, then all fallen and level 4 (the medieval age), then a level every `step` days up to 10
  const j = (tag, n) => Math.floor(dice(tag) * n), L2 = 4 + j('l2', 3), L3 = 13 + j('l3', 5), MAP = 20 + j('map', 6), ERA = 45 + j('era', 12), step = 10 + j('step', 5), END = ERA + step * 6 + 15;
  const PW = { hard: 1.2, kind: 0.6, trade: 0.7 }[policy] ?? 0.3 + dice('pw') * 1.1, wars = (policy === 'hard' ? [0.8, 1.6, 2.4] : policy === 'random' ? [1 + dice('w1'), 2.2 + dice('w2')] : [1.5, 2.6]).map((k) => ERA + Math.round(step * k));
  const worldAt = (d) => ({
    power: d >= ERA ? Math.min(1, ((d - ERA) / (step * 5)) * PW) : 0,
    day: d, seed, era: d >= ERA ? 'ancient' : 'stone', fireLevel: d >= ERA ? Math.min(10, 4 + Math.floor((d - ERA) / step)) : d >= L3 ? 3 : d >= L2 ? 2 : 1, bossContact: d >= ERA ? 1 : d >= MAP ? 0.5 : 0, seen, deeds,
    base: { stock: {}, day: d, fireLevel: 1, rel: 0, truth: 'honest', refugees: deeds.filter((x) => x.key === 'took_refugees' || x.key === 'took_in_wanderer').length, soldiers: Math.min(60, d), captives: 0, room: 5, party: 0, flags: [], mood: 0, deeds },
  });
  const score = (ds, tag) => (policy === 'random' ? dice(tag) : ds.reduce((a, k) => a + Object.entries(STORY.deeds[k] ?? {}).reduce((b, [m, n]) => b + n * (WANT[policy]?.[m] ?? 0), 0), 0) + dice(tag) * 0.01);
  const best = (opts, deedsOf, tag) => opts.map((o, i) => [o, score(deedsOf(o), `${tag}|${i}`)]).sort((a, b) => b[1] - a[1])[0]?.[0];
  const saw = (id, d) => { seen[id] = { times: (seen[id]?.times ?? 0) + 1, lastDay: d }; };

  for (let d = 1; d <= END; d++) {
    const w = worldAt(d), ctx = { ...w.base, fireLevel: w.fireLevel, story: S.condOf(st, w) };
    if (d === ERA) say(d, '=== Ngày Sương Tan: bắt đầu thời Trung cổ ===');
    if (wars.includes(d)) { deeds.push({ key: 'war_fought', day: d }); say(d, '[trận] Quân làng vừa đi đánh về'); }
    // the scenes the tree sent arrive, and the pretend player answers
    for (const a of arrivals.filter((x) => x.day <= d)) {
      arrivals.splice(arrivals.indexOf(a), 1);
      const sc = scenes.get(a.script), o = sc && best(sc.options.filter((x) => S.evalCond(x.cond, ctx)), (x) => (x.deed ? [x.deed] : []), a.script);
      saw(a.script, d);
      if (!o) continue;
      if (o.deed) deeds.push({ key: o.deed, day: d });
      for (const e of o.effects ?? []) { if (e.deed) deeds.push({ key: e.deed, day: d }); if (e.sflag && !st.flags.includes(e.sflag)) st.flags.push(e.sflag); }
      say(d, `[cảnh] ${nameOf(a.script)}: chọn "${o.text}"`);
    }
    // the old visitor scripts of the branches come by themselves, about one day in three
    const tree = STORY.trees.find((t) => t.era === w.era);
    for (const th of STORY.threads) {
      if (th.tree !== tree?.id) continue;
      const ch = th.chapters.find((c) => !(seen[c.script ?? c.id]?.times > 0));
      if (!ch?.script || dice(`visit|${ch.id}|${d}`) > 0.33) continue;
      const o = best(ch.options ?? [], (x) => x.deeds, ch.id);
      saw(ch.script, d);
      for (const k of o?.deeds ?? []) deeds.push({ key: k, day: d });
      say(d, `[khách] ${ch.name}: chọn "${o?.label ?? '?'}"`);
    }
    for (const out of S.stepStory(st, worldAt(d))) {
      if (out.kind === 'tell') say(d, out.what === 'rumor' ? `(lời đồn) ${out.text}` : `>>> ${out.name}. ${out.text}`);
      else if (out.kind === 'scene') arrivals.push({ day: d + Math.max(1, out.days), script: out.script });
      else if (out.effect.deed) deeds.push({ key: out.effect.deed, day: d });
      else say(d, `    hệ quả x${out.share}: ${JSON.stringify(out.effect)}`);
    }
  }
  return { st, lines, marks: S.marksOf(deeds, END, st.eraDay, st.bonus), end: END, legacy: STORY.unlocks.filter((u) => u.from.length && S.isUnlocked(st, [], u.key, 10)).map((u) => u.key) };
}

// ---------------------------------------------------------------- many seeds
const seed0 = Number(arg('seed', 1)), mode = String(arg('mode', 'normal')), policy = String(arg('policy', 'kind')), runs = Number(arg('runs', 0));
if (!['easy', 'normal', 'harsh'].includes(mode)) { console.error(`unknown mode "${mode}"`); process.exit(2); }
showReport(false);
if (runs > 0) {
  const POL = ['kind', 'hard', 'trade', 'random'], tips = {}, leaves = {}, dead = {}, sign = {}, fruit = {};
  for (let i = 0; i < runs; i++) {
    const { st, legacy } = play(seed0 + i, mode, policy === 'mix' ? POL[i % POL.length] : policy, true);
    for (const k of legacy) sign[k] = (sign[k] ?? 0) + 1;
    for (const f of Object.keys(st.fruits)) fruit[f] = (fruit[f] ?? 0) + 1;
    for (const [slot, t] of Object.entries(st.tips)) { (tips[slot] ??= {})[t.main] = (tips[slot][t.main] ?? 0) + 1; }
    for (const k of Object.values(st.knots)) leaves[k.leaf] = (leaves[k.leaf] ?? 0) + 1;
    for (const tree of STORY.trees) if (STORY.knots.some((k) => k.tree === tree.id) && !Object.keys(st.knots).some((id) => STORY.knots.find((k) => k.id === id)?.tree === tree.id)) dead[tree.id] = (dead[tree.id] ?? 0) + 1;
  }
  console.log(`\n${runs} games, seeds ${seed0}..${seed0 + runs - 1}, mode ${mode}, policy ${policy}`);
  console.log(`dead ends (a tree where no knot fired): ${Object.keys(dead).length ? Object.entries(dead).map(([t, n]) => `${t} ${n}`).join(', ') : 'none'}`);
  for (const [slot, row] of Object.entries(tips)) {
    console.log(`\ntips of slot "${slot}":`);
    for (const t of STORY.tips.filter((x) => row[x.id] !== undefined || (!x.off && STORY.trees.find((tr) => tr.id === x.tree)?.tips.some((s) => s.slot === slot)))) console.log(`  ${String(row[t.id] ?? 0).padStart(4)}  ${t.id} ${t.name}${row[t.id] ? '' : '   <-- never'}`);
  }
  console.log('\nfruits ripened:');
  for (const f of STORY.fruits) console.log(`  ${String(fruit[f.id] ?? 0).padStart(4)}  ${f.id} ${f.name}${fruit[f.id] ? '' : '   <-- never'}`);
  console.log('\nDi sản: share of games where the story opens each specialist (wanted: 5% to 60%):');
  for (const u of STORY.unlocks.filter((x) => x.from.length)) { const pct = (100 * (sign[u.key] ?? 0)) / runs; console.log(`  ${pct.toFixed(1).padStart(5)}%  ${u.key} <- ${u.from.join(', ')}${pct < 5 ? '   <-- under 5%' : pct > 60 ? '   <-- over 60%' : ''}`); }
  console.log('\nleaves drawn:');
  for (const l of [...STORY.leaves, ...Object.values(STORY.wild).flat()]) console.log(`  ${String(leaves[l.id] ?? 0).padStart(4)}  ${l.id} ${l.name}${leaves[l.id] ? '' : '   <-- never'}`);
} else {
  const { st, lines, marks, end, legacy } = play(seed0, mode, policy, false);
  console.log(`\nseed ${seed0}, mode ${mode}, policy ${policy}, ${end} days\n`);
  console.log(lines.join('\n'));
  console.log(`\nDấu cuối ván: ${Object.entries(marks).map(([m, v]) => `${m} ${v}`).join(', ')}`);
  console.log(`Cờ: ${st.flags.join(', ') || '(không)'}`);
  console.log(`Nút -> lá: ${Object.entries(st.knots).map(([k, x]) => `${k} -> ${x.leaf}${x.pale ? ' (nhạt)' : ''}${x.wild ? ' (biến)' : ''}${x.old ? ' (chuyện cũ)' : ''}`).join('; ') || '(không)'}`);
  console.log(`Trái: ${Object.keys(st.fruits).join(', ') || '(không)'}`);
  console.log(`Di sản: ${legacy.join(', ') || '(không)'}`);
  console.log(`Ngọn: ${Object.entries(st.tips).map(([s, t]) => `${s}: ${t.main}${t.second ? ` + ${t.second}` : ''}`).join('; ') || '(không)'}`);
}
