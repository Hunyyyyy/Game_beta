# Game_beta (lang-do-da)

Village-building / tribal-warfare game. TypeScript + esbuild, runs in the browser (`dist/index.html`). The simulation is pure TS, with no DOM, and the UI only talks to it through `Sim`.

## Commands

- `npm run build` runs `build.mjs` and refreshes `dist/index.html`. **Run it after finishing any code or UI change.**
- `npm run typecheck` runs `tsc --noEmit`.
- `npm run viewer` builds the dev viewers (blueprint/animation editors).
- `npm run economy` is a balancing report, run only when asked.

## Environment

- Windows. Python is installed: call `python` or `py`, **never `python3`** (it is the Microsoft Store stub and fails with "Python was not found").

## Token rules (important)

- **Never read, edit, add or run tests**: `test/`, `*.test.*`, `tools/check-*`, and the `test:*` / `check:ui` scripts. They are abandoned. Skip any "update the tests" step, including those in the docs.
- **Never read or grep `dist/`**. It holds multi-MB generated bundles. Also skip `node_modules/` and `*.gen.ts`.
- Do not take screenshots or render the game to verify a change. Use `npm run build` (and `tsc --noEmit` if needed).
- Prefer Grep plus partial reads (offset/limit) over reading whole files. Several files exceed 500 lines.

## Where things live

| Path | Contents |
|---|---|
| `src/sim/` | Core game logic: about 50 files, one concern each. **Start from the architecture doc.** |
| `src/data/*.json` | Balance/config tables (pace, food, rest, units, formations, weapons, anims, ...) |
| `src/content/` | Buildings (`buildings/<kind>/building.json` + `L1.json`...), difficulty. `tools/gen-content.mjs` compiles them into `*.gen.ts` on build |
| `src/ui/`, `src/render/`, `src/styles/` | Presentation. Use `Sim` only, never import sim systems directly |
| `src/save/` | Save sessions, storage adapters, settings (outside `sim`) |
| `src/blueprint/`, `src/character/` | Art/character data and tooling |
| `doc/` | Extra docs |

## Simulation architecture (summary)

Full detail: [src/sim/architecture_documentation.md](src/sim/architecture_documentation.md). It is about 38 KB, so **do not read it whole**. Grep for the heading you need, then read that section only. Headings:

- `Layers`, `System Responsibilities` (one row per file: what it does and its key functions), `Rules`, `Adding a New Feature`
- `Game Saves`, `State Management`
- `Combat Animations and Weapon Handling`, `Battle Execution Flow`, `Large-Scale Combat (Performance)`
- `Roles and Buildings`, `Scouting`, `Time Pacing & Clock Loops`, `Food & Rations`, `Energy, Sleep, Shifts, and Torches`
- `Structure Limits and Farmland`, `Unit Types and Fortifications`, `Warfare & Strategy Systems`, `Chunk-Based World Streaming`

Layers: `ui/render/main` -> `sim.ts` (state + loop + facade) -> village systems / creature systems -> pure data & rules.

Hard rules when editing `src/sim`:

1. A village system must **not import another village system**. Cross-system calls go through `sim.method(...)`.
2. Systems use `import type { Sim }` only, never `Sim` as a value.
3. Data layers (`constants`, `buildings`, `jobs`, `combat`, `model`, ...) never depend on `Sim` or session state.
4. No DOM or browser globals inside `src/sim`.
5. `ui`, `render` and `main` interact only through `Sim`.
6. Max **650 lines per file** in `src/sim`. Split anything larger.
7. No file-scope mutable `let` in modules. All game state lives on the `Sim` instance. Use `sim.rnd` / `sim.frnd` / `sim.wrnd` for randomness, never your own RNG.
8. New `Sim` fields must be registered in `SAVED` or `NOT_SAVED` in `src/sim/save.ts`. Changing the save format means bumping `SAVE_VERSION` and adding a `MIGRATIONS[oldVersion]` step.
9. To expose a system function to UI, add a forwarding wrapper in `sim.ts` (`/** -> houses.assignCrew */`). If a new system file is needed, add a row for it in the architecture doc.

## Conventions

- Tools and items pivot at the **handle end**. Tool JSON is handle + head, **side view only**.
- Config and balance numbers belong in `src/data/*.json` or `src/content/`, not hardcoded in systems.
- Adding a building means adding a directory under `src/content/buildings/<kind>/`.
- Roles are assigned at their buildings (`assignRole` / `releaseRole`), not at the campfire. `setJob` is dev-only.
- Keep this file and the architecture doc accurate when structure changes, but keep them short.
