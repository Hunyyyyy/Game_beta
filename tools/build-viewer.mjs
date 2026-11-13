import { build } from 'esbuild';
import { scss } from './scss.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const out = await build({ entryPoints: ['tools/viewer-entry.js'], bundle: true, write: false, format: 'iife', loader: { '.json': 'json' } });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/anim-viewer.html', readFileSync('tools/viewer.html', 'utf8').replace('/*STYLE*/', () => scss('tools/styles/viewer.scss')).replace('/*BUNDLE*/', () => js));
console.log('built dist/anim-viewer.html');

// the page that shows the medieval soldiers moving (tools/art)
const med = await build({ entryPoints: ['tools/art/medieval-viewer-entry.js'], bundle: true, write: false, format: 'iife', loader: { '.json': 'json' } });
writeFileSync('dist/medieval-viewer.html', readFileSync('tools/art/medieval-viewer.html', 'utf8').replace('/*BUNDLE*/', () => med.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')));
console.log('built dist/medieval-viewer.html');
