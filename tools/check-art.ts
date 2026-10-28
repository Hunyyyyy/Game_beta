// Renders every building blueprint at every build stage and reports the ones that throw or warn.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Blueprint, BlueprintDef } from '../src/blueprint/blueprint';

const roots = [join('src', 'data', 'blueprints', 'stone_age', 'buildings'), join('src', 'data', 'blueprints', 'stone_age', 'tools')];
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
let bad = 0;
for (const file of roots.flatMap(walk).filter((f) => f.endsWith('.json'))) {
  let def: BlueprintDef;
  try { def = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.log('BAD JSON', file, String(e)); bad++; continue; }
  for (let st = 0; st <= 4; st++) {
    try {
      const res = Blueprint.render(def, { seed: 5, params: { st1: +(st >= 1), st2: +(st >= 2), st3: +(st >= 3), st4: +(st >= 4) } });
      if (res.warnings.length) { console.log('WARN', file, 'stage', st, res.warnings.slice(0, 3)); bad++; break; }
    } catch (e) { console.log('THROW', file, 'stage', st, String(e).slice(0, 200)); bad++; break; }
  }
}
console.log(bad ? `${bad} blueprint(s) with problems` : 'all blueprints render');
