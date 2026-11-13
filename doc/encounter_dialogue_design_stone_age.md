# Design: Visitors and Dialogue (Stone Age)

> Status: **plan, no code yet.** Scope: Stone Age only, but the engine is written to be reused for the Medieval era.
> Medieval (4 levels) comes later, once the Stone Age version is stable. Only a direction is recorded in section 12.
>
> Language note: this doc is in English, but all in-game text (dialogue lines, button labels, tribe names such as Suối Nguồn, Rìu Đá, Hang Gấu) stays in Vietnamese because that is the game's language. English glosses are added in parentheses where needed. Code identifiers are unchanged.

## 1. Why

From about day 15 the player runs out of things to do: houses are built, the stockpile is low, research needs resources. Only three ways to get resources remain, all passive:

1. Trade at the market (wait for the daily reset).
2. Defend the village when attacked.
3. Fast-forward so villagers produce. The more you skip, the more events pile up. Soldiers stay level 1, and losing a fight costs villagers.

The market is also illogical: the player trades with nobody, yet exchanges goods as if self-sufficient.

Goal: give the player **something to do while waiting**, and **a way other than fighting** to relieve pressure. Every choice has a real consequence later.

Corollary (important): the player is usually *out of resources* at the moment this matters. So offers must not all be "pay resources, get resources". Some must be payable with **other assets**: villager labor, information, favors, later soldiers (see section 6, "Payment types").

## 2. Decisions already made

| # | Decision |
|---|---|
| 1 | While a dialogue is open, **the world is paused except what is in the camera view** (revised 2026-11-13: a full freeze looked abrupt). The clock, weather, economy, events and everyone out of view stand still; villagers and the guest in view keep moving (`Sim.sceneTick`, built on `sim.view`). The camera flies to the guest and zooms in, and flies back when the talk ends. |
| 2 | A visitor waits **1–3 game days depending on type**. If the time runs out the visitor leaves and the consequence is written to the `deeds` ledger. |
| 3 | The portrait comes from the **existing character rig**, drawn **large, half-body, with subtle motion**. **No** round avatar or face icon. The dialogue UI must look good, not a square box with a small avatar in the corner. |
| 4 | **No** Village Elder / Shaman role yet. Hints for reading people live inside the dialogue itself (section 6). |
| 5 | The market changes so each day has **a merchant from a specific tribe** (section 9). |
| 6 | Bad people **act for real**: rob resources, kidnap villagers, or turn into a real attack. Every bad outcome has a **guaranteed way to be foreseen** (see "Clue rules", section 6). |
| 7 | **New.** A dialogue can be set aside with a **"Later" button** (visitor keeps waiting, time resumes). A frozen modal alone would contradict "player orders are supreme". |
| 8 | **New.** Random outcomes are **derived from a per-visitor seed**, not rolled live, so reloading cannot re-roll them (section 5). |

General principle (from CLAUDE.md): the player's orders are always supreme. Dialogue never forces an action. It only offers choices and consequences.

## 3. Player journey (Stone Age)

The Stone Age has 3 levels, about 4–5 hours of play, not counting fast-forward. "Level" here is `fireLevel(sim)` (fire level, already in `construction.ts`).

| Level | What the player is doing | What dialogue adds |
|---|---|---|
| **Stone 1** (~0–1.2h, days 1–15) | Busy building and hunting, knows nobody | Teaches the mechanic: 1–2 **friendly, low-risk** visitors (hungry traveler, refugees). The player learns "press Receive → listen → choose". The day-11 Axe-tribe scout becomes a real conversation. |
| **Stone 2** (~1.2–3h, days 15–35) | Out of resources, starts needing to go outside | Varied visitors, **including liars and tribute-demanders**. Market has tribe-specific merchants. Favors/requests. First expedition (P4). |
| **Stone 3** (~3–4.5h) | Strong enough to pick sides | Alliance envoys, two feuding tribes asking for help (`feuds`), spies. Story dialogue when the lead tribe collapses. |

Emotional rhythm per 10 game days: **about 2–3 visits** (opportunity or risk), ~1 pressure event (raid, wild beasts), ~1 proactive task (favor, expedition). Stone 3 is slightly denser (gap 2–4 days); treat the number as a target to tune, not a promise.

## 4. Flow of one encounter

```
Day X: a script is chosen; the visitor's "truth" and outcome seed are rolled and SAVED (reload does not change them)
   → visitor walks from their tribe's direction to the meeting point (the gate if there is one, else just outside the outermost house on their side)
   → notice: "Làng Suối Nguồn có người đến cổng ... [Tiếp đón]" ("People from Suối Nguồn are at the gate ... [Receive]"). If fast-forwarding, speed drops to 1 automatically.
   → visitor stands waiting with a "!" over their head. Wait time 1–3 days.
   → player presses [Receive] → camera moves to the visitor → TIME FREEZES
   → dialogue: click anywhere for the next line → choice turn → result → may chain into another node
   → "Later" at any choice turn: dialogue closes, time resumes, the visitor keeps waiting (the wait clock continues from where it was)
   → end: visitor leaves (or stays as a villager, or turns into a raiding party), time resumes
   → consequences are written to deeds; some schedule a meeting or event after N days
```

If the visitor is not received before time runs out: they leave and `deed: ignored:<script>` is written. A script may customize what happens when ignored (e.g. the tribute-demander comes back and attacks).

**A raid arrives while a visitor is waiting:** the visitor withdraws toward home, with a notice, and no penalty (`deed: withdrawn:<script>`, neutral). If the raiders are the visitor's own tribe, the visitor leaves immediately and is not offered a talk.

**Waiting at night:** a visitor stays at the gate overnight. Wild animals ignore guests (P1 default, simplest; revisit if it looks odd).

## 5. Architecture

Follows the `src/sim` rules in CLAUDE.md: village systems do not import other village systems, cross-calls go through `sim.method(...)`, no file-scope `let`, randomness only via `sim.rnd` / `sim.frnd`.

| File | Role |
|---|---|
| `src/data/encounters.json` | Global config: visit cadence, arrival hours, wait times, truth ratios, repeat policy. |
| `src/data/encounters/stone.json` | Stone Age scripts (one file per era, split further when long). |
| `src/sim/encounterdata.ts` | **Pure data layer**: types, script validation, condition evaluation (does not use `Sim`). |
| `src/sim/encounters.ts` | **Village system**: spawn visitors, walk to meeting point, open dialogue, run choices and effects, manage `deeds`, timed events, scheduling queue. |
| `src/ui/dialogue.ts` + `src/styles/dialogue.css` | Dialogue UI; calls only `Sim`. |
| `sim.ts` | Forwarding functions: `encounterOpen`, `encounterAdvance`, `encounterChoose`, `encounterSkip`, `encounterLater`. |

Hooks needed in existing files (see section 11):

- `notices.ts`: notices with a **Receive** button and a point for the camera to move to.
- `model.ts`: `Notice` type needs a `focus` field (coordinates) and a `meet` command.
- `controller.ts`: add a function to move the camera to a coordinate (today there is only `focusSelection`).
- `sim.ts`: the step loop does not run while a dialogue is open.
- `save.ts`: register new fields in `SAVED`; bump `SAVE_VERSION` (currently 39) and add `MIGRATIONS[39]`.
- `tribes.ts`: relation functions already exist. Dialogue effects go through **those functions**, not a parallel relation mechanism.

### Saved state

```
sim.encounters = {
  active:   { id, node, visitorId } | null          // dialogue currently open (null if set aside via "Later")
  visitors: [{
    id, scriptId, tribe,
    name, sex, age,                                  // generated once, see "Visitor names"
    truth, tone, seed,                               // seed drives every random outcome of this visitor
    party: [{ role, gear }],                         // who came with them (for appearance + speaker rule)
    state: "walking" | "waiting" | "talking" | "leaving",
    x, y, arrivedAt, expiresAt, look, cluesSeen: [] // cluesSeen feeds the notes strip (section 7)
  }]
  queue:    [{ scriptId, day, priority, linkedTo?, ifStill?, maxDelay? }]   // scheduled scripts (follow-ups, consequences)
  nextAt:   day the next visitor is rolled
  deeds:    [{ key, tribe?, day, count }]            // consequence ledger
  eventMods:{ [eventId]: { sizeMul, powerMul, shiftDays, cancelled, sources: [] } }   // see 9.1
  seen:     { [scriptId]: { times, lastDay } }        // repeat policy
}
```

**Truth and outcomes are save-proof.** `truth` is rolled once when the visitor appears and saved. Every later random outcome (`random` effects, "intimidate back succeeds", "40% exposed") is computed as `hash(visitor.seed, nodeId, choiceIndex)` instead of calling `sim.rnd` live. This works whether or not the RNG state is saved, and stops save-scumming at the choice screen.

**Visitor names.** Names are not written into scripts. Use the existing `makeName(sex, voiceOf(tribe), sim.rnd, taken)` (`src/sim/names.ts`, called from `villagers.ts`): the name is generated in the tribe's "voice" so it sounds like that tribe. The name is created when the visitor appears and stored in `visitors[].name`. Scripts only use tokens (below). "Lão Tơm" in section 7 is an illustrative example only.

**Text tokens.** Because names and sex are generated, scripts use tokens instead of fixed words: `{name}`, `{tribe}`, and Vietnamese address tokens that follow sex and age: `{he}` (hắn / cô ta / lão...), `{title}` (lão / bà / cậu / cô...). Never hard-code "Hắn" in a clue line; write `{He} không cho ta chạm vào hạt giống.`

**Visitors are never built from a tribe's leader unit.** Otherwise `killFoe` on the player's side would set `leaderDead` by accident.

**Content versioning.** A save holds `scriptId` and a node id. If a later patch renames or removes that node, the save breaks. On load, validate `active.node` and queue entries against the current scripts; on mismatch, close the dialogue gracefully, the visitor leaves, write `deed: lost_thread`, and drop invalid queue entries.

### Scheduling and priority

Several things can want a visitor on the same day: the fixed day-5 wanderer, the fixed day-11 scout, follow-ups (`pursuers`, return visits), raid ultimatums, and the random roll. Rules:

1. Order: due `queue` entries (by `priority`, then by day) > fixed scheduled scripts > the random roll.
2. `queue` entries and fixed scripts **ignore `nextAt` and `blockNearEvent`**. They still respect `maxVisitors`: if a visitor is already present they slip by one day, at most `maxDelay` (default 2). After that: ultimatums resolve with their "ignored" outcome; others are dropped with `deed: missed:<script>`.
3. An ultimatum's arrival must be at least 1 day before the raid, and its wait is clipped to `raidDay - arrivalDay` so it can never outlast the raid.
4. Every `queue` entry may carry `ifStill`, a condition re-checked when it fires (tribe alive, not at war, linked visitor still exists). If it fails, drop silently.
5. If the linked visitor was killed or dismissed, entries with `linkedTo: visitorId` are cancelled, or replaced by the script's `onAttacked` follow-up (section 15).

## 6. Script data

```jsonc
{
  "id": "peddler",
  "era": "stone",
  "fireLevel": [1, 3],            // allowed fire levels
  "minDay": 8,
  "weight": 3,
  "maxTimes": 3,                  // NEW: lifetime cap; also `once: true` for one-offs
  "cooldownDays": 10,             // NEW: minimum gap before this script can roll again
  "tribes": ["spring", "swamp"],  // tribes that may send someone; empty = any ALIVE tribe
  "relation": [-39, 100],         // will not come if relation is outside this range
  "waitDays": 2,
  "party": { "size": [1, 2], "gear": "traders" },   // drives the visible appearance
  "truth": [                      // hidden truth: ratio, then lines and clues that go with it
    { "kind": "honest", "w": 5, "tells": [],
      "noise": ["{He} nuốt khan khi nhìn nồi cháo."] },           // NEW: innocent-but-suspicious lines
    { "kind": "scam",   "w": 3, "tells": ["{He} không cho ta chạm vào hạt giống."],
      "look": ["goods_wrapped_tight"] },                         // NEW: deterministic appearance clue
    { "kind": "thief",  "w": 2, "tells": ["Mắt {he} liếc về phía kho."],
      "look": ["party_too_small_for_load"] }
  ],
  "tone": ["polite", "rude"],     // tone is independent of truth
  "start": "n1",
  "nodes": {
    "n1": {
      "say": "Chào các bạn! Tôi mang muối và đá lửa đây, đổi lấy lương thực thì sao?",
      "tellChance": 0.6,          // chance that a VERBAL tell (or noise) line appears; does NOT apply to `look` or `reveals`
      "choices": [
        { "text": "Xem hàng (thử kỹ)",          // "Inspect the goods"
          "then": "n2", "reveals": "tell" },     // NEW: guaranteed clue if the visitor is not honest
        { "text": "Đổi 20 cá khô lấy muối",       // "Trade 20 dried fish for salt"
          "cost": { "food": 20 },                // `cond` stock check is DERIVED from `cost`; no hand-written duplicate
          "by": { "honest": "n_ok", "scam": "n_scam", "thief": "n_theft" } },
        { "text": "Giúp khuân hàng 1 ngày",        // "Help carry goods for a day" (labor payment)
          "cost": { "labor": { "villagers": 2, "days": 1 } },
          "then": "n_labor" },
        { "text": "Đuổi đi", "effects": [{ "rel": -2 }], "end": true }
      ]
    }
  },
  "onAttacked": "n_attacked"      // optional; default handler if absent (section 15)
}
```

### Random wording (`say`)

`say` is a list of beats: a plain line, `{ "any": [options] }` (one option per visitor and beat, drawn from his seed) or `{ "tone": [options] }` (the option at the visitor's own tone: every `tone` beat of a talk picks at the same relative place of its list, so write the friendly option first and the curt one last and the voice stays whole). An option is a line or a list of lines. Same visitor, same words (seed), also after a reload. `peddler` `n1` is the example.

### A talk in turns (flags and `when`)

A choice leads to a node that says something and offers new choices, so a talk goes both ways: the player asks, the visitor answers (the answer node is picked by `by` on his hidden truth: the honest answer plainly, a cheat evades or lets slip a detail, and that is the clue the player reads), the answer node offers a way back to the hub. `effects: [{ "flag": "asked_origin" }]` remembers a thing in the talk; `cond: "flag.asked_origin==0"` hides a question already asked; a `{ "when": "flag.talked==1", "say": [...] }` beat is said only if its condition holds, so the hub greets differently the second time. `newcomers`, `travelers` and `peddler` are the examples. The dialogue screen is built once per visitor: the figure and the frame stay through the whole talk and only the words change.

### What the player says

A choice may carry `say`: the line the player speaks when he takes it. At the next node it is shown first, as his own line (a frame of its own, plate "BẠN", the visitor's figure listens), and then the visitor answers; a choice without `say` says nothing aloud. Questions (`"say": "Các bạn từ đâu tới?"`) and the replies that go back to the hub (`"say": "Tôi hiểu rồi."`) have one, so the talk reads as two sides.

### A talk by mood (all stone-age encounters use it)

The visitor speaks 1-2 lines; the player picks a reply that answers what was said (each carries `effects: [{ "mood": n }]`, hidden from the player); the visitor answers by the mood (`when` beats on `mood`); for 1-3 exchanges (`talk.rounds`, drawn per visitor; `then: "@round"` ends one); then the visitor puts his **terms by the mood** (`talk.final`: words, prices or offers by band, `mood>=2` warm, `mood<=-2` cold) and the player makes the final decision, which has the consequences. If the mood falls to `talk.below` or less after a reply, the visitor **ends the talk himself**: the `talk.walkout` node is said (no choice) and its effects are the consequence (`walkout`/`below` are optional: `thief_caught` has none). Support: `Visitor.mood`, cond key `mood`, `roll.mood`, effect `mood`, effect `if`, `shop.moodPrice`.

| Script | Hub | What the mood changes | Walkout consequence |
|---|---|---|---|
| `newcomers` | `n1` (questions) | Terms: free entry / food gift / feed first | rel -2 |
| `wanderer` | `r2` | Extra relation when warm | refusal (rel -2) |
| `refugees` | `r2` | Warm refugees bring 10 food | refusal (rel -3) |
| `peddler` | `n1` (questions) | Shop prices -/+4% per mood point (max 3) | packs up, no price |
| `travelers` | `n1` (questions) | Extra relation when hosted warm | leave |
| `scout_envoy` | `r2` | Raid power x0.5 / 0.6 / 0.75 after hosting | driven off (rel -5, raid x1.15) |
| `extortion` | `r2` | Tribute 30+30 / 55+50 / 90+80; haggle odds | rel -4, raid |
| `ultimatum` | `r2` | Peace 20 / 25 / 35 food, delay 8 / 10 / 14 | defiance (rel -3) |
| `thief_caught` | `r2` | Chance he relapses after being taken in (30% - 6% per point) | none |
| `ransom` | `r2` | Ransom 70+40 / 100+60 / 150+90 | refusal (rel -6) |
| `pursuers` | `r2` | Bribe 10 / 15 / 25 food; extra relation when handing over | defiance (rel -12, raid) |

The old three-button "manner" step (phrasing, `costBy`, `clam`, `react`) is removed.

### Layout of the replies

What the player says is a small bubble above the visitor's words (`view.you`), shown with them, not a page of its own. The replies are a two-column grid; choices that share a `group` (for example `"group": "Hỏi họ"`) are folded under one button `Hỏi họ (4)` opened by a click, and the number keys count what is on screen.

### Conditions (`cond`, `minDay`, ...)

`stock.<resource>>=N`, `rel.<tribe>`, `deed.<key>>=N`, `deed.<key>==0`, `army>=N` (soldier count, via `readiness`), `power>=X` (compared to the visitor party), `day>=N`, `fireLevel>=N`, `truth==<kind>`.

Deeds can also be queried with a window: `deed.<key>>=N@30d` (count within the last 30 days). Unbounded history is not what scripts usually want.

### Payment types

| Type | Meaning | Status |
|---|---|---|
| Resources (`cost: {food: 20}`) | Pay from `sim.stock`; `cond` derived automatically. | P1 |
| **Labor** (`cost: {labor: {villagers: N, days: D}}`) | N villagers are tied up for D days (production loss, no resource spent). Lets a resource-starved player still act. | P1 (cheapest implementation to be found when reading code; fallback: a temporary production debuff) |
| Information / favor | Give a map reveal, promise a later favor (`schedule`). | P1–P2 |
| Soldiers away (escort, errand) | Soldiers leave the village for N days. | **Needs the expedition system, P4.** |

### Effects (`effects`)

| Effect | What it does (through which function) |
|---|---|
| `give` / `take` | Add / remove resources (`sim.stock`, respecting storage capacity where needed). `take` is clamped to what exists. |
| `rel` | Add / subtract relation with the visitor's tribe or a named tribe, with **diminishing returns** (section 10). |
| `join` / `takeIn` | The visitor (`join`) or the whole party (`takeIn`, remembered as refugees) stays and becomes villagers of ours (`sim.adoptFoe`), when the talk ends. |
| `kidnap` / `steal` | Lose villagers / part of the stockpile (real robbery). See "Recovery paths" below. |
| `spawnRaid` | Turn the visitor party into a real raid on the spot (uses the existing raid function in `tribes.ts`). |
| `eventMod` | Modify an upcoming event from `events.json`: change `size`, `power`, shift its day, or cancel. Stored in `sim.encounters.eventMods` (9.1). |
| `deed` | Write to the consequence ledger. |
| `schedule` | Schedule a script after N days (with `priority`, `ifStill`). |
| `reveal` | Reveal the map around a tribe (uses `fog.ts`). |
| `random` | Branch by probability, computed from the visitor seed. |

Choices with `by` (branch on hidden truth) are the main mechanism for "polite but lying" and "rude but sincere".

### Clue rules (how the player reads people; no Elder yet)

- **Tone** (`tone`) and **truth** (`truth`) are independent.
- **Appearance** (`look`, party size and gear, the gift they bring) is **deterministic and always shown**. It is read from the real party on screen.
- **Verbal tells** (`tells`) show as italic narrator lines with probability `tellChance`. Because chance is below 1, they alone cannot be the guaranteed warning.
- **Noise (verbal and visual).** `noise` lines and `look` oddities must also appear on **honest** visitors (nervous, hungry, goods wrapped against damp, a small party with a light load). All truths draw their clues from **one shared pool** per script, so a single clue only raises the odds; it never proves guilt. Without this, "clue present" equals "guilty" and reading people collapses into a lookup table the player learns in a few visits.
- **Guaranteed clue rule.** Every bad branch must be foreseeable: at least one `look` clue that is more likely under that truth (not exclusive to it), **or** a `reveals: "tell"` choice. The clue `reveals` brings out is drawn by the visitor's seed and weighted by each clue's `p` for his kind (every clue has a chance, so a clue added to a script gets used). `reveals` is **not a perfect detector**: for a bad truth it shows a real tell; for an honest visitor it shows a noise line in about half the cases (`revealNoiseChance`, default 0.5), so "no clue" is not proof of innocence either. Using it should cost something (a relation point or a risk), so it is a decision, not a free scan.
- **"Hỏi kỹ" ("Ask closely")**: once per visitor; costs relation (a small amount) and in return adds a clue. It does **not** cost wait time (time is frozen during dialogue).
- Bad outcomes also need at least one **avoidance path** (clue, haggling, or army preparation). There is no single correct answer.

### Recovery paths (so real harm is not pure frustration)

- `steal`: the thief unit runs toward home for 1–2 days. If the player kills or catches them before they leave the map, the goods drop and `thief_caught` becomes available.
- `kidnap`: maximum 2 villagers per incident, with a clue first. Victim selection: never the village head, never someone in combat, prefer idle villagers, avoid the sole holder of a role if possible. The victim can be recovered by ransom (`ransom` script, P2) or rescue (expedition, P4).

## 7. Dialogue UI

Goal: a scene with atmosphere, not a dialogue box with an avatar. (The mock-up keeps Vietnamese because it is literal game text.)

```
┌─────────────────────────────────────────────────────────────────┐
│   (village scene dimmed, dark vignette)                         │
│                                                                 │
│  ╭─────────╮                                                    │
│  │ Large   │   ┌───────────────────────────────────────────────┐│
│  │ half-   │   │ ▍LÃO TƠM  ·  Suối Nguồn  ·  Thân thiện        ││
│  │ body NPC│   │                                               ││
│  │ rig,    │   │  "Chào các bạn. Hạn hán làm khô suối của chúng││
│  │ breathing│  │   tôi... chúng tôi chỉ xin ít cá khô."        ││
│  ╰─────────╯   │                              ▼ bấm để tiếp    ││
│                └───────────────────────────────────────────────┘│
│  Notes: ✎ {He} liếc về phía kho.   Army: ta 6 · họ 4            │
│        ┌────────────────┐ ┌────────────────┐ ┌─────────────┐    │
│        │ Cho 10 cá khô  │ │ Đổi bằng da thú│ │ Từ chối     │    │
│        │   🐟 −10       │ │   🦌 −6        │ │             │    │
│        └────────────────┘ └────────────────┘ └─────────────┘    │
│                                                    [ Để sau ]   │
└─────────────────────────────────────────────────────────────────┘
```

Detailed requirements:

- **Character**: uses the existing rig (`render/fx/core/actor.js`, `drawActor`) drawn large, half-body, **anchored in the bottom-left corner** (about 35–40% of the screen height, not full-screen); the upper body overlaps the top-left of the dialogue frame, the frame runs to the right of and under the figure. It **slides in** from the left when the dialogue starts. The portrait comes from one swappable function `portraitOf(visitor)` (rig bust now; a painted per-tribe bust can replace it later without touching the UI). Owner's reference mock (2026-11-13) sets the rest of the look: name plate with tribe emblem + relation tag (e.g. Thù địch); notes chips for clues; strength bar "Ta 6 · Họ 9"; buttons Nhật ký (L) and Để sau (Esc); a "time paused" chip in the top bar; choices as numbered cards (keys 1–4) with chips for price, expected effect and unmet reason (e.g. "Thiếu: còn 12 cá khô"). Chips must never leak the visitor's hidden `truth`. Gentle breathing motion. Clothes and skin color follow the tribe's `look` (already in `tribes.json`). How to crop to half-body on a canvas must be tried in P1.
- **Speaker rule for groups.** Several visitors still show **one** portrait: the designated spokesperson. The rest of the party appear as smaller silhouettes behind them.
- **Dialogue frame**: a wide strip running from the character to the right edge, with an era material (stone: hide, clay, scratches), a **name plate** (name, tribe, relation label). No square frame with a small avatar.
- **Text**: types in letter by letter. Click **anywhere** to show the full line; click again for the next line. After a line completes, there is a short input guard (about 250 ms) so one click cannot both finish a line and pick a choice. Keyboard: Space/Enter to advance, number keys 1–9 to choose.
- **Clues** are in italics and a different color, like the narrator.
- **Notes strip.** Clues the player has seen (verbal tells, appearance notes) stay pinned on the choice screen, because the player clicks quickly and a one-shot line is easy to miss. A small **backlog** (re-read the conversation) is available.
- **Choices**: wide buttons in rows with the **price** shown by resource icon. Unavailable choices are dimmed and **state the reason on the button**. A button that depends on strength (e.g. "Intimidate back") shows our power against theirs.
- **"Để sau" ("Later")**: closes the dialogue without choosing. Time resumes, the visitor keeps waiting. Re-opening via the notice or by clicking the visitor.
- **Camera**: when the dialogue opens, put the NPC in the upper half of the screen so the frame does not cover them.
- **Background**: slight dark vignette; village noise lowered.
- **Time freeze** only affects the simulation. UI animations keep running.

## 8. Stone Age scripts

> Removed `healer` and `hunter_master`: there is no concrete mechanic to hook into (reduce research cost, hunt together). Re-add if a "learn from strangers" or shared-hunting system appears.

The "Truth" column says what the visitor really is. "Level" is fire level. All repeatable scripts have `maxTimes` / `cooldownDays` and variants (goods, tone, tribe).

| ID | Level | Visitor | Truth | Main choices and consequences |
|---|---|---|---|---|
| `wanderer` | 1 | Hungry traveler (**fixed first script**, ~day 5) | First time always honest (teaches the mechanic). Later 30% are scouts | Feed: relation up; 10 days later returns with a gift or directions (`reveal`). Invite to stay: +1 villager, costs food. Send away: relation drops slightly. |
| `refugees` | 1–2 | 2–3 refugees | Honest. 35% have pursuers following (chains into `pursuers` via `queue`, `linkedTo` the refugees) | Take all: more villagers, costs food. Take half. Refuse: relation drops. |
| `pursuers` | 1–2 | Pursuing party, chained from `refugees` | Honest | Hand over the refugees: lose the villagers just received, gain relation. Refuse: that party raids for real. Pay resources: they withdraw. If the refugees are dead or were never taken in, this entry is cancelled (`ifStill`). |
| `peddler` | 1–3 | Traveling merchant (salt, flint, seeds) | Honest / **scam** (fake goods) / **thief** (steals 10–20% of one resource) | Inspect carefully (guaranteed clue), haggle, buy directly, or **pay by labor** (help carry goods). Scammed → `scammed`, lose payment. Theft → `thief_escaped`, with a chase window (see Recovery paths). |
| `extortion` | 2 | Tribute-demander (warlike tribes: Rìu Đá, Hang Gấu) | Honest. If refused, they **will attack** | Pay: quiet for N days, but the next demand rises (read from `deed:paid`). Haggle for half. **Intimidate back** (success depends on our `power` vs. their party, shown on the button). Refuse: early raid. |
| `scout_envoy` | 1 (replaces `axe_scout` on day 11) | Axe tribe scouting party | Honest. The result decides the size of the day-15 raid via `eventMod` | Entertain: day-15 raid weaker. Show force (if strong): delay or cancel; if weak: raid **stronger**. Send away / attack: see how their report spreads. If this script cannot spawn by day 11, fall back to the old `axe_scout` logic; "ignored" must equal the default day-15 raid. |
| `thief_caught` | 2 | Thief caught (after `peddler`, real theft, or a successful chase) | Honest | Punish: his tribe's relation drops. Pardon: reputation. Accept as villager: 30% repeat offense. |
| `ransom` | 2–3 | Kidnapper tribe offers to return a taken villager | Honest | Pay ransom: villager returns. Refuse: villager stays lost (rescue becomes an expedition target in P4). |
| `envoy_alliance` | 2–3 | Envoy from a friendly tribe asking for an alliance against a common enemy | Honest. Tone may be arrogant | Accept: relation up, allied troops help when the enemy raids, but relation with the enemy drops. |
| `feud_plea` | 3 | Two feuding tribes (`meet.feuds`) both ask for help | May lie to both | Pick a side, stay neutral, or play both ends (40% exposed → both become hostile; computed from seed). |
| `spy_guest` | 3 | Guest asking for shelter | A spy: learns weak points and reports back; a later raid hits **exactly the weak spot** | Let them stay, detain, or send away. |
| `boss_fall` | 3 | Dialogue when the lead tribe collapses (era change) | – | Story; chains into `era-bronze`. |

Every script has **at least one** genuinely bad branch and **at least one** branch that can avoid it (clue, haggling, or army preparation). There is no single correct answer.

## 9. Links to existing systems

### 9.1 Raid events (`events.json`)

The day-11 scout is replaced by `scout_envoy`. Large raids (days 15, 17, 24, 27, 33) may produce an **ultimatum envoy** when the warning (`warn`) fires, with probability depending on relation. Results go through `eventMod`, never editing `tribes.ts` directly. Wild beasts (wolves, bears) have no dialogue.

`eventMod` rules:
- Modifications live in saved state (`sim.encounters.eventMods`), **not** by mutating the loaded JSON, so reload is stable.
- Stacking: multipliers combine and are clamped (e.g. size ×0.5 to ×2); `sources` records which encounter did what.
- Cancelling an event whose `warn` already fired shows a follow-up notice ("the raiders turned back").
- The "ignored" outcome is the unmodified default, so ignoring a visitor is neither a hidden penalty nor a hidden reward unless a script says so.

### 9.2 Tribe relations (`tribes.ts`)

Use existing functions. The `rel` effect adds to `t.relation` at the existing thresholds (`tributeAt`, `joinAt`, `friendlyFrom`). Need one public function such as `sim.tribeRelationAdd(id, n)` (today only internal functions like `giftTribe` exist in `tribes.ts`). Gains go through diminishing returns (section 10).

### 9.3 Market (`market.ts`)

`marketRoll` gets `sim.market.from`: today's merchant tribe, chosen from tribes that are **not hostile**, preferring higher relation. Relation adjusts price and quota. UI says "Thương nhân Suối Nguồn đến chợ" (a merchant from Suối Nguồn comes to market) instead of "Chợ có món hời". If every tribe is hostile, there is still a **stranger trader** with poor prices so the market does not die entirely. This touches balance, so P3 only.

### 9.4 Gifts (`giftTribe`)

A gift function exists. The dialogue's "Give a gift" button **reuses** `giftTribe` rather than a new function. Proposed: **keep** the gift button in the tribe menu too (player orders are supreme), both calling the same function with the same diminishing returns. Confirm in P2.

### 9.5 Bandits and `tribefrontier`

Bandit parties can open a dialogue demanding protection money (`bandit_parley`). P5.

## 10. Visit cadence and balance (`encounters.json`)

```jsonc
{
  "first":  { "script": "wanderer", "day": 5 },
  "gapDays": { "1": [3, 5], "2": [3, 4], "3": [2, 4] },   // by fire level
  "hours":  [6, 15],             // visitors arrive in daylight only
  "maxVisitors": 1,
  "blockNearEvent": 1,           // random rolls do not fire within 1 day of an event (queue/fixed scripts ignore this)
  "pauseInWar": true,            // no random visitors during war
  "waitDays": { "default": 2, "extortion": 1, "refugees": 3 },
  "repeat": {
    "noSameTwice": true,         // never the same script twice in a row
    "weightDecayPerSeen": 0.5    // weight × 0.5 each time already seen
  },
  "relationGain": {
    "diminish": true,            // gain = base / (1 + count of the same hospitality deed with that tribe in the last 30 days)
    "capPerTribePer10Days": 15
  }
}
```

These numbers are starting points; tune after playtesting.

**Variants by data, not by new trees.** The cheapest way to cover ~20 visits is one dialogue tree with variant slots (tribe voice, tone, truth, goods, party size), not more trees.

**Content volume check.** At these cadences Stone Age produces about 20 visits. With ~10 scripts, several one-offs (`scout_envoy`, `boss_fall`, `pursuers`), `peddler` and `wanderer` would repeat quickly. The repeat policy, `maxTimes`, `cooldownDays` and script variants are not optional polish; build them in P1. Expect to write more scripts or more variants than the current table.

**Exploit guards.**
- Hospitality is not an infinite relation farm (diminishing gain plus per-tribe cap), including gifts from the tribe menu.
- Resources that come from visitors are a source outside the market; sanity-check against the economy. Running `npm run economy` happens **only when you ask**.

## 11. Possible conflicts with existing code (check while building)

| # | Where | Problem |
|---|---|---|
| 1 | `events.json`, `tribes.ts`, `readiness.ts` | Need `eventMod` to change a raid **before it fires**. Today `tribes.ts` reads `eventsJson` directly. Add a place that accepts modifications (reading from `sim.encounters.eventMods`) without breaking `raidAdvised` / `launchRaid`. |
| 2 | `tribes.ts` (relation) | No public relation function for UI or other systems. Add one. |
| 3 | `market.ts` | `marketRoll` changes source, affecting quota and price. Do this in P3; run `npm run economy` **only when you request it**. |
| 4 | `sim.ts` (step) | Add "freeze while a dialogue is open" and "drop to speed 1 when a visitor arrives". Careful with the day loop; `sim.speed` is a player option, so it is not overwritten permanently. Also confirm that any timers (e.g. `angryUntil`, 120 s) are in sim time, not wall-clock, or they will keep running during a freeze. |
| 5 | `save.ts` | New `encounters` field in `SAVED`; `SAVE_VERSION` 39 → 40, add `MIGRATIONS[39]`. Load-time validation of scripts/nodes (section 5). |
| 6 | `notices.ts`, `model.ts` | Notices have no coordinates for the camera. Add `focus` and a `meet` command. This is a data-type change. |
| 7 | `controller.ts` | No function to move the camera to an arbitrary coordinate. Add one. |
| 8 | Visitor units | A visitor is a unit of an NPC tribe. Read `foecivil.ts` and `tribework.ts` to see how other tribe villagers are created and driven near our village, so the visitor can walk to the meeting point and wait without being treated as an enemy. |
| 9 | Meeting point | `gate` is only a player-built structure and may not exist. Use the gate if present, otherwise the edge of vision. |
| 10 | Medieval-only war features | Stone Age dialogue must not mention logistics, field camps, or war research. |
| 11 | `meet` rule | Warlike tribe, relation below 20, meeting in sight means they fight. A visitor must carry a `guest` flag so neither our troops nor theirs attack while it waits at the gate. See section 15. |
| 12 | **Auto-targeting systems (new)** | The `guest` flag must be respected by **every** system that picks targets on its own: friendly soldiers, other tribes' units, towers/turrets, traps, dogs/pets. Wild animals ignore guests (P1 default). A direct player order on a guest still works. |
| 13 | **Leader units (new)** | Visitor parties must never include the tribe leader entity (`leaderDead` side effect in `killFoe`). |
| 14 | **Villager roles (new)** | `kidnap` victim selection needs to read villager role/combat state so it follows the rule in section 6 (never the head, never in combat, prefer idle). |
| 15 | **Locking villagers for labor (new)** | The "labor" payment needs a cheap way to mark N villagers busy for D days (or a temporary production debuff). Find the least invasive option when reading villager code. |

Rows 8, 9, 11, 12, 14 and 15 are **unchecked**; code is read at the start of P1.

## 12. Direction for Medieval (not built)

| Level | Name | Planned content |
|---|---|---|
| M1 | Open doors | Trade caravans with routes, escorts, mercenaries, ceremonial envoys |
| M2 | Treaties | Ceasefire, trade pacts, alliances with terms, marriage ties, vassals paying tribute on a schedule |
| M3 | Schemes | Spies, interrogation, false flags, traitors, prisoners and ransom |
| M4 | Hegemony | Multi-tribe coalitions against us, ultimatums, large-scale tax and tribute |

The dialogue engine stays the same. Medieval only adds a `medieval.json` script file, new UI materials (parchment, wax), and the Village Elder role as a "people reader" if wanted.

## 13. Build steps (each step is playable on its own)

**Status (2026-11-13): P1a is built** (typecheck and build clean, not yet played in the game): `encounters.ts`, `encounterdata.ts`, `ui/dialogue.ts`, `styles/_dialogue.scss`, data `encounters.json` + `encounters/stone.json` (script `wanderer`), `SAVE_VERSION` 40, freeze, notice `meet`, camera `focusTile`, `ai.guest` skipped by `threatsOf` and the tribe brain. Added after the first playtest: scene tick (view-only simulation) instead of a full freeze, camera fly in/out, "!" marker over a waiting guest and click-to-receive. Not in P1a yet: the backlog (L), the strength bar, notes strip, towers/traps ignoring guests, attack handling (section 15).

| Step | Content | Done when |
|---|---|---|
| **P1a** | Skeleton end to end: saved state + `SAVED` + `SAVE_VERSION` 40, freeze while a dialogue is open, visitor spawn and walk to the meeting point, notice with **Receive** + camera move, full dialogue UI (section 7: slide-in half-body rig, name plate, typewriter, click to advance, choices with prices, **Later**), name generation, effects `give`/`take`/`rel`/`villagers`/`deed`, script `wanderer` | Play from day 1; on day 5 a traveler arrives; press Receive, talk, choose; reload mid-dialogue and after keeps progress. `typecheck` and `build` clean. |
| **P1b** (built 2026-11-13, see the note under the table) | `deeds` windows, scheduling/priority queue, outcome seed (`random`/`by`), `guest` flag and basic attack handling (section 15), repeat policy and variants, clue pool + notes strip, labor payment, scripts `refugees`, `pursuers`, `peddler`, full cadence (section 10) | Chained visitors work; reload does not re-roll outcomes; attacking a guest follows section 15. |
| **P2** | Link `events.json` through `eventMod` (saved), `scout_envoy`, `extortion`, ultimatum, `thief_caught`, `ransom`, truth-based attack rule (section 15 option C) | The day-15 raid changes according to the day-11 choice. There is a way to buy peace. |
| **P3** | Market with tribe source, requests/contracts board | Market states where the merchant is from. Idle troops can earn resources. |
| **P4** | Expeditions (party, destination, arrival dialogue, real risk), soldier escort payments, villager rescue | Breaks the wait for research. |
| **P5** | Stone 3: `envoy_alliance`, `feud_plea`, `spy_guest`, `boss_fall`, `bandit_parley` | Highest Stone Age level has political dialogue. |

**P1b as built (differences from the sections above):** clues are one pool per script, `clues: [{text, p: {honest, scam, thief}}]`, each shown with its own chance for the visitor's truth (replaces the separate `tells` / `noise` / `look`); the pool is drawn once at spawn from the seed and stored in `visitor.notes`; "ask closely" (`reveals`) adds the most telling unseen clue (an honest visitor gets a harmless one half of the time, `revealNoiseChance`). `by` and `roll` use `seedRoll(seed, node:choice)`. A node may carry `effects` (run on entry). Deeds are one entry each (window conditions `deed.key>=1@30d`). Queue: `schedule` effect, priority, `ifStill`, `maxDelay`; weight-0 scripts (`pursuers`) come only from the queue. Repeat policy and relation diminishing (`relationGain`) are in `encounters.json`. A guest killed by the player: deeds `attacked_guest` + `broke_guest_right`, linked queue entries cancelled, next visit put off (`slainDelayDays`); traps and `threatsOf` ignore guests. Dev menu has "Khách ghé làng" buttons (`dev.summonVisitor`). **Guards (added after playtest):** once a stranger is SEEN (standing on ground the village sees, fog state 2: nobody sends guards for people they cannot know of; the player-facing word is "người lạ", not "khách"), the 2 free guards of the Trại lính gác nearest the gate (the campfire when there is no gate; a guard standing at his post counts as free) (`v.guard`: out of camp, awake, not fighting, no player order; ordinary soldiers are left alone) are sent out; if nobody is free it tries again every second until the visitors reach the meeting point with `sim.orderMove` (their post becomes the meeting spot, so the existing post logic keeps them there); when one is within `guards.contact` tiles the visitors stop where they stand and only then the notice, toast and "!" appear ("Lính gác chặn … trước cổng"). With no free guard the notice comes when the visitors reach the meeting point. When the visit ends the guards are sent back to their own posts, unless the player gave them another word meanwhile (their post no longer matches). **Parties (added after playtest):** a script may set `party: {size, weapons, armor, hurt}`; the visitor speaks for the party, the others are guest units too (`ai.guest`) that follow to spots around the meeting point and leave with the visitor. Refugees: 3 people, wounded (`hurt` 0.5); pursuers: 3–4 soldiers with spear/club and armour. `takeIn` (whole party stays, remembered as refugees) and `join` (the visitor stays) now run when the talk ENDS, so the answer is heard first; "Để sau" on an answer node ends the talk. Killing any member counts as killing a guest (deeds, the rest flee). **Attack on a party is no war:** `warskirmish.foeVillage` ignores guests, so an order against them starts no skirmish (that would freeze the whole village and end in a "Thua trận" toast when only the sent soldiers die). **Attack on a party:** the first blow (`tribes.tribeAttacked` -> `encounters.guestAttacked`) writes the deeds once (`attacked_guest`, `broke_guest_right`), cancels what the visit set going, puts the next visit off and closes any dialogue; the armed members become a raid of their village on the spot (`tribes.guestsToRaid`), the unarmed ones walk home. Rule: armed fight, unarmed flee - unless our soldiers within `provoke.radius` tiles are worth at least `provoke.fleeRatio` times the armed strangers (`power.militaryValue`): then all of them run. Guards go back to their posts by the brain's own return, not by an order that ignores a fight. **Not built:** labor payment, tone, the strength bar, backlog (L), relation diminishing for the tribe-menu gift button.

**P2 as built (2026-11-13):** effect `eventMod {powerMul, shiftDays, cancel}` edits the raid the visit is about (queue item / visitor `event`), else the next unfired raid of the visitor's village, directly in `sim.events` (already saved; no separate store). Choice `branch: [{cond, then}]` picks a node by a condition (`soldiers>=5`). Scripts: `scout_envoy` (fixed on day 11 from `encounters.json` `fixed`, replaces the `axe_scout` event, removed from `events.json`; saves already in progress keep the old event), `extortion` (axe/cave, from day 16, demand grows with `deed.paid_tribute`, paying delays that village's next raid, bluffing needs soldiers, refusing or a failed bluff sends a raid of 4), `ultimatum` (when a raid is foretold, `ultimatum.chance` 0.6 that its village sends an envoy first: pay 25 to call it off, 10 to delay 3 days). **P2 completed (same day), revised after playtest:** `extortion` asks for shells and food (30+30, 55+50, 90+80 by `deed.paid_tribute`; half on a won haggle). **Harm is done outside the talk and silently.** A truth may carry an `act` (`encounterdata.Act`): when the party stops at the gate, `who` (1-2) of the party are picked (`makeAgents`); `after` seconds later (own clock `aclock`, so it also runs while a dialogue is open and the game clock is frozen: `Sim.sceneTick` calls `tickAgents`) each slips away into the village: a thief walks to the nearest `storage` (else the fire) and takes 1-2 random kinds of goods the village really has plus shells (`take`), a kidnapper goes for the most skilled villager out of doors (never the head, a soldier, scout or supply man; one of the best three by seed) and takes hold of him (if there is none, he steals food). **Stores and villagers are touched only when he actually has them in his hands**; then he runs home. No toast, no mark, no log line: the player must notice. Sending the party away before they begin cancels it. Nothing the talk says depends on the truth (`host` = let the party in: they sit about the fire for `visit.restSeconds`; `Quan sát kỹ` is the only place clues show: the notes strip is empty at the start). Soldiers never go for strangers on their own: the player orders them (a dialogue must be closed with Esc first). A blow on one who runs with what he took makes him give up: goods back / captive free, and he waits to be judged as a separate visit (`thief_caught`: punish, pardon, take in with a 30% relapse). A captive not recovered: `ransom` comes 3 days later (100 shells + 60 food, or he stays lost). **Truth-based attack rule:** a blow (or kill) on a visitor whose truth is not `honest` (cheat, thief, kidnapper, and `hostile` envoys) writes no `broke_guest_right`, puts nothing off, and gives back `justifiedRefund` relation; on an honest one it costs as before. **Not built:** a rescue by expedition for captives that were not caught (P4).

**Gate guards, daily strangers, merchant (2026-11-13):** (1) A gate holds `gates.json` `guards` (2) guards of the Trại lính gác (`v.gate`, panel tab "Lính gác cổng", list = guards only; they stand just inside it). With a guard, the gate opens by day, shuts at night once every villager is in, shuts while the village is attacked once all are in and opens when the enemy is gone (`defense.tickGates`); the player's own open/shut holds `manualHoldDays` (`Building.autoHold`). Only soldiers (`job fight`) pass a shut gate; villagers do not (`movement.passOf`); new gates start open. No notice for villagers outside. The two guards sent to stop strangers are the guards of the gate the strangers come to (`Visitor.gate`); no gate, or no guard at it, means nobody goes out. (2) The daily 2-4 newcomers no longer settle by the fire: `environment.newcomers` calls `encounters.dailyArrival`, which queues the script `newcomers` (priority 6, waits 1 day; ignored = they leave): choices take the whole party (as many as `room`), one, or none; the ones who came to do harm are thieves only (kidnapping stays with the travelers), rare while the village is poor (weight 0.1 of 1 against 6 honest at 100 shells of wealth or less) and rising to 1.2 at 700 shells or more (`WealthScale`, wealth = stores at the Chợ's barter rates + shells); they are never taken in, they slip away as before. `start.json` `arrivals` keeps `firstDay` and `femaleChance` only. (3) The merchant (`peddler`) sells for shells only: the script's `shop` lists goods by era (stone or ancient/medieval): gear (weapons, armour, tools; the better the dearer) and lots of resources; 3 shown by the seed, and with 25% a fourth, a bargain at half price that is a fake 15% of the time even from an honest merchant (a cheat's goods are all fakes); a lot of goods costs its Chợ barter value plus 10%. A node with `shop: true` makes the choices; what was bought is no longer shown; an honest merchant puts gear in `sim.toolStock` and lots in the stores, a cheat takes the money and gives nothing, and there is nothing to recover.

After each step: `npm run typecheck`, `npm run build`, update `architecture_documentation.md` (add rows for `encounters` and `encounterdata`) and re-read this doc. Do not run tests, take screenshots, or run `npm run viewer`.

## 14. To confirm while building

Proposed answers are in bold; confirm or change them.

1. Replace `axe_scout` (day 11) with dialogue, or keep both? **Replace, but keep the old logic as a fallback if the visitor cannot spawn; the default raid equals the "ignored" outcome.**
2. Merge the "Give a gift" button into dialogue (9.4)? **Keep the tribe-menu button as well; both call the same function with diminishing returns.**
3. Scale of "real robbery": maximum villagers lost per incident? **Max 2, with a clue first; never the head or someone in combat; plus a recovery path (ransom now, rescue in P4).**
4. Wild animals vs. waiting guests: ignore guests, or visitor leaves when beasts are nearby? **Ignore guests in P1.**

## 15. Open issue: the player attacks a visitor (PROPOSED, awaiting owner)

The owner has not chosen yet. This section records the problem, what the code already does, the options, and the current proposal.

**Fixed rule:** player orders are absolute (CLAUDE.md). Attacking a visitor must never be refused. At most a toast, never a block.

**What the code already does** (`tribes.ts`, no new code needed for these):
- `tribeAttacked`: the first hit makes the tribe angry for 120 s (`angryUntil`) and costs relation (`attackedPeaceful` -30 for a peaceful tribe, -10 otherwise).
- `killFoe` by the player: relation -10 per warrior, -25 per civilian; killing the leader sets `leaderDead`.
- A tribe unit that is hostile for these reasons is fought on sight; this is the same `meet` rule as in section 11, row 11.

**What is missing for a guest:**
1. Who is a "guest": a visitor must carry a `guest` flag (set on arrival, cleared when they leave) so auto-aggro does not fire, but a direct player order on them still works. All auto-targeting systems must respect it (section 11, row 12).
2. When the player can attack: while waiting at the gate (before the talk) and after the talk ends and before they leave. During dialogue, time is frozen, so only dialogue choices exist.
3. What the visitor's party does: fight back, flee home, or both.
4. What the tribe does afterwards: only the relation loss above, or a retaliation.
5. Whether the visitor's `truth` matters for the penalty.

**Options (pick per point):**

| Point | Option A (simple) | Option B | Option C |
|---|---|---|---|
| Penalty | Only the existing relation loss | Extra loss for breaking hospitality (new deed `broke_guest_right`, which also lowers the chance and tone of later visitors from all tribes) | Depends on `truth`: no extra penalty if the guest was a thief, spy or raider; full penalty if honest |
| Party reaction | Party turns into a raid on the spot (`spawnRaid`) | Survivors flee home, the tribe is angry, no raid | Weak parties flee, strong parties fight |
| Retaliation | None | A scheduled raid in 2–5 days, sized by the party that escaped | A scheduled `ultimatum` dialogue instead of a raid |
| Loot | Nothing drops | The visitor's goods drop (e.g. the peddler's wares) | Only for bandits |
| Confirm | None | Toast with the expected cost before the order is carried out (not a refusal) | None |

**Current proposal (not a decision):**
- **Penalty:** A plus the `broke_guest_right` deed already in **P1** (`deeds` exist from P1, so there is no reason to wait for P2). Add the `truth`-based rule (C) in P2.
- **Party reaction:** **C** (weak flee, strong fight). Option A is wrong for a lone traveler. "Weak" and "strong" use the same `power` comparison as the "Intimidate back" button, so both places agree.
- **Retaliation:** only when someone **escaped** (a witness), per B. If nobody survives, no scheduled retaliation (the existing relation loss still applies regardless of witnesses, because that is how `killFoe` works today).
- **Loot:** only for bandits or guilty guests; can wait.
- **Confirm toast:** if used, it **must not depend on `truth`**. A toast saying "no extra penalty" would reveal that the guest was a thief.
- **Queue cleanup:** attacking a visitor cancels `queue` entries with `linkedTo` that visitor (e.g. `pursuers`), unless the script's `onAttacked` replaces them.

**Implementation notes for later:** add an optional `onAttacked` node per script (default handler if absent); attacking closes the dialogue, removes the visitor from `visitors`, writes deed `attacked_guest` (plus `broke_guest_right` per the proposal); retaliation uses `queue`/`schedule` from section 5.
