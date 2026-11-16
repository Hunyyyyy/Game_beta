# Game_beta (lang-do-da) — Feature Summary

Player-facing summary of everything the game offers up to now (branch `medieval`, 2026-11-15). Sources: architecture doc, `src/data/*.json`, `src/content/buildings/`.
In-game names stay Vietnamese. ✅ = playable, 🟡 = partial / dev-only / not wired yet.

## 1. Game in one paragraph
Village-building and tribal-warfare game in the browser. Start with 2 villagers around a campfire (Nhà chung), grow through **Stone Age** (campfire lv 1-3) into the **Medieval / Bronze age** (campfire lv 4+, `sim.era = 'ancient'`), trade and talk with neighbouring tribes, repel raids, scout, and conquer or adopt the five NPC villages. Map 960×960 tiles, streamed in 32×32 chunks.

## 2. Core loop
| Step | What the player does |
|---|---|
| Gather | Assign villagers to role buildings; they harvest wood, stone, food, hides, ore |
| Build | Place / upgrade / repair / move / demolish buildings, limits grow with campfire tier |
| Research | Lab unlocks buildings, tools, ranks, stat bonuses |
| Craft | Workshop makes tools, weapons, armour, torches |
| Defend | Fences, gates, towers, traps, guards, war plans against raids / beasts |
| Expand | Scout, trade, tribute, war, adopt villages, reach boss villages → next era |

## 3. Time, seasons, survival
| System | Details |
|---|---|
| Day length | Stone 10 real min (600 s), Medieval 20 min (1200 s); 65% day / 35% night |
| Speed | Pause / fast-forward; "tua nhanh qua đêm" |
| Seasons & weather | Winter 0.8×, summer 1.05×; clear, fog, rain, storm, blizzard, snow slow outdoor work and travel |
| Fog of war | Map revealed by exploring; torches +6 vision |
| Food | Shared meal at end of each day (civilian 2, soldier 3+ by tier); campfire pot first, then store; shortage = up to −20% all stats next day |
| Energy & sleep | Energy drains with work, forced sleep < 20%, beds in houses/barracks (else ground ×0.6); player orders always wake units |
| Shifts & torches | Day / Night / Full-day per villager; night work needs a torch (70% output); strain/fatigue stops abuse of night shifts |
| Death | HP 0 = permanent death (no downed state) |

## 4. Villagers & roles
- Roles are assigned **at the building**, never at the campfire (`assignRole` / `releaseRole`); slots grow per building level (+ research perks).
- Each villager has stats (HP, strength, agility, stamina, intellect…), skills, potential, energy, shift, tool, gear, mount.
- Training house stats 1-5% per course (opposing stat drops); cost food + currency.
- Idle villagers sleep in Nhà dân; new people arrive daily (strangers at the gate script `newcomers`).

| Role | Building |
|---|---|
| Gatherer / Farmer | Nông trại (+ Ruộng fields, optional flax in medieval) |
| Woodcutter | Xưởng gỗ |
| Stonecutter | Xưởng đá |
| Hunter | Chòi thợ săn |
| Builder | Nhà thợ xây |
| Researcher | Nhà nghiên cứu |
| Crafter | Nhà chế tạo |
| Fighter / Thrower / Mount rider | Trại lính bộ / Trại lính cung / Trại lính kỵ (+ Chuồng thú cưỡi) |
| Guard | Trại lính gác (gate guards, tower men, guard rally) |
| Scout | Trại trinh sát |
| Supply soldier | Trại hậu cần (war only) |
| Miner 🟡 | Mỏ (medieval) |
| Herdsman | Trại chăn nuôi (medieval) |
| Smith / carpenter / tanner | Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt (medieval) |

## 5. Buildings (34 kinds)
| Group | Buildings |
|---|---|
| Core | Nhà chung (campfire, lv1-3 stone, lv4 medieval), Nhà dân, Kho, Kho công cụ, Kho vũ khí |
| Economy | Nông trại, Ruộng, Xưởng gỗ, Xưởng đá, Chòi thợ săn, Chợ (3 levels), Nhà thợ xây, Nhà chế tạo, Nhà nghiên cứu |
| Military | Trại lính bộ, Trại lính cung, Trại lính kỵ, Trại lính gác, Chuồng thú cưỡi, Bãi tập, Trại trinh sát, Lều họp chiến (War Council), Trại hậu cần |
| Defence | Hàng rào cọc, Cổng (2 tiles, auto open/close, guards), Chòi canh (tower), Hố chông (spike trap) |
| Medieval | Mỏ, Trại chăn nuôi, Lò luyện, Xưởng mộc, Xưởng thuộc da và dệt |
| Field | Lều hành quân (war field tent, not placed by player) |

Building actions: place, upgrade (bigger footprint for some levels with blocker check + plan bar), repair, move (Di dời), demolish, cancel work in progress (Hủy). Counts limited by campfire tier (`perFire`) and research.

## 6. Resources & items
| Kind | Examples |
|---|---|
| Raw | wood, stone, food (berries, meat, crops), hide, flax fibre, sinew, feathers |
| Medieval ore | iron ore, coal, copper ore (→ bronze), rare ore (far seams, Mỏ lv3), swamp ore |
| Currency | shells (Chợ) |
| Tools | handle + head, tiers 1-5 (stone → bronze → iron → steel), wear and repair |
| Weapons / armour / shields | per rank, durability, repair at workshop, broken gear carried back |
| Torches | craft at workshop |
| Mounts | wolf, boar, elephant (tame at Chuồng thú) |

Finite land: nodes respawn only partly and never near the start; when explored land runs out, the game warns to send explorers.

## 7. Research
- Lab levels gate everything. Three pillars: **Binh lực** (military), **Sinh kế** (livelihood), **Kỹ nghệ** (craft).
- Each branch: rows of 3 stat lines + a leap (new rank, weapons, trade tier, building slots, milestones); medieval rows after the stone rows.
- Perks: build speed, repair cost, craft/research speed, tool durability, storage capacity, far-land gathering, mine/ranch/processing yield, house slots, armour pierce, counter, siege damage, beast damage.
- Market routes (`trade:<give>><get>`) and war pages (formations, battle plans, march) are research too.
- UI: pillar tabs, branch list, confirm bar (`ui/researchpane.ts`).

## 8. Military
| Feature | Details |
|---|---|
| Arms | Infantry, Archers, Cavalry with counter triangle (×1.5 / ×0.67); guards separate |
| Ranks | 1-3 stone, 4-7 medieval (bronze at 4); train at camps with research + weapon in store + bill |
| Gear | `Trang bị` button equips best stock; arm limits what can be carried |
| Squads & formations | Line, Circle, Wedge, Horns, Spread, Ambush; banners, clustering in big battles |
| Camp upgrades | Each camp level gives random 2 of HP / damage / attack speed bonuses |
| Mounts | Faster, less damage taken; cavalry arm |
| Defence | Fence, gate, tower archers, traps, defence presets, alarm bell, guard rally |
| Combat | One battle engine for both sides, armour, projectiles, chase, wear of gear |

## 9. War (medieval only)
| System | Details |
|---|---|
| Scouting | Tent scouts find villages (smoke rings, sightings), 3 intel tiers, map detail depends on scout skill and number |
| War plan | Squad missions with formation tiles, path arrows, retreat paths, launch schedule, signals, tactical cards, weather/rest options |
| War Council report | Win rate, casualties, warnings, supply sums (by research tier) |
| March | Slow-down, food/energy factors, supply soldiers carry packs, field tents each night, tired penalty |
| Siege | Clear trees/rocks on the path, break walls and towers, victory = enemy soldiers dead + fire out + towers down |
| Harassment | Attacked tribe sends bands at the army on the road |
| War mode | Home freezes (economy, events), save/load refused, animals leave the field |
| War log | Nhật ký trận: sent/dead by arm, goods spent, loot |
| Legion march 🟡 | Bãi tập "Hành quân": military zones 30×30, squares of 25, "Tập trận" moves army as one block (march only) |
| Not done | Fire attacks, baiting, supply-line cutting, prisoners, espionage, auto walls |

## 10. Tribes & diplomacy
| System | Details |
|---|---|
| Villages | 5 NPC villages (Suối Nguồn, Rìu Đá, Đầm Lầy, Hang Gấu, Đồi Cát … plus Bến Cá, Đỉnh Gió) in tiers weak / normal / medium / boss; asleep = data, awake near the player |
| Relations | Gifts, tribute (player sets share, may betray), surrender, adoption, allies lent for war |
| Conquest | Adopt or wipe out: people, camp places, yield; beaten villages rebuild |
| Bosses | One step above the player, bronze gear, towers; all fallen → medieval transition |
| Frontier | Two bandit camps (strength changes, drop loot) and late-comer tribes that retake villages |
| Raids | Scheduled + recurring events (wolves, bears, raids), hostile villages raid by themselves; rewards for beating events |
| Visitors 🟡 | Strangers at the gate with mood-based dialogue (stone-age scripts): trade, refugees, pursuers, ultimatums, thieves, ransom, recruits |

## 11. Market (Chợ)
Only place to trade: sell goods for shells or swap goods. Daily quota at fair price, past it costs more; level sets rate, fee, quota; swaps unlock by research; medieval goods wait for the age.

## 12. Medieval economy
- Mỏ (3 levels, 3/5/8 places) with per-miner ore choice; ore pace and tool grade.
- Processing houses: orders paid up front, workers craft recipes into goods.
- Trại chăn nuôi makes hide, fibre, sinew, feathers on its own.

## 13. Eras
Stone → Medieval when campfire reaches lv4. Medieval unlocks war layer, scouts, tower roles, new buildings, level-5 art. Dev menu can set era.

## 14. UI
| Area | Panels |
|---|---|
| Map | Select, drag orders (move, work, attack, loot), minimap / big map (key M) |
| Top bar | Resources, day clock, speed, journal, menu |
| Building | Card with ☰ panel, ⬆ upgrade, ✥ move, ✖ demolish, Hủy |
| People | Roster, unit card/detail, stats overview, soldier pane |
| Tribes | Village cards (rewards, relation), gifts, tribute |
| War | War panel, plan map (pan/zoom), warbar, war log, scout pane |
| Other | Quests, dialogue with visitors, settings, save list, era dialog, forge pane |

## 15. Tutorial quests (4 chapters)
| Chapter | Content |
|---|---|
| 1 Những ngày đầu bên đống lửa | Learn village, lumberyard, builder, storage, farm, workshop, torch, hunter, campfire lv2 |
| 2 Nghiên cứu và mở rộng | Lab, houses, infantry camp, recruit and equip, War Council, scout tent, find a village, first squad, campfire lv3 |
| 3 Phòng thủ và quân đội | Fence, gate, tower, thrower camp, defence preset, spike trap, signals, wedge, deploy, test battle, campfire lv4 |
| 4 Tác chiến và thú cưỡi | Win a battle, wedge squad, stable, cavalry camp |

## 16. Saves & dev
- Saves: sessions with storage adapters, versioned (`SAVE_VERSION` + migrations); refused during war.
- Wildlife: rabbit, fowl, deer, boar, wolf, fish, aurochs, duck, fox, ibex, elk, bear, lion, mammoth, pike; herds restock daily.
- Dev menu: unlock all tech, raise army, simulate camp of a level, ally a tier, attack nearest boss, set era, try bigger house, palace preview.

## 17. Known gaps / planned
Mine research branch, medieval soldier art (tier-1 done, not wired), stone guard art not fully wired, late-game palace (lv7-8), walkable walls and drawbridge gates, encounter dialogue phases P2-P5.
