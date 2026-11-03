# Simulation Architecture (`src/sim`)

The simulation is pure TypeScript: it does not touch the DOM, has no UI awareness, and runs on a fixed time step (`TICK`) and seed.
The goal of this architectural split: **modifying one system does not break another**, and in the future, changing the storage layer or engine only requires replacing a single adapter layer.

## Layers

```
        ui / render / main            only calls Sim (sole entry point), imports no systems
              │
            sim.ts   ← core: state + loop + facade gateway
              │
   ┌──────────┼───────────────┐
 village    creature        dev.ts
 system     system       (testing tool)
   │           │
   └─────┬─────┘
       pure data & rules (no Sim awareness)
```

| Layer | File | Purpose |
|---|---|---|
| **Pure Data & Rules** | `constants` `resources` `rng` `calendar` `buildings` `jobs` `tools` `combat` `research` `world` `fog` `path` `model` `formations` `statsys` `progression` | Number tables, data types, pure functions. Does not import `Sim`, holds no game-session state. Primary configuration lives in `src/data/*.json`. |
| **Village Systems** | `construction` `economy` `works` `houses` `inventory` `commands` `labor` `movement` `villagers` `environment` `notices` | Behavior. Each function takes `sim` as its first parameter. |
| **Creature Systems** | `battle` `brainplayer` `brainfoe` `foecivil` `foewar` `hunting` `fightpolicy` `fauna` `tribes` `army` `scouting` | Combat, fauna, tribes, squads and formations, scouting. Same function design taking `sim`. |
| **Game Save** | `codec` (data), `save` | `save.ts` transforms `Sim` to/from pure versioned JSON; `codec.ts` handles `Map`/`Set`/Infinity and run-length string compression. Storage-agnostic. |
| **Core** | `sim.ts` | Holds the complete state, runs `advance`/`tick`, and provides forwarding wrappers for all public actions. |
| **Testing Tools** | `dev.ts` | Dev Menu. Used only during development. |

## System Responsibilities

| File | Responsibility | Example Functions |
|---|---|---|
| `construction` | Place, upgrade, repair (cost = invested materials × share of HP lost, then builders restore it), move, demolish buildings; building bonuses provided to the village (storage capacity, population cap, build speed) | `placeBuilding` `upgradeBuilding` `buildingLock` `buildingLimit` `popCap` |
| `economy` | Central warehouse: cost deduction, bartering, end-of-day meals, daily harvester yields (calculated from worker count and stats) | `pay` `barter` `feedPot` `eatDay` `dailyYield` |
| `idle` | **Idle villagers**: single source of truth for who is idle, who gets house slots, and sleeping location per villager type (profession house, Civil House for idle, or ground near campfire if no beds remain). All buildings query here instead of reimplementing logic | `isFree` `freeFolk` `canTakeOn` `homeKind` |
| `works` | Queues and progress for researchers, crafters, and repairers | `queueResearch` `queueCraft` `tickWorks` |
| `houses` | Worker/sleeper assignments per house: builder crews, residents, bed occupants | `assignCrew` `assignStaff` `releaseStaff` `sleepIn` `sleepers` |
| `inventory` | Tools, weapons, armor: distribution, wear-and-tear, returning to stock, picking up, crafting orders; `restock` (each second) hands stock gear to soldiers/hunters resting in camp or tower | `assignTool` `repairTool` `assignGear` `planTool` `restock` |
| `commands` | Player orders: move, work, attack, hold ground, change job, enlist and discharge soldiers | `orderMove` `orderWork` `setJob` `enlist` `discharge` |
| `labor` | Daily chores: harvesting, farming, carrying, building; villager state machine | `think` `doWork` `doFarm` `planBuild` |
| `movement` | Locomotion: pathfinding, footfalls, standing positions, render poses | `pathTo` `moveUnit` `animate` |
| `villagers` | Villager generation and daily life loop: health, sleeping | `makeVillager` `tickVillager` |
| `defense` | Fences, gates, watchtowers: gate open/close, defense destruction, archers on towers | `toggleGate` `damageWork` `towerBonus` `assignTower` |
| `mounts` | Mounts: Wolf-taming, boar, and elephant stables on demand (requires research and stable level), issued like tools (`Villager.mount`), mounted units move faster and take reduced damage; mounted soldiers act as cavalry; Cavalry Outpost mounts scale with outpost tier | `queueTame` `tickTame` `assignMount` `mountOf` |
| `training` | Role-building training: villager trains for one or more days, gaining 1–5% in a target stat while an opposing stat decreases (penalty reduced by paying extra currency), bounded by baseline birth stats and building tier caps; costs food and currency | `startTraining` `cancelTraining` `trainStep` |
| `siege` | Land combat terrain: obstacles (trees, rocks, bushes, water, structures), obstacle clearing, squad linear movement along arrows, stopping when 6 tiles ahead are blocked, arrow targets and fallback attack behavior when targets are lost | `obstacleAt` `arrowMove` `watchMarch` `breakBlock` `breakBrain` `tickTarget` Soldiers with an attack order and no way to the target pick the cheapest piece of the enemy village on the line (walk + strength / what the soldiers at it do, `siege.breachFor`) and break it, keeping the order; weapon kinds do different damage to each kind of work (`siege.json` `struct`); the villages mend themselves when left alone (`tribelod`, `tribebuild.repairProps`) |
| `quests` | Tutorial quests leading up to Town Center Tier 4 (data from `data/quests.json`), derived dynamically from village state without saving extra state | `quests` |
| `progression` (data layer) | Tech tree progression plan mapped by Town Center and Research Lab levels (`data/progression.json`). Fire tier unlocks for buildings live in `unlockFire` (`fireUnlockLevel` in `buildings.ts`) | `fireBuildingMax` `fireUpgradeNeeds` `labLevelOf` |
| `buildings` (data layer) | Each building lives in a directory `src/content/buildings/<kind>/`: `building.json` (category, size, required fire tier, tier-based `limit`, level stats: cost, time, storage, work slots, HP) and graphics `L1.json`... `tools/gen-content.mjs` compiles them into `defs.gen.ts` and `art.gen.ts` on build: adding a building is adding a directory | `BUILDINGS` `levelDef` `maxHp` `fireUnlockLevel` |
| `warplan` | War plans: squad assignments, tactical cards, defense presets, alarm bell | `newPlan` `startPlan` `playCard` `soundAlarm` |
| `difficulty` (data layer) | Pure tables: player caps per fire level, power share of NPC villages, and percentage stat boosts required to reach village targets (`content/difficulty.json`) | `playerCap` `tribeTarget` `tribeBonuses` |
| `battle` | **The one fighting mechanism, for our people and for the villages' alike**: targets and threats (`threatsOf`, one grid for both sides), the swing, the shot and its flight, `hurt` (armour, kills), the chase and its giving up (`chase.json`), `engage`. What differs between the sides is not here but in a brain: `brainplayer` (stance, orders, post, fleeing and hiding of civilians, helping the fallen; reached by `sim.startFlee` / `sim.endOrder`), `brainfoe` (the people of a village: the dispatcher, post, leash, wandering; `tickFoe`, with `foecivil` for civilians hiding in houses and `foewar` for fence-breaking, tower men and raiders) and `hunting` (our hunters: range, prey, skinning). A difference that is only a number (sight, chase, leash, fear) lives in `data/fightpolicy.json` (read via `fightpolicy.ts`); the riders of a village (`foe.cavalry`: from camp level 3 a share of its army rides a wolf or boar, an elephant in a boss village; read by `mounts.mountOf` like ours) are set there too. A village's soldiers are split like ours: a watch of guards (`lod.guardShare`, posts and towers) is always out, and the army stays indoors in the crowd until a war or an attack on the village (`tribelod.deployArmy` → the posts of the fence and gate, `ai.army`), and goes back after `lod.armyStandDown` quiet seconds (`recallArmy`); a rule both sides obey goes in `battle`; one only a side obeys goes in its brain. | `engage` `hurt` `threatsOf` `tickCommon` `fireProjectile` `brainPlayer` `tickFoe` `huntBrain` |
| `campplan` | Pure plan of a camp of a campfire level (fence, gate, towers, houses ringed round the fire as pieces); shared by the dev menu and the tribes | `planCamp` `ring` `limitAt` `fenceHalf` |
| `tribebuild` | Raises a tribe's camp to a level as data: pieces of `campplan` become `tribe.props` (`kind` house/fence/gate/tower, `b`, `lv`, `hp`) marked on `world.occ`. Gates shut when we are at them in anger (`setGates`) | `growCamp` `setGates` |
| `tribelod` | How much of a tribe is really there. Asleep a tribe is data: level and a head count (`tribe.crowd`). Our people near (`sim.active`), a raid or a war wake it: houses laid, as many people come out as its working houses hold (slots in the building json), the rest stay indoors and come out as the houses fall or for a raid. Nobody near for `npclife.lod.sleepAfter` seconds: back to sleep. Its level follows the player's fire (`followFire`, `tribe.edge`). Towers are manned first (`spawnTowerMen`: the slots of the tower's level, bows) and shoot in `tribes.foeBrain` within the tower's sight; the other guards stand posts (`postsOf`). Arms by `gearFor` (common villages keep pace with the player's research; a boss gives bronze to `boss.bronzeShare` of its soldiers). Boss villages (`tribe.boss`, difficulty.json `boss`): picked at spawn, one step above the player, with towers, sturdier works, more people and a power of `boss.power` of the player's best army; their fall sets `sim.bronze` and announces the age of bronze | `wake` `sleep` `tickLod` `headcount` `releaseCrowd` `followFire` `tribePower` |
| `tribework` | Daily routines of NPC village citizens (logging, mining, gathering, patrolling, hunting, scouting), simulated only on active chunks near player villagers (`data/npclife.json`) | `lifeBrain` `refreshActive` `endLife` |
| `power` | Village Power = Economy + Military, calculated from villager stats (including research %), excluding weapons; formula weights in `content/difficulty.json` | `powerOf` `militaryValue` `economyValue` |
| `roles` | Roles attached to buildings: assignment, unassignment, capacity per building tier | `assignRole` `releaseRole` `roleCapacity` `trimRoles` |
| `notices` | Notifications regarding upcoming or ongoing events (end-of-day food shortage, winter prep, incoming wolf/tribe attacks and required troop counts), computed dynamically from state upon query, unsaved | `noticesOf` |
| `forecast` | War Council report on a plan: win rate, warnings, casualties, details varying by map intelligence tier | `forecastPlan` |
| `environment` | Time of day, seasons, weather, fog of war | `tickCalendar` `refreshFog` |
| `rest` | Energy, sleep, shifts, torches, accumulated fatigue | `tickEnergy` `shouldSleep` `callUp` `ensureTorch` |

## Rules

The tests that once enforced these are abandoned. Today `npm run typecheck` and `npm run build` are the safety net: the type rules (2) are checked by `tsc`; the rest are conventions to keep by hand. Refactoring and splitting old code is welcome as long as the rules hold.

1. A village system **must not import another village system**. Cross-system actions must call through `sim.methodName(...)`. This eliminates circular dependencies and clarifies the blast radius of changes.
2. Systems may only `import type { Sim }`, never import `Sim` as a concrete value.
3. Data layers must remain decoupled from `Sim`. Any function requiring session state belongs outside this layer.
4. Code inside `src/sim` must never reference DOM or browser globals (`document`, `window`, `localStorage`, etc.).
5. `ui`, `render`, and `main` must interact strictly through `Sim`. No direct system imports allowed.
6. No hard file length limit in `src/sim`. Keep files from getting overly long or messy; split by concern when they do.

## Adding a New Feature

1. New Data/Stats → `src/data/*.json` or tables within data layers.
2. New Behavior → add functions in the appropriate system file (refer to table above). If no matching system exists, create a new file and add a row for it in this document.
3. Exposing to UI/Tests → add a forwarding wrapper method in `sim.ts` (`/** → houses.assignCrew */`).
4. New Session State → add fields to `Sim` (or types in `model.ts`) and ensure inclusion in game saves (see below).
5. Check with `npm run typecheck` and `npm run build`.

## Game Saves

```
 sim.toSave() / Sim.fromSave()     (src/sim/save.ts: JSON schema, versioned, migration handlers for legacy saves)
        │
   Session (src/save/session.ts)   auto-saves at daybreak, manual save on request, load active session
        │
   SaveStore (src/save/store.ts)   list / load / save / remove: unified interface to storage backends
        │
   adapter: IndexedDbStore (Browser) · MemoryStore (Test) · Future: File system, Server, Unity bridge
```

- `sim` only handles `toSave()` and `fromSave()`; it remains unaware of active adapters. Files under `src/sim` must not import `src/save`.
- **Game Settings** (speed, landscape orientation warnings) reside in `src/save/settings.ts`, kept separate from game save files.
- Terrain is saved directly (compressed via run-length encoding) rather than as diffs against map generation algorithms, guaranteeing engine updates won't corrupt legacy map terrain.
- **Format Schema Updates:** increment `SAVE_VERSION` and add a migration step in `MIGRATIONS[oldVersion]` inside `save.ts`. Legacy saves automatically step up upon load.
- **Adding new properties to `Sim`:** must register the key in either `SAVED` or `NOT_SAVED` inside `save.ts`. Forgetting it loses the field on save and load.
- Goal: saving → loading → stepping forward must give the same result as an uninterrupted run, so keep all state in `Sim` and all randomness in `sim.rnd` / `sim.frnd` / `sim.wrnd`.
- Save schemas serve as the contract for future Unity/C# ports: matching JSON structure and identical `src/data/*.json` sets.

## State Management

All state changes during gameplay reside inside the `Sim` instance. No module may maintain file-scope mutable `let` variables (a convention): hidden module state bypasses save serialization and leaks state between separate game runs in the same execution process (previously fixed issue with `tribeClock`).
The random number generator relies on `Rng` (`rng.ts`), supporting state inspection and seed resets; use `sim.rnd`, `sim.frnd`, and `sim.wrnd`. Do not instantiate unmanaged RNG instances for deterministic mechanics.

## Combat Animations and Weapon Handling

Character animations for armed units (warriors, hunters) are decoupled from work animations and bound **to weapon categories (styles)** rather than individual items. All weapons sharing a style share movement patterns: clubs, maces, axes, and swords share *swing*; spears and lances share *thrust*; bows, crossbows, and firearms share *shoot*; javelins share *throw*.

```
 weapons.json  "weapons": { "club": { "style": "swing", ... } }
                    │
 weapons.json  "styles":  { "swing": { idle, walk, guard, charge, attack } }   anim names across 5 states
                    │
 anims.json    "swing_idle", "swing_walk", "swing_guard", "swing_charge", "swing_attack"   keyframes (edited via viewer)
                    │
 movement.animate()  →  poseOf(weapon, state)
```

| State | Trigger Condition |
|---|---|
| `idle` | stationary, wielding weapon |
| `walk` | standard walking motion |
| `guard` | engaged in combat or standing watch, static pose |
| `charge` | engaged in combat, closing distance |
| `attack` | attack stroke execution; requires `hit` property (damage frame index) to trigger hit registration |

The `hit` (taking damage), `run` (fleeing), and `down` (downed/incapacitated) animations are shared universally across units. Armor renders as an overlay above character bodies across all animation sequences. Handheld weapon visuals are governed by `hold` metadata, independent of the `tool.kind` field inside animation frames (which exists solely for viewer previewing).

**Adding a weapon sharing an existing style** (e.g., a sword): add an entry to `weapons` with `"style": "swing"` (stats, `cost` if craftable), draw holding graphics in `src/data/handtools/` and menu icons in `src/data/blueprints/*/tools/`. No new animation frames required.

**Customizing a single animation state on a weapon:** add `"anims": { "attack": "custom_anim_name" }` to that weapon's definition (e.g., stone axe overriding attack with `slash`).

**Adding a new weapon style** (e.g., firearms or catapults): add entry to `styles` containing 5 target animation names, draw the 5 animations in `anims.json`, and assign `"style"` to the weapon. For ranged weaponry, configure `"projectile"`. The test suite `npm run test:sim` verifies: all styles contain 5 valid animations, all weapons reference existing animation keys, and all attack animations include a defined `hit` frame.

The `throw` style (javelins) is currently aliased to `thrust` as a baseline placeholder for future implementation.

**Modifying combat mechanics** (attack cadence, hit timing, range, projectile physics): hit frame timing relies on `hit` and `fps` of the `attack` animation; inter-attack delays are driven by weapon `cycle`; damage resolution formulas live in `src/sim/battle.ts`.

## Battle Execution Flow (Attack Planning)

1. **Planning Phase** on enemy target map: squad selection, tactical formation selection, path arrows, withdrawal route (`warplan`).
2. **Deploying Battle** (button on tactical map): War Council provides evaluation report (`sim.forecastPlan`), player confirms (`sim.startPlan`): planning UI closes, game transitions into **War Mode** (`body.war`, `src/ui/warbar.ts`): individual villager and building selection controls hide, displaying combat status bars alongside Engage / Retreat controls. Evaluation reports calculate odds from current scouting data (without reading real-time enemy state): win probability uses Lanchester power formulas (Troop Count × √(Damage × HP)), adjusted for type counters and fortified structures identified on map data. Higher-level map intelligence yields narrower variance (`spread`) and richer details: Tier 1 provides rough population estimates, Tier 2 adds structural layouts, Tier 3 exposes unit breakdowns, leaders, and squad contribution matrices.
3. `plan.stage` phases: `assemble` (units march to assigned formation slots) → `ready` (holding position; non-combat tasks paused) → player selects `sim.engagePlan` (→ `fight`, squads follow path arrows and engage targets at arrowheads) or `sim.withdrawPlan`. Withdrawing **prior to engagement** (`assemble`/`ready`) cancels the assault: all troops retreat directly home (`recall`), ignoring tactical retreat routes on the map, resetting the plan to draft mode for editing or re-deployment. Withdrawing **during active combat** (`fight`) initiates tactical retreat (`retreat`): squads fallback along drawn retreat routes or rendezvous points, ending the plan.
3b. **War Lock (`sim.warLock`).** From deployment (`status: 'running'`) until completion or cancellation back to draft mode, troop roles and assignments are locked: `assignRole`, `releaseRole`, `setJob`, scout recruiting/discharge, workshop assignments, `joinSquad`, `leaveSquad`, `disbandSquad`, `setCommander`, and role building demolition are rejected (returning error strings or early-exiting `void` operations). UI elements gray out controlled actions. This prevents roster manipulation mid-battle, except through casualty events.
3c. **Deployment Validation.** `startPlan` validates unit readiness dynamically at execution time (bypassing stale static reports): squads missing slot allocations, empty squads, or units injured/sleeping heavily (immobile) block deployment (`✗` status in `reviewPlan`). During `assemble`, idle unpositioned troops receive periodic relocation commands (`regather`); after 150 seconds, unformed armies transition to `ready` with an unpositioned count report.
4. Reaching the end of a path arrow without active hostiles within 12 tiles makes the squad hold its formation and defend locally. The stone-age quick war (`warquick.ts`: ordered squads, no arrow, no target) uses the same loop. Once a squad is `engaged` and its soldiers have nothing to do, `tickPlans` calls `siege.rampage` each second (stance `fight` only): they pick tower > soldier > house in sight, else the fire, until the war is won (`endCheck`). Squads with no arrow and no orders (`isHolding`) and stances `hold`/`evade`/`shoot` do not sweep.
5. Tactical cards and signaling systems are not yet active in live combat logic; UI selectors remain disabled.

**Large-Scale Combat (Performance).** All combatants are individually simulated without unit abstraction. Three primary mechanisms maintain performance across high-unit engagements: (a) 8×8 grid spatial partitioning to scope target detection to local neighborhood tiles (`threatCache`, rebuilt per tick); (b) active engagement lockouts (units currently attacking skip target search passes per tick); (c) pathfinding budget caps per tick (`Sim.pathLeft`, `PATH_BUDGET`): mass army movement commands distribute pathfinding calculations across sequential ticks rather than bursting synchronously. All three optimizations rely on transient runtime state and are excluded from saves.

## Roles and Buildings

The central campfire acts purely as a population and activity monitor; **job assignment does not occur at the campfire**. Every role is bound to a dedicated building (`ROLES` in `jobs.ts`), managed via `sim.assignRole` / `sim.releaseRole` (UI panel located in `src/ui/rolepane.ts`, building tab):

| Role (Stone Age → Ancient) | Building (Stone Age → Ancient) |
|---|---|
| Fighter → Infantry | Fighter Camp → Infantry Camp (`infantry`) |
| Mount Rider → Cavalry | Beast Enclosure → Cavalry Camp (`cavalry`) |
| Thrower → Archer | Thrower Lodge → Archer Range (`archery`) |
| Scout | Scout Tent (`scouttent`) |
| Gatherer → Farmer | Farmhouse (`farmhouse`) |
| Hunter | Hunter Lodge (`huntlodge`) |
| Woodcutter → Lumberjack | Lumberyard (`lumberyard`) |
| Stonecutter → Miner | Quarry (`quarry`) |

- Each building type is restricted to **a single instance limit**; the `slots` capacity per building tier dictates maximum role assignment caps. Demolishing a building unassigns surplus role occupants (`trimRoles`).
- Building names evolve across tech eras (`names` property on buildings, `ROLES[..].names`), while underlying internal identifiers remain constant. New eras add display names without modifying system `id` values.
- Troop unit type is governed by `Villager.arm`, determined by camp classification; thrower ranges issue ranged gear exclusively, while melee camps issue melee gear. Mounted fighters (`cavalry`) classify as cavalry in `armOf` (counter calculations query `armOf` rather than direct weapon types). Soldiers sleep within their assigned military quarters.
- Starting settlements spawn pre-built Farmhouse, Lumberyard, and Quarry (`placeStarters`) to ensure initial villagers have work assignments immediately. Remaining buildings unlock through research or baseline availability.
- `setJob` remains an internal developer command (tests, Dev Menu); production UI operates exclusively through `assignRole`.

## Scouting

Scouting mechanics are implemented in `src/sim/scouting.ts`, with UI components in `src/ui/scoutpane.ts` (accessible via Scout Tents and War Council HQs).

1. **Tribe Discovery** (`Sighting`, `sim.sightings`): any villager or soldier passing within 14 tiles of an undiscovered tribe camp logs pending intelligence; returning safely to the campfire (or entering shelter) commits the entry to global sightings, formatted as "N tiles away towards direction X". Perishing in transit destroys the intelligence payload, allowing re-discovery by subsequent units.
2. **Map Intelligence Tiers** unlock via research tree nodes: `scout` (Tier 1), `scout2` (Tier 2), `scout3` (Tier 3). Missions default to rendering the highest researched intelligence tier available.
3. **Scouts operate as a dedicated role** (`job: 'scout'`, possessing no gathering sub-skills): recruited and dismissed at the **Scout Tent** (`scouttent`) via `assignRole(ids, 'scout')` / `releaseRole`. Tent level `slots` dictate total scout capacity. Scouts do not perform civilian labor, are immune to standard job conversion tools, and cannot be dismissed while actively deployed on a mission. Reconnaissance missions require dedicated scouts.
4. **Detail Precision Rate** (`drawChance`): combined skill total (`scoutSkill`: Agility + Stamina + Intellect, divided by 18) of scouts **successfully returning home**, divided by requirement thresholds (`scoutsNeeded`: tier level + 1, plus 1 per 8 enemy defenders), capped at 95%. Solo deployments (under 2 scouts) return 0% detail precision. Failed rolls produce incomplete map intel (`gaps`), omitting hidden forces and structures. Skill gains and research bonuses scale `scoutSkill` values directly.
5. **Mission Duration** (`surveyTime`): survey duration scales by intelligence tier, divided by `1 + 0.35 × (scout_count − 1)`. Travel to and from the objective models physical walking speed and cannot be artificially accelerated.
6. Planning UI previews outcome stats using `sim.planScout(ids, tribe)` (success odds, duration, restriction warnings) before dispatching via `sim.startScout(ids, tribe)`.

## Time Pacing & Clock Loops

One full in-game day equals 20 minutes of real time (`DAY_LENGTH = 1200` seconds): 12 minutes daytime, 8 minutes nighttime. Timing parameters fall into two operational categories:

| Operational Task | Unit Measurement | Configuration File |
|---|---|---|
| **Resource Gathering** (logging, mining, foraging) | Real seconds at 1× game speed per resource unit (baseline efficiency factor 1.0) | `src/data/pace.json` (`gather`, with `bare` modifier for unequipped vs equipped labor) |
| **Construction, Crafting, Repairs, Research, Equipment Wear, Experience** | "Work-seconds": 240 work-seconds = 1 work-day, irrespective of day-length settings | `buildings.ts` (build time per tier), `tools.ts` (crafting duration), `weapons.json`, `research.json` |

Work-seconds elapse at a fixed ratio `PACE.work` (`WORK_DAY / DAY_LENGTH`), ensuring a structure costing half a work-day consumes exactly half a game day regardless of day-length scaling configurations. UI elements format values as work-days (`workDays`).

**Seasons and Weather** penalize outdoor tasks (logging, quarrying, foraging, building; cataloged under `outdoor` in `pace.json`): environmental modifiers (`weather.json`: clear 1.0, fog 0.95, light rain 0.85, heavy rain 0.7, storm 0.6, blizzard 0.45, snow 0.6) multiply seasonal modifiers (`seasons.json`: winter 0.8, summer 1.05). Foraging applies an additional seasonal `gather` scalar. Indoor tasks (crafting, research, equipment repairs) are unaffected. Weather `speed` scalars affect unit travel rates exclusively.

Baseline yields (unequipped villager, clear weather, 12-minute day): ~32 wood, ~28 stone, ~80+ food; initial 15 wood requires roughly 3 to 4 minutes. Test suite `how long gathering takes` asserts these target thresholds.

**Profession changes are locked to relevant structures.** Selecting villagers and clicking trees, rocks, berry bushes, or wild fauna directs units possessing matching professions to perform the action. Unassigned (idle) villagers automatically acquire matching roles if the corresponding structure exists with available capacity (`assignRole`, error logs captured in `err`). Units already holding alternate roles ignore direct harvest orders without switching jobs (`orderWork`, `autoHunter`, `orderAttack`, `orderLoot`). Resource nodes deplete upon exhaustion and respawn at adjacent vacant grass tiles (`World.depleted`). Single exception: prior to building a Builder Workshop, right-clicking its foundation assigns any villager to construct it. Primary roles (warriors, scouts, gatherers, hunters, woodcutters, miners) are assigned and revoked exclusively at their respective functional buildings. Housing and encampments, like all structures, require research discovery prior to placement.

**Nighttime Phase:** non-military villagers sleep, queuing active orders until morning. Dedicated combat troops or villagers reassigned to combat duty during night cycles remain active on watch (`keepWatch` in `commands.ts`).

## Food & Rations

Villagers do not track individual hunger bars. Settlements consume shared communal meals at the end of each game day (`economy.eatDay`, executed during day transitions in `tickCalendar`, prior to welcoming new arrivals). Data parameters live in `src/data/food.json`.

- **Ration Requirements:** civilian villagers require 2 food units; combat units (`job === 'fight'`) require 3 food units at Tier 1 campfires, scaling by +1 per campfire tier (`rationAt`). Total required daily meal = `economy.foodNeed`.
- **Campfire Food Reserves (`Sim.foodPot`):** harvested food doles into the active campfire pot first until matching the upcoming daily ration requirement (`economy.feedPot`, evaluated per tick); overflow remains in standard warehouse storage. UI resource trackers display Combined Storage (Warehouse + Campfire Pot).
- **Food Shortages:** end-of-day meal resolution consumes food from the campfire pot first, falling back to warehouse storage. Unmet demand calculates a shortage percentage scalar: `Sim.foodPenalty = maxPenalty (20%) × deficit_ratio`, remaining active throughout the following day until recalculated at next nightfall (resets to 0 upon meeting food demands).
- **Penalty Effects on Player Villagers:** `statValue` scales by `1 − foodPenalty` across all attributes except `hp` (movement speed, physical strength, armor defenses, work rates, intellect, stamina). Maximum health remains constant, but passive health regeneration scales down by `1 − foodPenalty` (`tickVillager`). Attack speed: `swingCycle` delays increase by `1 − foodPenalty` (preserving underlying agility metrics to prevent double-dipping penalties).
- NPC tribe villagers operate outside this ration penalty system.

## Energy, Sleep, Shifts, and Torches

Parameters live in `src/data/rest.json`; implementation logic resides in `src/sim/rest.ts`.

- **Energy (`energy`, 0 to 100)** drains during labor and restores during sleep cycles. Standard heavy labor consumes ~40–50 energy points daily; night shifts consume ~30. Labor weights vary by job (`jobWeight`: logging and mining incur highest strain; research incurs lowest). Robust villagers (high Health, Stamina) and high health pools reduce depletion rates while boosting recovery speeds.
- **Below 20% Energy:** villagers enter forced sleep and **cannot be commanded awake** until reaching 50% energy (or 60% if collapsing from exhaustion below 10%). Sleeping units above 20% wake up immediately upon receiving player commands.
- **Combat Troops** fight regardless of low energy; upon exiting combat with energy under 10%, troops enter extended sleep until reaching 60%.
- **Nighttime Sleep** restores ~60 energy points per night cycle; daytime sleep restores half rate, scaled by sleeping surface tier (`sleepAt` in `rest.json`). Depleted energy or shift ends trigger automated pathfinding to designated sleeping quarters: civilians target **Civil Houses** (`house`, baseline recovery ×1), soldiers target **Barracks** (`barracks`, baseline recovery ×1); upgraded housing tiers multiply efficiency alongside `craftSpeed`. Occupying beds places units inside structures (`inside`, `phase: sleep`), removing their sprites from the map and listing them in building rosters without active sleep sprites. Missing housing or exhausted bed capacity (`slots`) forces villagers to sleep outdoors near campfires at reduced efficiency (×0.6). Nearby hostiles wake shelter occupants, forcing them outside to defend.
- **Work Shifts** (`shift`: Day, Night, Full-Day) are managed per villager, defaulting to Day. Assigning tasks outside active shifts wakes villagers if energy levels permit (night tasks require torches).
- **Night Work Torches** (equipped off-hand, burning out after 10 minutes of continuous use; remaining torches return to storage at dawn) maintain worker output at **70%** baseline efficiency; night watch sentries operate without torch requirements. Torches are crafted at the Workshop (recipes available by default), issued manually or auto-equipped for night shifts from stock. Torch bearers gain +6 tile vision radius and emit ambient light.
- **Anti-Exploitation Mechanics:** continuous night labor accumulates `strain` (fatigue). Strain lowers maximum energy ceilings and degrades recovery rates, clearing gradually during standard night sleep; unmitigated night shifts induce chronic exhaustion.

## Structure Limits and Farmland

Core operational structures (builder workshops, warehouses, crafting halls, research labs, repair shops, tool sheds, armories) are restricted to **one single instance**. Civil Houses, Barracks, and Farms utilize `perFire` limits in `buildings.ts`: max structural counts scale based on Town Center Tiers 1 through 4, cumulative across all built campfires (`buildingLimit`). Level caps per structure remain bounded by `levelCapByFire`. Bed allocations pool across identical shelter types (`bedsIn`, with `freeBed` prioritizing nearest valid structures).

Farms: players assign agricultural workers manually (`houses.assignField`, mirroring operational building assignments); workers operate inside farm plots, depositing yields directly into central storage (`labor.tickFarms`), while `Villager.post` tracks assigned plots. Unassigned Gatherers harvest wild berry bushes exclusively. Single farm plots support one worker; farm tiers scale production throughput (`craftSpeed`); seasonal scalars apply via `farm` in `seasons.json`; production timing per unit defined in `pace.json` (`gather.farm`). Balancing parameters can be measured via `npm run economy` (simulates daily output per villager relative to food demands across fire tiers).

## Unit Types and Fortifications (M6.1, M6.2)

`formations.ts` (data layer) + `data/units.json`: defines three unit classifications: Infantry, Archers, Cavalry. Ranged weapon gear designates Archery units, while melee gear designates Infantry; mount mechanics are pre-configured in combat counter tables. `battle.armMultiplier` applies rock-paper-scissors scalars per strike: Infantry vs Archery ×1.5, Archery vs Cavalry ×1.5, Cavalry vs Infantry ×1.5 (inverse matchups deal ×0.67). Archers engaged at close range (within 2 tiles) suffer 50% damage penalties; archers stationed adjacent to watchtowers gain +25% damage bonuses and +2 bonus range.

`defense.ts` (village system): structures `fence`, `gate`, `tower` defined in `buildings.ts` carry level-scaled `hp`, placed segmentally (`repeat`), subject to max structural caps per fire tier (`perFire`). Fences and closed gates occupy map grid cells (`world.occ`), blocking pathfinding; opened gates clear cell occupancy (`setOcc` updates dynamically). Hostile raiding parties failing to compute valid target paths pivot to attacking adjacent wall segments (`tribes.siegeBrain`, `noteStuck`). Archers occupy watchtowers via `Villager.post`, anchoring position adjacent to towers.

Dev Menu combat testing utilities: `dev.combatReady` (unlocks all tech), `raiseArmy`, `defenseLine`, `garrisonTowers`, `enemyWave`.

## Warfare & Strategy Systems (M6.3 through M6.8)

- `army.ts`: Squad structures (`Squad`), battle formations (Line, Circle, Wedge, Horns, Spread, Ambush; defined in `data/formations.json`), drill proficiency trained at Practice Grounds, combat scalars `attackFactor` and `takenFactor` (applied per attack hit in `battle.ts`, capped at ×3.5 max scalar), squad clustering (`clusters`, renders squad banners and simplifies visuals in large battles), combat logging (`tickBattle`, `noteBattle`).
- `scouting.ts`: scout deployment, individual casualty risk mechanics, 3-tier map intelligence degradation (loses 10% accuracy per day), map gap generation during under-staffed missions.
  `tribeIntel` converts raw data into renderable maps: enemy encampment core plus surrounding 24-tile radius, revealing tier-specific intelligence (Tier 1: location, estimated numbers, entry vectors; Tier 2: terrain, structures, unit silhouettes; Tier 3: unit combat types, storage stocks, leader positions). Unit positions freeze based on scout arrival timestamps (`ScoutMap.seen`, captured at observation phase start, Tier 2+); subsequent enemy movements do not update stale maps. Low-accuracy maps omit units dynamically; functions operate read-only without consuming RNG state. Legacy map schemas (missing `seen`) render static tribe camps. Save file Schema v8: missions include `deploy` (tile matrices), `path`, `retreat`, `leg`. Tactical map UI rendered via `ui/planmap.ts` (Attack Plan screen catalogs discovered maps; selecting a map opens full-screen view: supports pan/zoom, side panel for squad assembly and tactical orders, tile clicks assign objectives; maps overlay friendly squads and mission goals via `missionTarget`). Tribe structures render from `Tribe.props`; currently tracking campfires and warehouses (fences, towers, and gates populate dynamically on Tier 2+ maps when present).
- `warplan.ts`: attack plans (squad missions: formation tile layouts plotted on map `deploy` (3 to 15 grid tiles, 1 unit per tile; `drawFormation` generates shape layouts when dragging from placement points; `deploySquad` writes target tiles: planning operates independently of active troop assignment, units join squads post-planning), waypoint arrows `path`, withdrawal paths `retreat`, engagement rules, launch schedules, signal triggers, withdrawal criteria; `withdrawAt` set to 0 disables auto-retreat; coordinates map to real world-space grid cells. `routeTime` computes travel times per segment based on slowest unit speeds, formation penalties, and weather conditions. Pathless missions default to primary objectives (`objective`)), tactical command cards (capped by War Council tier), defense presets, and warning bells.
- `siege.ts`: field battlefield systems (`data/siege.json`). `obstacleAt` resolves grid tile blockage (trees, rocks, bushes: destructible; water, village buildings: impassable structural terrain; enemy structures: combat targets, damaged via strikes). Units clear obstacles via `Villager.breaks` (`startBreaking`, `breakBrain` called by `brainPlayer`): natural foliage and rocks absorb cumulative damage from adjacent workers rapidly without dropping resources; enemy structures (`Tribe.props[].hp`) take weapon-typed structural damage (`damageProp`). During battle deployment, units assigned to formation tiles containing trees or rocks automatically clear them before occupying positions; path arrow obstacles are cleared by support crews: plans differentiate pathing squads from support squads (`isLogistics`, requiring at least one assigned unit). Deployment step `listClears` scans a 2-tile corridor along path arrows, logging foliage and rocks into `Plan.clears`; logistics crews clear obstacles sequentially (`crewClears`) before returning to position; armies pause deployment until corridors clear (missing logistics units trigger `✗` validation errors; mid-mission logistics wiped out causes army path blockages, requiring manual clearance commands). Water and friendly structures are indestructible (requiring path arrow adjustments). Logistics squads do not participate in direct combat. In combat, squads march along straight path arrows (`arrowMove`, `FightState.strict`: bypasses auto-pathing): `watchMarch` scans 6 tiles ahead twice per second; blocked paths halt squad movement (`Mission.state = 'blocked'`, `Mission.block`), prompting manual clearance triggers (`breakBlock`, dispatching n units). Path arrows point at target objectives (`Mission.target`, set via `setMissionTarget`, fixing arrowheads): upon arrival, units acquire targets locally (`targetNow`); destroyed targets cause units to engage local hostiles; targets drifting beyond `driftMax` from planned positions cause squads to hold position at arrowhead termini in formation, defending locally (`tickTarget`).
- Win/Loss Resolution: Victory triggers when every enemy soldier is dead, the enemy campfire is out and every enemy tower is down; fences, gates, traps and houses may stand (`Plan.result = 'won'`; `endCheck`; soldiers with nothing to do pick targets in their sight: tower, then soldier, then house, else go for the fire, then any tower, then the last soldiers (`siege.rampage`); walls are broken only when they shut a soldier's way: `breakBrain` → `breachFor`, forcing tribe surrender); Defeat occurs when player forces are wiped out or execute a full retreat (`'lost'`). Attacked tribes will not surrender mid-combat (`checkSurrender` bypassed). Squad members ignore fatigue and sleep requirements during active battles (`rest.shouldSleep`). All structures carry hit points (`buildings.maxHp`) and sustain combat damage.
- `simwar.ts`: extension facade layer for `Sim` handling combat operations, merged into `Sim` to maintain `sim.ts` under the 650-line limit.
- `warmode.ts`: **War mode.** While an attack plan is `running` (`warPlan`), `Sim.tick` keeps only the clock, weather, `feedPot`/`trackFood` and calls `tickWar` (simwar.ts), which works the army (`ranks`: squads of the plan + scouts out), projectiles, battle/plan ticks, the attacked tribe (`warTribe`: its people and village go on as normal) and fog. Everyone else on our side goes home and stands still (`standDown` → `goHome`); animals, other tribes and events, works, farms, towers, traps, training and research are not ticked. `eatDay` does nothing at war; when it ends `economy.eatWar(days)` takes the meals of the war's days from the pot/store, and any shortage becomes the usual `foodPenalty`. Save/load are refused during a war (`Session.save/resume`, menu buttons disabled). `Sim.warSince` is NOT_SAVED.
- **Animals and war.** While a war is on the animals leave the field: those out of the camera's sight (`sim.view`) are put by in `sim.hiddenAnimals` at once, those in it run from the middle of the screen and are put by when out of sight (`fauna.tickWarAnimals`); they come back where they were when the war ends (`restoreWarAnimals`, from `Sim.tick`). A war cannot be started while the village is under attack (`sim.attackReason()` in `startPlan` and `quickAttack`).
- **Army size and conquest.** The soldiers are limited by the places of their camps (`roles.roleCapacity`: infantry, archery, cavalry), not by the people. Each village we adopt or wipe out (`Sim.conquered`, saved) adds `difficulty.json capture.campSlots` places to every camp of soldiers, besides the people it adds to the cap (`popBonus`). The boss is tuned against that (`boss.power`, `popMult`, `bronzeShare` in difficulty.json): the full army of the top camp level without conquests usually loses, about two villages taken are needed to win.
- **Wildlife restock.** Once a day `fauna.restock` (via `sim.restockAnimals`, from `tickCalendar`) gives a species that fell short of its usual number (`countOf`) a new herd by chance (`animals.json` `behaviour.restockChance`), out of our sight and in its zones; it needs no living animal of the species.
- `warmarch.ts` + `data/war.json`: **the march.** `marchOf(squads, soldiers)` gives the slow of an army (`slowMin` 50% for one soldier, up to `slowMax` 85%; research cuts via `war.json` `research` but never below `slowFloor`) and the food/energy factors (`base + slow over slowMin`). Applied to `Sim.warIds` (the plan's soldiers + supply) in `movement.moveUnit`, `rest.tickEnergy` and the army's meals. `marchLines` is the part of the war council's report about it (days each way, ration per soldier).
- `warsupply.ts`: **supply soldiers** (job/role `supply`, quartered in the `supplycamp`, they work only in a war). `Plan.supply` / `carryDays` choose how many go and how many days of food they carry (`setSupply`, shown in the war report); `loadPacks` at deploy takes the food from the pot/store into `Villager.pack`; each second of a war `eatPacks` feeds the army from the packs (the share unmet becomes `warHunger` → `foodPenalty`); `follow` keeps them behind the army; `settle` returns what is left to the store when the war ends. Civilians who stayed home are paid for from the store by `economy.eatWar`.
- `wartent.ts`: **field tents** (`Plan.tents`, not buildings; `data/war.json` `tent`). Each squad needs one to sleep: the supply soldiers pitch it at night when the squad stands still (cost `woodBase`/`hideBase` × (1 + `perLevel` × (campfire level − 1)), taken from their packs), it is struck in the morning or when the squad moves (`refund` back if the army is near, else lost). `shouldSleep` for the army = `sleepsInTent`; `goHome` just lies the soldier down in a war. Without sleep the army's energy runs out and `Sim.tiredPenalty` takes up to `tired.maxPenalty` off its stats (via `statValue`). The renderer draws the tents of a running plan.
- `warharass.ts` (`data/war.json` `harass`): while our army is out on the road (`minFromVillage` from our fire, within `range` of their camp) the attacked tribe sends a band (`base` + its warriors / `perWarriors`, up to `max`) every `every` seconds, the first after `first`. They are extra men (not the village's guards, so its defence is not thinned), `FoeAI.harass` = time sent, driven by `harassBrain` (called from `foeBrain`) toward `Sim.warFocus` (middle of the army); they vanish after `life` seconds or when the war ends (`clearHarass`).
- `warlog.ts`: **the log of the wars** (`Sim.warLog`, saved; shown in the Lều họp chiến tab *Nhật ký trận*, `ui/warlogpane.ts`). `begin` (at deploy) counts who goes by arm and the packs' goods into `Plan.stats`; `noteDeath` (from `Sim.kill`) and `noteLoot` (from `claimVillage`) count what falls and what is taken; `finish` (when the war ends) makes the `WarRecord`: map, days, sent/dead by arm, supply soldiers, goods spent (loaded − returned, plus the meals of the village) and loot.
- Watchtowers: archers garrison inside structures (mirroring workshop behavior) and attack outwards; spike traps act as individually placed defense structures.
- Gear Wear & Durability: weapons and armor degrade based on strike counts (`wearGear`): reaching 0 durability destroys 50% of gear, while the remaining 50% breaks, prompting units to transport broken items to Repair Shops automatically. Villagers reaching 0 HP perish permanently (downed/incapacitated mechanics removed).
- Unimplemented Features: abstract squad-level chunk simulation, mounts, fire attack mechanics, wildlife baiting, supply line cutting, prisoners of war, espionage systems, NPC automated fence building and trap placement.

**Chunk-Based World Streaming.** World maps span 960×960 tiles but instantiate strictly in 32×32 grid chunks (`World.ensure`): initialization generates a 200×200 tile zone centered on the settlement; subsequently, `Sim.streamWorld` dynamically generates chunks within a 40-tile radius of active roaming villagers. Chunks generate deterministically once regardless of evaluation sequence (terrain generated via coordinate noise, fauna seeded via chunk-specific RNG: `fauna.populateChunk`). Tiles residing in ungenerated chunks register as impassable (`isBlocked`), preventing movement and construction; `World.ready` tracks generated chunks for save serialization. Terrain biomes: Plains, Light Forest, Dense Forest, Mountains (`Tile.Mountain`, impassable terrain rendered via `blueprints/nature/terrain/mountain.json`), Lakes (lowland elevation zones); biome ratios are defined as constants at the head of `world.ts`, balanced low to prevent trapping villagers.

- War sleep/orders: supply soldiers sleep hidden inside a built field tent (`Villager.inTent`, `wartent.shelter`); a squad order in a war sets `nightOwl` so `shouldSleep` lets go of the soldier; a fall-back (`squadMove` mode `move`) sets `fight.obey`, so nothing met on the way stops the walk. A squad with orders (`Mission.ordered`) but no arrow goes for its objective instead of holding. Tower men sleep in the tower and wake at anything within their sight (guards too, see `brainPlayer`).
- Kế hoạch chiến đấu bậc 1 (research tab; `plan` in `data/researchtree.json`, techs `plan_*` in `research.json`): `plan_report` opens the Chi tiết tab of the deploy report, `plan_supply` the supply sums (`warsupply.supplyAdvice`), `plan_weather` the weather row (today + tomorrow), `plan_rest` the field rest (`warplan.setRest`, `Mission.resting`; `wartent.restsNow` makes tents go up and squads sleep by day too). Gate with `sim.planOpen(feature)`.
- War-only research: chains `march` (Hành quân bậc 1: stats of the three arms, added while the army marches or rests) and `tactic` (Kế hoạch chiến đấu bậc 1: added while fighting) in `researchtree.json`, applied in `statsys.statValue` through `sim.warMode(v)`; chain `marchlog` adds `mspeed` (`warmarch.marchOf`) and `mload` (`warmarch.supplyLoad`). Without supply soldiers a squad cannot rest.

