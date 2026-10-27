import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const out = await build({
  entryPoints: ['src/main.ts'],
  bundle: true, write: false, format: 'iife', target: 'es2020', minify: false, loader: { '.json': 'json' },
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync('src/index.html', 'utf8');
const page = tpl.replace('/*BUNDLE*/', () => js);
mkdirSync('dist', { recursive: true });
// artifact.html: mảnh HTML (không doctype) để dán vào trang bao ngoài; index.html: tệp chạy độc lập.
writeFileSync('dist/artifact.html', page);
writeFileSync('dist/index.html', '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"></head><body>' + page + '</body></html>');
console.log('built', (page.length / 1024).toFixed(0) + ' KB');
