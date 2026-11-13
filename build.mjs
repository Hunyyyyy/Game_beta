import { build } from 'esbuild';
import { copyFileSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { scss } from './tools/scss.mjs';
import './tools/gen-content.mjs';
import './tools/gen-music.mjs';

const out = await build({
  entryPoints: ['src/main.ts'],
  bundle: true, write: false, format: 'iife', target: 'es2020', minify: false, loader: { '.json': 'json' },
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync('src/index.html', 'utf8');
const css = scss('src/styles/main.scss');
const page = tpl.replace('/*STYLE*/', () => css).replace('/*BUNDLE*/', () => js);
mkdirSync('dist', { recursive: true });
// artifact.html: mảnh HTML (không doctype) để dán vào trang bao ngoài; index.html: tệp chạy độc lập.
writeFileSync('dist/artifact.html', page);
writeFileSync('dist/index.html', '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"></head><body>' + page + '</body></html>');
// sounds: copied next to index.html (dist/sounds/), loaded by <audio> so the page also works from file://
rmSync('dist/sounds', { recursive: true, force: true }); // no leftovers of renamed files
mkdirSync('dist/sounds', { recursive: true });
const copySounds = (dir) => { for (const f of readdirSync('src/sounds/' + dir)) { const rel = dir + f; if (statSync('src/sounds/' + rel).isDirectory()) { if (f !== 'Wyrmsun') { mkdirSync('dist/sounds/' + rel, { recursive: true }); copySounds(rel + '/'); } } else copyFileSync('src/sounds/' + rel, 'dist/sounds/' + rel); } };
copySounds('');
console.log('built', (page.length / 1024).toFixed(0) + ' KB');
