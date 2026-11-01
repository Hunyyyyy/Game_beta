import { build } from 'esbuild';
import { scss } from './scss.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Every blueprint under src/data/blueprints and src/content is bundled into the page through a virtual module, so new blueprints show up on rebuild.
// The drawings of a building live beside its data: src/content/buildings/<kind>/L1.json (building.json is data, not a drawing).
// Names keep their folder, e.g. "buildings/storage/L2" or "nature/trees/tree_round".
const roots = [resolve('src/data/blueprints'), resolve('src/content')];
const rootOf = {};
for (const root of roots) for (const f of readdirSync(root, { recursive: true }).map((x) => x.split('\\').join('/'))) if (f.endsWith('.json') && !f.endsWith('building.json')) rootOf[f] = root;
const all = Object.keys(rootOf).sort();
// an empty .json is a placeholder waiting to be drawn: leave it out of the page instead of failing the build
const files = all.filter((f) => readFileSync(resolve(rootOf[f], f), 'utf8').trim() !== '');
if (files.length < all.length) console.log(`skipped ${all.length - files.length} empty placeholder files`);
const virtual = {
  name: 'blueprints',
  setup(b) {
    b.onResolve({ filter: /^virtual:blueprints$/ }, () => ({ path: 'blueprints', namespace: 'bp' }));
    b.onLoad({ filter: /.*/, namespace: 'bp' }, () => ({
      resolveDir: process.cwd(),
      loader: 'js',
      contents: files.map((f, i) => `import b${i} from ${JSON.stringify(resolve(rootOf[f], f).split('\\').join('/'))};`).join('\n')
        + `\nexport default { ${files.map((f, i) => `${JSON.stringify(f.replace(/\.json$/, ''))}: b${i}`).join(', ')} };`,
    }));
  },
};
const out = await build({ entryPoints: ['tools/blueprint-viewer-entry.js'], bundle: true, write: false, format: 'iife', loader: { '.json': 'json' }, plugins: [virtual] });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/blueprint-viewer.html', readFileSync('tools/blueprint-viewer.html', 'utf8').replace('/*STYLE*/', () => scss('tools/styles/blueprint-viewer.scss')).replace('/*BUNDLE*/', () => js));
console.log('built dist/blueprint-viewer.html (' + files.length + ' blueprints)');
