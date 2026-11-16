# PLAN: medieval to rank 10, levelled buildings, characters, story tree

Source prompt: `doc/PROMPT_claude_code_fable.md`. Story: `doc/story_tree.md` (the prompt says `docs/`, the file is in `doc/`). Status: **Phase 5 done; Phase 6 (acceptance) starts on "tiếp"**.

## Survey facts (what the code has today)

| Area | Today | Gap |
|---|---|---|
| Nhà chung | 3 stone levels + 1 medieval (`campfire/building.json`), `progression.json` levels 1..4, `popByFire` 4 entries, boss gate at level 4 (`construction.ts:157`) | levels 5..10, sizes, art A2..A7 |
| Building levels | most: stone 3 + medieval 1 (level 4 = art A1); mine, smelter, tannery, carpentry, ranch: medieval 3 (own levels 1..3 = A1..A3); market: stone only | medieval levels up to fire 10 |
| Art lookup | `sprites.buildingArt`: art index = `level - stoneN` | one art covers two levels: needs a level-to-art table |
| Per-level footprint | built (`levels[i].size`, `construction.growCheck/startGrow`) | reuse for the palace |
| Ranks | `ranks.json`: 4 branches, ranks 1..7, `power`/`ration` arrays of 7, ranks 6-7 `soon: true` (no gear recipes), `research.soldierTier` loops to 7 | ranks 8..10, gear and recipes for 6..10 |
| Gear rule | workshop level = gear tier (rank 5 gear needs workshop 5), so "rank <= fire level" already holds in practice | make it an explicit check |
| Deeds | `encounters.deeds` (key, tribe, day), `deedCount` with a day window | mark table (deed -> Dấu) |
| Flags | `flag` lives inside one talk only | long-term flags = new saved state |
| Quests | `quests.json` is the linear tutorial chain (67 quests, `done` conditions), no giver, steps, choices or reward | side quests need another runner |
| Play mode | no Dễ / Thường / Khắc nghiệt setting exists | add `storyMode` |
| Save | `SAVE_VERSION = 48` | 49, one migration for story + ranks + levels |

## Files by phase

| Phase | New | Changed |
|---|---|---|
| 1 engine | `src/sim/story.ts` (system: tick, knots, leaves, fruits, tips), `src/sim/storydata.ts` (pure: types, marks from deeds, weights, seeded draw, `validateStory`), `src/data/story/` sample set, `tools/simStory.mjs` (`--seed N --mode normal`, `--check`) | `sim.ts` (field `story`, tick hook, wrappers), `save.ts` (SAVED + v49 + `MIGRATIONS[48]`), `encounterdata.ts` / `encounters.ts` (story effects and conditions), `model.ts`, architecture doc row |
| 2 soldiers | `tools/gen-ranks.mjs`, 12 handtools, 12 armours, 3 mounts, gun anims, `src/data/rankcurve.json` | `ranks.json`, `weapons.json`, `research.json` (`recipeLevel`), `researchtree.json` (leaps 8..10), `research.ts` (`soldierTier` bound from data), `barracks.ts` (fire-level check), `battle.ts` (bodyguard hook), `brainfoe.ts` + `model.ts` (assassin), `medieval_units.json` |
| 3 buildings | `tools/gen-levels.mjs`, `tools/art-derive.mjs`, `src/data/artlevels.json` (level -> art index, decoration rules), about 85 art JSON | 33 `building.json` (levels by generator), `progression.json`, `sprites.ts` (`buildingArt`), `gen-content.mjs` (comment only) |
| 4 people + quests | `tools/gen-characters.mjs`, `src/data/characters/*.json` (14), `src/data/story/quests/side_quests.json` (12), `src/sim/sidequests.ts` | `sim.ts`, `save.ts` (inside `story`), dev menu, Nhật ký UI |
| 5 story content | `tools/gen-story.mjs` (doc tables -> JSON, with checks), `src/data/story/{index,marks}.json`, `world/roots.json`, `stone/*` (7), `medieval/*` (6), `quests/from_flags.json` | `encounters/stone.json` (thread and chapter tags, new chapters), journal, market, raid hooks |
| 6 acceptance | none | fixes only |

`tools/check-*` is off limits (CLAUDE.md), so the story checker is `validateStory` inside `storydata.ts`, run by `simStory.mjs --check`. Tests are not run in Phase 6 (CLAUDE.md); typecheck + build + simulation only.

## Soldiers, ranks 8 to 10

| Branch | 8 | 9 | 10 |
|---|---|---|---|
| foot | Kích thủ giáp lá: `halberd`, armour `halberdier` | Hiệp sĩ bộ: `bastard_sword`, `footknight` | Đội trưởng cấm quân: `royal_blade` + shield, `captain` |
| archer | Nỏ thủ nặng: `heavy_crossbow`, `arbalist` | Hỏa thương thủ: `fire_lance`, `firelancer` | Pháo thủ tay: `hand_cannon`, `gunner` |
| cavalry | Kỵ binh nặng: `long_lance`, `heavyrider`, mount `horse_barded` | Hiệp sĩ kỵ: `knight_lance`, `knight`, `horse_caparison` | Kỵ sĩ vương: `royal_lance`, `kingsrider`, `horse_royal` |
| guard | Cấm vệ: `glaive`, `royalguard` | Cận vệ tinh nhuệ: `poleaxe`, `eliteguard` | Cận vệ vương: `partisan` + tower shield, `kingsguard` |

- Guard rank 6 is already named "Cận vệ hoàng gia", so rank 8 is named "Cấm vệ" to avoid two ranks with one name.
- Stats come from `rankcurve.json` (one formula); `gen-ranks.mjs` writes `power`, `ration`, costs. Curve choice is question 2.
- Rank N needs Nhà chung level N, the Binh lực leap of rank N, and gear from a workshop of level N. Counter triangle unchanged. Guns are archers (ranged), 13th-14th century only.
- Ranks 6-7: remove `soon`, add recipes with steel and medieval goods.

## Bodyguard and assassin (minimal)

| Role | Data | Rule | Code |
|---|---|---|---|
| Cận vệ | `Villager.wardOf?: id` set in the Trại lính gác panel, guard rank >= 7 only, one ward per guard | when the ward is hit and the guard is alive within 2 tiles, 70% of the damage goes to the guard | one hook where damage lands (`battle.ts`); hidden loyalty lives in story state, not on the unit |
| Sát thủ (enemy) | `FoeAI` kind `assassin` with `stealth` | not drawn and not targeted until within 3 tiles of a soldier, tower or guard; walks to one named target, strikes, flees | `brainfoe.ts`, `threatsOf` gate |
| Sát thủ (player) | none (no unit) | hired through a quest: a seeded roll with odds from Lộ and the target's guards, like a scout mission | `sidequests.ts` |

## Building levels

Nhà chung: level 4..10 = art A1..A7. Sizes are question 3.

| Group | Kinds | Levels | Art |
|---|---|---|---|
| Military | infantry, archery, cavalry, guardpost, stable, drill, scouttent, wartent, supplycamp | up to 10 | A1: 4-5, A2: 6-7, A3: 8-9, A4: 10 |
| Defence | fence, gate, tower, trap | up to 10 | A1: 4-5, A2: 6-8, A3: 9-10 |
| Economy and core | house, storage, toolstore, armory, lab, market, workshop, farmhouse, lumberyard, quarry, huntlodge, builder | up to 10 | A1: 4-5, A2: 6-7, A3: 8-9, A4: 10 (market gets its first medieval levels) |
| Medieval | mine, smelter, tannery, carpentry, ranch | own levels 1..7, cap = fire level - 3 | A1: 1-2, A2: 3-4, A3: 5-6, A4: 7 |

- `field`, `fieldtent`, `campfire` follow their own rules (field as economy, fieldtent stays 1 level).
- Level numbers (cost, time, hp, cap, slots) come from `gen-levels.mjs`: geometric growth from each kind's last existing level, factors in `artlevels.json`. Idempotent: it rewrites only levels above the hand-made ones.
- `art-derive.mjs`: A(n+1) = A(n) + level layers (stone base, crenels, banner, torches, extra floor or tower, slate roof), shared palette names, outline layer last, 1 px `#2b1d10`. Hand-made: Nhà chung A2..A7 and one signature detail per barracks.
- Counts stay tied to the Nhà chung level (`limit` / `perFire` in each `building.json`), never to research.

## Story engine

| Piece | Design |
|---|---|
| Marks (Dấu) | not saved: computed from `deeds` with `marks.json` weights and day windows; Hợp unbounded; stone marks count 50% after the era day; Luật and Của get new deed keys |
| Saved state | one record `sim.story`: `flags`, `chapters` (per thread), `knots` (fired), `leaves`, `fruits`, `tips`, `wildUsed`, `eraDay`, `baseVillages` (7), `quests`, `mode` |
| Draw | `seedRoll(worldSeed, knotId)`; `w = max(wmin, base + sum(a * mark))`; wild leaf 8%, once per game; overdue knot fires its pale leaf |
| Progress | stone: mean of fire level and boss contact; medieval: Nhà chung level (table "Nhịp trung cổ") |
| War mode | Thân IV, VI, VIII tick with the encounter clock (frozen in war); Thân V chapters run in war, its knots fire on leaving war |
| Modes | `hard: true` leaves: off in Dễ, base in Thường, x1.5 in Khắc nghiệt |
| Soldier needs | a leaf with `needs` falls back to its `alt` when the player lacks the unit; the story never unlocks units |
| Off | tip N5 (points flow to N1), Thân Tín ngưỡng |

Content size: stone 6 threads, 6 knots, 24 leaves + 6 wild, 10 fruits, 10 tips; medieval 10 threads, 8 knots, 32 leaves + 4 wild, 10 fruits, 8 tips; 12 side quests; 14 characters.

## Old logic touched (one line each)

| # | Where | Change |
|---|---|---|
| 1 | `save.ts` | `SAVE_VERSION` 48 -> 49, record `story` in SAVED, `MIGRATIONS[48]` (empty story state, `baseVillages` from tribes + conquests) |
| 2 | `encounters.ts`, `encounterdata.ts` | new effects `sflag`, `chapter`, `journal`; conditions `sflag.<name>`, `mark.<key>`; per-talk `flag` unchanged |
| 3 | `encounters/stone.json` | scripts gain `thread` / `chapter` tags and new chapters; no existing line removed |
| 4 | `ranks.json`, `research.ts` | arrays 7 -> 10, `eraRanks.ancient` to 10, `soon` removed from ranks 6-7, `soldierTier` bound from data |
| 5 | `barracks.ts` | explicit check: rank N needs Nhà chung level N (ranks 4+) |
| 6 | `campfire/building.json`, `progression.json` | levels 5..10, `popByFire` to 10 entries; boss gate at level 4 unchanged |
| 7 | all `building.json` | medieval levels extended by generator |
| 8 | `sprites.ts` | art index from `artlevels.json` instead of `level - stoneN` |
| 9 | mine, smelter, tannery, carpentry, ranch | cap becomes fire level - 3 (today: level 3 at fire 4); houses already above the cap keep their level |
| 10 | `battle.ts`, `brainfoe.ts` | bodyguard damage share, assassin foe |
| 11 | `sim.ts` | story tick next to `tickEncounters`; hook on leaving war mode |
| 12 | new game screen | `storyMode` choice (default Thường; old saves = Thường) |
| 13 | `quests.ts` | untouched; side quests run elsewhere (question 1) |

## Estimated generated JSON

| Set | Files |
|---|---|
| Soldier gear (handtools, armours) | 24 + 3 mount bodies + 1 anim set |
| Building art | about 85 (6 Nhà chung by hand-written generator, the rest derived) |
| Building level tables | 33 files edited in place |
| Characters | 14 |
| Story | 18 files |

## Decisions (answered 2026-11-15, do not ask again)

| # | Question | Answer |
|---|---|---|
| 1 | Side quest runner | Encounter talk engine: each step is an encounter script, plus a small tracker `sidequests.ts` (max 3, deadline, reward). `quests.ts` untouched |
| 2 | Rank 8-10 curve | power x1.35 per rank: 33.75 / 45.6 / 61.5 (hp and atk about +16% each) |
| 3 | Nhà chung footprint | level 4-5: 2x2, 6: 4x4, 7: 6x6, 8: 8x8, 9: 8x8 (taller: towers, keep), 10: 10x10 |
| 4 | "Old logic touched" table | approved in full, including cap = fire level - 3 for the five medieval houses and the new `storyMode` |

## Phase log

| Phase | State | Notes |
|---|---|---|
| 0 | done | this file |
| 1 | done | engine + sample data; tree asleep in the game (`index.json` `enabled: false`, dev switch "Chạy cây cốt truyện"); save v49 |
| 2 | done | ranks 6-10 of 4 branches (`tools/gen-ranks.mjs`), `specialists.ts` (bodyguard, assassin) |
| 3 | done | levels 4-10 for every kind, per-level footprint, art for every level with moving parts, specialist buildings, walkable walls (see Phase 3 notes for what is left) |
| 4 | done | 14 characters (`tools/gen-characters.mjs`), 12 side quests on the talk engine (`sidequests.ts`), blueprint shelf at the Chợ, save v50; quests and shelf asleep in the game (`enabled: false`, dev switch) until Phase 5 |
| 5 | done | full tree from `tools/gen-story.mjs` (stone 6 branches / 6 knots / 24 leaves + 7 pale + 6 wild / 10 fruits / 10 tips; medieval 10 / 8 / 32 + 1 pale + 4 wild / 10 / 8), tree, side quests and blueprint shelf ON in the game, Di sản list, story mode in Cài đặt |

## Added by the user after Phase 0 (2026-11-15), for Phase 3

| Requirement | Plan |
|---|---|
| Every building may grow its footprint by level, not only the Nhà chung (gates, fences, walls too) | `levels[i].size` already works for any kind (`construction.growCheck/startGrow`); `gen-levels.mjs` writes a size per level from a table in `artlevels.json` (per group, e.g. houses 2x2 -> 3x3 at A3, barracks 2x2 -> 4x4 at A4, gate 2x1 -> 3x1 -> 4x1) |
| Soldiers stand and walk on walls, gates and fences | wall kinds get `walkTop` from a level on: a second path layer on top (stairs at gates and towers), archers on top get the tower bonus (`units.json archerOnTower`); touches `world` pathing, `battle.threatsOf`, render order. **Old logic: I state the exact conflicts and ask before coding this in Phase 3** |
| Art must feel alive, not a pasted picture | every A-level art gets moving parts drawn by the renderer, not baked: banner sway, torch flicker, chimney smoke, lit windows at night, people at doors or on walls; depth by a ground shadow and a base that overlaps the tile behind; `art-derive.mjs` emits named anchor points (`banner`, `torch`, `smoke`, `post`) the renderer animates |

## Phase 1 notes for later phases

| Point | Note |
|---|---|
| Scene = visitor script | a scene of a chapter, leaf or fruit is a `Script` whose id is its owner's id; "chapter done" = `encounters.seen[id]`. No change to `stone.json` |
| Conditions | `evalCond` now adds names joined by `+` and knows `mark.`, `sflag.`, `leaf.`, `fruit.`, `chapters.`, `tip.`, `progress`, `mode` |
| Effects | visitor scripts: `sflag`, `journal`. Leaves and fruits (no visitor): `give`, `take`, `deed`, `rel {tribe, n}`, `raid {tribe, size}`, tribe `@boss` |
| War mode | the tree ticks only in the peaceful loop; days still pass in war, so what was due fires on leaving war. Thân V chapters inside war need their own hook (Phase 5) |
| Deeds cap | `encounters.deeds` keeps 300 entries; Hợp (no window) can lose very old deeds. Raise the cap in Phase 5 if a long game needs it |
| `baseVillages` | counted at the first step (seed 4242 gave 4, the doc assumes 7): check in Phase 5 |
| Play mode | `sim.story.mode` + `sim.setStoryMode` exist; the new-game choice (UI) comes with the hard leaves in Phase 5 |
| Checker | `node tools/simStory.mjs --check` (no `tools/check-*` file) |

## Phase 2 notes for later phases

| Point | Note |
|---|---|
| Ranks | one script, rerun-safe: `node tools/gen-ranks.mjs` writes ranks.json, weapons.json (craft cost + time for ranks 6-10), mounts, research, art. Rank data is edited in the script tables, not by hand |
| Renames (user allowed) | foot 6 Trọng giáp binh; archer 6 Xạ thủ trường cung, 7 Nỏ thủ; cavalry 6 Kỵ binh bọc giáp; guard 6 Lính gác chuyên nghiệp, 7 Cận vệ thành trì |
| Curve | `ranks.json curve`: power x1.35 (33.8 / 45.6 / 61.5), ration +0.28 per rank |
| Rank rule | rank N needs Nhà chung level min(N, highest campfire level defined): tightens by itself when Phase 3 adds levels 5-10 |
| Craft | recipeLevel of rank N gear = N (workshop level): ranks 5+ stay locked until Phase 3 builds workshop levels. Research leaps of ranks 8-10 ask Nhà nghiên cứu level 4 (`lab` in the leaps): raise it in Phase 3 |
| Research | 5 new rows per arm (rows 14-18): leaps `<arm>_tier8/9/10`, 20 new research lines of 5 levels each. Tier 10 needs about 100-270 researches |
| Projectiles | firearms (fire_lance, hand_cannon) still fly as arrows (`projectile: arrow`); a bullet look and a bang sound are not done |
| Bodyguard | set in the unit panel of a guard rank 7+ ("Cận vệ cho"); no named characters yet (Phase 4) |
| Assassin | enemy only: dev button "Sát thủ tới (thử)" or `sim.sendAssassin(tribeId, targetId?)` for story leaves; hiring one through a quest is Phase 4/5 |
| Not done | `medieval_units.json` (viewer list) not updated; the viewers are not built |

## Update doc `doc/UPDATE_di_san_mo_khoa.md` (read 2026-11-16): what it changes

Rule: story never locks the core (4 arms rank 4-10, all buildings of the table, basic goods); it unlocks only "specialists" (units, buildings, perks) through `isUnlocked(key)`.

| Phase | Added work | State |
|---|---|---|
| 1 retrofit | `src/data/story/unlocks.json`, `isUnlocked`, `unlocksBought` in SAVED inside the same v49 migration, A5 checks in `validateStory` (strict only from Phase 5) | done |
| 2 retrofit | 7 specialist unit presets, locked by default (`unlockedBy`), stats by Nhà chung level, budget = core of the same rank, training +30%, ration +1: M1 Cấm quân tuần phòng, M2 Cung thủ ngựa, M3 Sát thủ (player-trainable), M4 Cận vệ thuê (hired with Của), M5 Hiệp sĩ đào ngũ, M6 Du kích, M8 Kỹ sư công thành | done (`specialists.json units`, `barracks.trainSpecialist`, rolepane cards; dev switch unlocks all) |
| 3 | 10 specialist buildings (`tools/gen-specialists.mjs`), locked by default (table A2 of the doc) | done (art + data + lock + tray tab "Di sản"; their effects come in Phase 5) |
| 4/5 | blueprints at the Chợ, side quest "mua bản vẽ", fill `unlocks.json`, Nhật ký > Di sản | later |

## Decisions of 2026-11-16 (do not ask again)

| Question | Answer |
|---|---|
| Blueprint price | 3x the cost of one specialist unit (or building); a global factor in `unlocks.json` |
| M8 specialist | Kỹ sư công thành: breaks walls, gates, towers much faster. Needs a new rule in `siege.ts` (touches old logic: say where before coding) |
| Capture-a-village blueprint path | No: blueprints only at the Chợ (and side quests) |
| Walkable walls | A path layer on top of walls, gates and towers from level 6; stairs at gates and towers; soldiers stand and walk; archers on top get the tower bonus; **enemies can climb too** (when they break a gate or stair they may use it). Touches pathfinding, target choice, drawing |

## Phase 3 notes

| Point | Note |
|---|---|
| Data | `src/data/artlevels.json` holds growth, names, sizes, `upTo` (which art draws which level), `handMade` (levels the generator never touches), `specialist` kinds. Rerun order: `gen-levels`, `gen-keep`, `art-derive`, `gen-specialists`, then `npm run build` |
| Caps | a house reaches the Nhà chung's level; the five medieval-only houses (Mỏ, Lò luyện, Xưởng mộc, Xưởng thuộc da, Trại chăn nuôi) level = fire - 3 (`levelCapOf`); they and the specialist kinds are not asked for when leaving a fire level |
| Numbers | costs x1.45 a level (Nhà chung x1.6) with steel from level 6, coin 7, fine steel 8: **not balanced**, run `npm run economy` when you ask |
| Sizes | levels 8-9 base+1, 10 base+2 (2x2 -> 3x3 -> 4x4); Nhà chung 5: 2x2, 6: 4x4, 7: 6x6, 8-9: 8x8, 10: 10x10. Walls, field, drill, ranch keep their size for now |
| Art | A1 hand-made, the rest derived; tents (infantry, scouttent, wartent) and flat kinds get posts, the others a stone turret. Everything alive is baked as 4 frames (banner, torch, smoke, fountain), glow and smoke drawn after the outline |
| Walls | fence, gate, trap are drawn by code (`drawFence`, `drawGate`); from level 6 fences and gates are stone with a walkway (`stoneSpan`), see below |

## Walkable walls (done in Phase 3)

| Point | Note |
|---|---|
| Rule | fence, gate, tower of level 6+ (`data/walls.json`): their tiles are a top; stairs = ground tiles beside a gate or tower, both sides; units of both teams climb; `battle.layerApart`: sword and spear blows only within one layer; archers on a wall: damage x1.25, range +2 |
| Orders | `orderMove` to a top tile sends a soldier up (ground to stair, up, along); to the ground sends him down; guards and posts follow because `movement.pathTo` plans the climb |
| Not done | picking a unit on a wall by clicking (the sprite is lifted 26 px, the hit area is not); gates and fences do not grow their footprint (a gate's growth along a rotated row needs `growRect` to turn); walls under fire do not drop the soldiers on them (they are put on the ground by the unstick rule within a second); stairs cannot be drawn or shut; towers keep their own "inside" archers |
| Check | headless: climb, walk, descend, an assassin climbing after a unit on the wall, save/load |

## Phase 4 notes

| Point | Note |
|---|---|
| Characters | 14 presets in `src/data/characters/` (edit the table in `tools/gen-characters.mjs`, rerun). Each: look + per age `armor` (rig armour as clothes), `weapon`, `handtool`. Sheet: `node tools/gen-characters.mjs --spec s.json` then `node tools/art-preview.mjs s.json out.png` (art-preview rows now take `cells`) |
| Cast | a visitor script with `cast: <character>` sends that character: look, title before the name, `Villager.outfit` (drawing only, no armour stats). Phase 5 scenes can use it (`Scene` has no `cast` yet: add it in `sceneScript`) |
| Not used yet | firekeeper, mole (only a step), boss_chief, bodyguard are not quest givers: they wait for the story (Phase 5). `boss_chief` is not yet put on the real leader of the boss village |
| Side quests | `src/data/story/quests/side_quests.json` (format in its `_note`): 12 quests, 2-3 steps, each step a talk at the gate; step 0 is the offer (a refusal is added). Tags of the answers pick the reward; goods times `rewardByFire[level]`; costs times `costMulMedieval` in the medieval age. **Rewards are not balanced** |
| Simplified | escort, guard, rescue, raid on bandits are told in the talk (a seeded `roll`), nobody walks the map and no fight is staged; "temporary soldiers", "open a fog tile", "black merchant" rewards are goods for now |
| Assassination | `quiet_knife` is the quest way to use an assassin: a seeded roll (0.6 fast, 0.9 slow). Odds do not yet read the mark Lộ, the target's guards or an owned `unit:assassin` (Phase 5) |
| Blueprints | Chợ tab "Bản vẽ" (medieval, Chợ level 1+): `show` 2 keys of `unlocks.json` not yet open, new each season by seed, price = `blueprintCost`. Quests `buy_plan` and `lost_relic` give a random blueprint (goods instead when none is left or in the stone age). Tip M7 discount, TM3 wider shelf, Easy-mode free blueprint: Phase 5 |
| Switches | `side_quests.json config.enabled` and `market.json blueprints.enabled` are false: turn both on in Phase 5. Dev menu: "Nhiệm vụ phụ tự đến + bản vẽ ở Chợ", "Đổi kệ bản vẽ", one button per quest (steps come at once) |
| UI | Nhiệm vụ window lists side quests under the tutorial plan (step, days left, "Bỏ việc"). Nhật ký > Di sản screen is Phase 5 |
| Old logic touched | `encounterdata.ts`: `Effect.quest`, `Script.cast`, `SCRIPTS` + side scripts; `encounters.ts`: `queueScript(..., tribe)`, cast in `spawnVisitor`, `quest` in `applyEffect`; `market.ts`: `MarketState.plans`, `plansRoll` called in `marketRoll` (uses `seedRoll`, the market RNG stream is unchanged); `sprites.ts`: `outfitOf` + cache key; `save.ts`: v50, record `side`, `MIGRATIONS[49]`; `sim.ts`: field `side`, `dev.side`, tick hook after `tickStory`; `tools/art-preview.mjs`: `cells` rows. `quests.ts` untouched |
| Check | headless (scratchpad): every quest played to its end by two ways of answering in both ages (42 paid, 2 lost to a roll, 2 refused for lack of soldiers), shelf buy, save round trip, v49 -> v50, offers coming by themselves with the switch on |

## Phase 5 notes

| Point | Note |
|---|---|
| Source | `tools/story/stone.mjs`, `tools/story/medieval.mjs` (tables: branches, knots, leaves, wild, fruits, tips, legacy, powers, quest flags) -> `node tools/gen-story.mjs` -> `src/data/story/**`. Never edit the JSON. Then `node tools/simStory.mjs --check` and `--runs 200 --policy mix` |
| Deeds | each answer of a scene gets its own deed (`c_IVA1_2`, `l_IV1a_1`, `f_TM1_1`) with its marks in `marks.json`; a named deed in the table (`shared_fire`, `took_captives`) is a tag left beside it, for tilts |
| Engine added | `Scene.cast`; `mods` + `modDays` on leaves, `mods` on fruits and medieval tips (`storyMod(key, day)`); condition `power`; `TreeDef.tipMin` (medieval 3: less than one fruit or three fallen leaves = default tip M7); stone age: which knot of a trunk fires first is drawn by the seed (the other waits while the favoured one can still fire); deeds ledger 300 -> 600 |
| Game hooks (old logic touched) | `market.tier` (fee, quota times `storyMod`), `market.blueprintShelf` (price mod, Thư Viện Di Sản, Sàn Thương Hội +1), `houses.houseRate` (research / craft speed), `sim.ts` war end adds deed `war_fought`, `sidequests` pick weight by `quests/from_flags.json`, Cài đặt > "Độ gắt của cốt truyện" (no new-game screen exists: the mode may be changed at any time) |
| Trunk V | its stages do not appear inside the war mode: they come at the gate after a war was fought (`deed.war_fought>=1`, `>=2`); its knots fire in peace as the doc asks |
| Simulation (200 seeds, mix) | no dead end; every tip stands at least once (M1 and M6 only at the last scoring); normal mode: all specialists between 5% and 60% except Trại Kép (TM6) about 4%; easy mode: M6 / TM6 never by story (hard leaves off) -> blueprints are the way |
| Leaf effects | told in the Nhật ký + goods, relation, raid, deed, flag, timed multipliers. NOT done as mechanics: people leaving or joining (IV1-c, III2-b, I2-c), "no war for 30 days" (regency), council vote delay, tributes by fear (terror), named character killed (VII1-a/b), rebellion campaign chain (VII3-a), new NPC village (N8, IV1-c) |
| Powers | done: Thư Viện Di Sản (M1), Kinh nghiệm sống sót (M7, blueprints -20%), Đô thành tri thức (M8, research +20%), M4 market fee -15%. Names only, no effect yet: Liên quân (M2), Tai mắt (M3), lính thuê tức thời (M4), Hòa giải (M5), Nơi ẩn náu (M6) |
| Specialist buildings | only Sàn Thương Hội has its effect (+1 blueprint on the shelf). The other nine can be built but do nothing yet |
| Stone tips | legacy = first marks, favoured trunk, leaf tilts, and mods for N2 (market fee +20%), N4 (fee -20%, quota +30%), N7 (craft +20%). The other "Ngọn đổi cách game" rows (arrivals x1.5, tribute every 10 days, sworn enemy, daughter village, marriage ally) are not mechanics yet |
| Not done | Easy mode free blueprint at the middle tip; rumour "clear / few" by mode; `encounters/stone.json` untouched (chapters point at the old scripts by id); M1 does not check "all boss villages beaten" (they all are, at Nhà chung 4) |
