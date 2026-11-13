// Re-encodes the music (src/sounds/**/musics/*.mp3) to a small size so the site publishes quickly: `npm run music`.
// A track already at the target bitrate is left alone, so it is safe to run again after adding new music.
// Run it by hand and commit the result; the build and the workflow do not (they would re-encode on every push).
import ffmpeg from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { readdirSync, renameSync, rmSync, statSync } from 'node:fs';

const KBPS = 96;
const dirs = ['src/sounds/envairoment/musics', 'src/sounds/battle/musics'];
const kbpsOf = (file) => { const r = spawnSync(ffmpeg, ['-i', file], { encoding: 'utf8' }); const m = /bitrate: (\d+) kb\/s/.exec(r.stderr ?? ''); return m ? Number(m[1]) : 0; };
let before = 0, after = 0;
for (const dir of dirs) {
  for (const name of readdirSync(dir).filter((f) => /\.mp3$/i.test(f))) {
    const file = `${dir}/${name}`, tmp = `${dir}/.shrinking.mp3`, size = statSync(file).size;
    before += size;
    if (kbpsOf(file) <= KBPS + 8) { after += size; continue; } // already small
    const r = spawnSync(ffmpeg, ['-y', '-i', file, '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', `${KBPS}k`, tmp], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(`failed: ${file}\n${r.stderr}`); rmSync(tmp, { force: true }); process.exit(1); }
    renameSync(tmp, file);
    after += statSync(file).size;
    console.log(`${name}: ${(size / 1e6).toFixed(1)} MB -> ${(statSync(file).size / 1e6).toFixed(1)} MB`);
  }
}
console.log(`music: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
