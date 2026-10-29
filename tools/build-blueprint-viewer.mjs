import { build } from 'esbuild';
import { scss } from './scss.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Every src/data/blueprints/**/*.json is bundled into the page through a virtual module, so new blueprints show up on rebuild.
// Names keep their folder, e.g. "buildings/storage/L2" or "nature/trees/tree_round".
const dir = resolve('src/data/blueprints');
const all = readdirSync(dir, { recursive: true }).map((f) => f.split('\\').join('/')).filter((f) => f.endsWith('.json')).sort();
// an empty .json is a placeholder waiting to be drawn: leave it out of the page instead of failing the build
const files = all.filter((f) => readFileSync(resolve(dir, f), 'utf8').trim() !== '');
if (files.length < all.length) console.log(`skipped ${all.length - files.length} empty placeholder files`);
const virtual = {
  name: 'blueprints',
  setup(b) {
    b.onResolve({ filter: /^virtual:blueprints$/ }, () => ({ path: 'blueprints', namespace: 'bp' }));
    b.onLoad({ filter: /.*/, namespace: 'bp' }, () => ({
      resolveDir: dir,
      loader: 'js',
      contents: files.map((f, i) => `import b${i} from ${JSON.stringify('./' + f)};`).join('\n')
        + `\nexport default { ${files.map((f, i) => `${JSON.stringify(f.replace(/\.json$/, ''))}: b${i}`).join(', ')} };`,
    }));
  },
};
const out = await build({ entryPoints: ['tools/blueprint-viewer-entry.js'], bundle: true, write: false, format: 'iife', loader: { '.json': 'json' }, plugins: [virtual] });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/blueprint-viewer.html', readFileSync('tools/blueprint-viewer.html', 'utf8').replace('/*STYLE*/', () => scss('tools/styles/blueprint-viewer.scss')).replace('/*BUNDLE*/', () => js));
console.log('built dist/blueprint-viewer.html (' + files.length + ' blueprints)');
