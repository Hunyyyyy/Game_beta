// Lists the music by looking at the folders, so a new track is just a new file (nothing to register):
//   src/sounds/envairoment/musics/*   the peace music
//   src/sounds/battle/musics/*        the war music (except the track sounds.json names as `end.lost.file`, played when a war is lost)
// Run by build.mjs; the generated file is kept in git so that tsc sees it too.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const sounds = JSON.parse(readFileSync('src/data/sounds.json', 'utf8'));
const list = (dir) => (existsSync('src/sounds/' + dir) ? readdirSync('src/sounds/' + dir, { withFileTypes: true }) : [])
  .filter((f) => f.isFile() && /\.(mp3|ogg|wav|m4a)$/i.test(f.name)).map((f) => dir + '/' + f.name).sort();
const lost = sounds.end?.lost?.file;
const out = { peace: list('envairoment/musics'), war: list('battle/musics').filter((f) => f !== lost) };
const text = JSON.stringify(out, null, 2) + '\n';
const file = 'src/data/musics.gen.json';
if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
console.log(`music: ${out.peace.length} peace, ${out.war.length} war`);
