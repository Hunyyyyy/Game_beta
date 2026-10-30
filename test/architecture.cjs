// Layer rules for src/sim: who may import whom. Run with `npm run test:arch`.
// The point is that a change in one system cannot reach into another by a side door: systems talk through the Sim object.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// the layers, see src/sim/ARCHITECTURE.md
const DATA = ['codec', 'constants', 'resources', 'rng', 'calendar', 'buildings', 'jobs', 'tools', 'combat', 'research', 'world', 'fog', 'path', 'model', 'formations', 'statsys', 'progression'];
const VILLAGE = ['warplan', 'siege', 'training', 'mounts', 'construction', 'economy', 'works', 'houses', 'inventory', 'commands', 'labor', 'movement', 'villagers', 'environment', 'rest', 'defense', 'roles', 'forecast', 'notices'];
const CREATURES = ['battle', 'fauna', 'tribes', 'army', 'scouting'];
const CORE = ['sim', 'simwar'];
const GUIDE = ['quests'];
const PERSISTENCE = ['save'];
const TOOLING = ['dev'];

const imports = (file) => {
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const m of text.matchAll(/^import\s+(type\s+)?(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/gm)) out.push({ type: !!m[1], from: m[2] });
  for (const m of text.matchAll(/^export\s+(type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gm)) out.push({ type: !!m[1], from: m[2] });
  return out;
};
const simFiles = fs.readdirSync(path.join(root, 'sim')).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts')).map((f) => f.replace(/\.ts$/, ''));
const known = new Set([...DATA, ...VILLAGE, ...CREATURES, ...CORE, ...GUIDE, ...PERSISTENCE, ...TOOLING]);
ok(simFiles.every((f) => known.has(f)), 'every file in src/sim belongs to a layer (new files must be added to test/architecture.cjs and ARCHITECTURE.md): ' + simFiles.filter((f) => !known.has(f)).join(', '));

const local = (imp) => (imp.from.startsWith('./') ? imp.from.slice(2) : null);
const check = (name, layer, allowed, { simAsType = true } = {}) => {
  const bad = [];
  const imp = imports(path.join(root, 'sim', name + '.ts'));
  for (const i of imp) {
    if (/^\.\.\/(ui|render|save)/.test(i.from) || /^\.\.\/main/.test(i.from)) bad.push(`${i.from} (the simulation never reaches into the screen)`);
    const l = local(i);
    if (!l) continue;
    if (l === 'sim') { if (!(i.type && simAsType)) bad.push(`./sim as a value (use "import type"): cycles start here`); continue; }
    if (!allowed.includes(l)) bad.push(`./${l} (${layer} may not use it)`);
  }
  ok(bad.length === 0, `${layer}: ${name}.ts keeps to its layer${bad.length ? ' — ' + bad.join('; ') : ''}`);
};
for (const f of DATA.filter((f) => simFiles.includes(f))) check(f, 'data', DATA, { simAsType: false });
for (const f of VILLAGE) if (simFiles.includes(f)) check(f, 'village system', [...DATA, 'battle', 'fauna']);
for (const f of CREATURES) if (simFiles.includes(f)) check(f, 'creature system', [...DATA, ...CREATURES]);
check('quests', 'quest guide', [...DATA, ...VILLAGE, ...CREATURES]);
check('dev', 'dev tools', [...DATA, ...CREATURES]);
check('save', 'persistence', [...DATA]);

// the screen goes through the Sim object, never into a system
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const outside = walk(root).filter((f) => f.endsWith('.ts') && !f.includes(path.sep + 'sim' + path.sep));
const reached = [];
for (const f of outside) for (const i of imports(f)) { const m = /\/sim\/([a-z]+)$/.exec(i.from); if (m && VILLAGE.includes(m[1])) reached.push(`${path.relative(root, f)} → ${m[1]}`); }
ok(reached.length === 0, 'ui, render and main use Sim, not its systems' + (reached.length ? ': ' + reached.join(', ') : ''));

// no DOM in the simulation
const dom = [];
for (const f of simFiles) if (/\b(document|window|HTMLElement|localStorage|requestAnimationFrame)\b/.test(fs.readFileSync(path.join(root, 'sim', f + '.ts'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) dom.push(f);
ok(dom.length === 0, 'src/sim does not touch the browser' + (dom.length ? ': ' + dom.join(', ') : ''));

// state belongs to the Sim: a file-level `let` would hide state from the save and leak between games
const loose = simFiles.filter((f) => /^(let|var)\s/m.test(fs.readFileSync(path.join(root, 'sim', f + '.ts'), 'utf8')));
ok(loose.length === 0, 'no file-level let/var in src/sim (state lives in Sim)' + (loose.length ? ': ' + loose.join(', ') : ''));

// no file grows back into a heap
const big = simFiles.filter((f) => fs.readFileSync(path.join(root, 'sim', f + '.ts'), 'utf8').split('\n').length > 650);
ok(big.length === 0, 'no file in src/sim passes 650 lines' + (big.length ? ': ' + big.join(', ') : ''));

console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
