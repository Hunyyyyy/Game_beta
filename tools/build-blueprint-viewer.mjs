import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Every src/data/blueprints/**/*.json is bundled into the page through a virtual module, so new blueprints show up on rebuild.
// Names keep their folder, e.g. "buildings/storage/L2" or "nature/trees/tree_round".
const dir = resolve('src/data/blueprints');
const files = readdirSync(dir, { recursive: true }).map((f) => f.split('\\').join('/')).filter((f) => f.endsWith('.json')).sort();
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
writeFileSync('dist/blueprint-viewer.html', readFileSync('tools/blueprint-viewer.html', 'utf8').replace('/*BUNDLE*/', () => js));
console.log('built dist/blueprint-viewer.html (' + files.length + ' blueprints)');
