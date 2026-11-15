# PLAN: medieval to rank 10, levelled buildings, characters, story tree

Source prompt: `doc/PROMPT_claude_code_fable.md`. Story: `doc/story_tree.md` (the prompt says `docs/`, the file is in `doc/`). Status: **Phase 0 done, decisions recorded below; Phase 1 starts on "tiếp"**.

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
| 1 | next | engine, no content |
