# Haikyū: Gauntlet RPG v2 — Character Builder · Project Plan

_Status: awaiting final go-ahead + GitHub deploy inputs. Last updated 2026-06-12._

A web UI for creating (and progressing) characters in the Haikyū: Gauntlet RPG v2 system,
hosted on GitHub Pages from a public repo.

---

## 1. Locked decisions (from interview)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Tech stack | **React + Vite + Tailwind**, built to `/dist`, deployed to GitHub Pages via a GitHub Action |
| 2 | Flow | **Stepped wizard** (Physical → Skills → Year/Experience → Abilities → Review/Export) with a **persistent live character-sheet panel** |
| 3 | Roll mechanic | **Roll a pool → drag/click-assign** chips into slots (Physical: 2 values; Skills: 10 values); manual entry into the pool allowed |
| 4 | Dice roller | Every random occurrence shows **individual dice faces + computed total/avg + roll animation**, with a **manual-entry box always visible** beside it |
| 5 | Distributions | **Exact probability curves** (3d10 convolution; reach equations propagated) with the character's **marker + percentile readout** |
| 6 | Viz scope | Charts on **Physical Attributes + the 3 reaches only**. Skill stats show numeric value (no chart) |
| 7 | Prereq engine | **Full live engine** — effective stats = base + purchased ability modifiers; prereqs validate against effective stats; modifiers feed charts; cascade-guard on removal |
| 8 | Scope | **Full lifecycle** — create a character, then **level-up to the next school year** |
| 9 | Roster | **Single active character** at a time (export to keep older ones) |
| 10 | Persistence | **localStorage autosave + JSON export/import** |
| 11 | Sheet output | **Print-friendly view + PDF export + Discord code-block export** (copy-to-clipboard) |
| 12 | Aesthetic | **Volleyball-court sporty** — warm orange + charcoal/black, athletic type, subtle court-line motifs; original art only |
| 13 | Abilities data | **Editable data file** (single source of truth) + **DATA_NOTES.md** documenting every interpretation of the WIP source |
| 14 | Responsiveness | **Fully responsive / mobile-friendly** (touch dice, tap-to-assign fallback for drag) |
| 15 | Deploy | **You create the empty public repo + provide a short-lived fine-grained PAT; I push.** Token never saved to memory |

---

## 2. System model (parsed from the rules doc)

**Physical Attributes** — roll `3d10` twice → two totals (range 3–30). Assign one to Height, one to
Vertical Jump. Convert via the Physical Attributes Table:
- Height(cm) = `150 + 2 × roll`  (roll 3 → 154 … roll 30 → 208)
- Vertical(cm) = `45 + 3 × roll` (roll 3 → 48 … roll 30 → 129)

**Derived reaches** (cm):
- Standing Reach = `1.3 × Height`
- Spiking Reach  = `1.3 × Height + Vertical`
- Blocking Reach = `1.3 × Height + 0.85 × Vertical`  (Swing Block ability overrides the `0.85` to `0.9`)

**Skill Stats** (10): Spike, Serve, Pass, Dig, Set, Block, Speed, Power, IQ, Stamina.
Each = average of `4d4` → range 1.00–4.00 in 0.25 steps. Roll all ten into a pool, then assign.

**Ability Points (AP)** — base **10**, plus:
- School Year (`1d3`): 1st = +0 · 2nd = +(3+2d4) · 3rd = +(6+4d4)
- Previous Experience (`2d8`): 2–3 +0 · 4–7 +1 · 8–11 +2 · 12–15 +3 · 16 +4
- Level-up (subsequent years): AP gain = `3 + 2 × (# teams played)`; also Height += `1d20 × 0.1 cm`

**Abilities** — ~40 entries. Properties: cost, prereq(s), optional tier ladder (cumulative additional
cost to reach a tier), optional max-times `(N)`, and effects (some modify stats/derived values).
Prereq types observed: stat threshold (`Spike 3.25+`), compound AND, OR (`Pass 2.75+ or Set 2.25+`),
inverse (`No Stat 3.75+`), derived-stat (`Standing Reach 250cm+`), ability-tier (`Double Jump 3`),
and meta (`Select on Character Creation`, `Yearly Only`, `Not a First Year`, `Third Year`).

---

## 3. Data model & ability schema

Single source-of-truth data module (`src/data/abilities.ts`) — schema (illustrative):

```ts
type Ability = {
  id: string;
  name: string;
  baseCost: number;                 // AP
  maxTimes?: number;                // from "(N)"
  prereqs: Prereq[];                // ALL must pass (AND); OR encoded as one Prereq node
  tiers?: { label: string; addCost: number }[];  // cumulative when summed up to chosen tier
  effects?: Effect[];               // stat/derived modifiers, choosers
  meta?: ("creationOnly" | "yearlyOnly" | "notFirstYear" | "thirdYear")[];
  notes?: string;                   // surfaced in DATA_NOTES
};

type Prereq =
  | { kind: "stat"; stat: SkillStat; min: number }
  | { kind: "statAny"; min: number }
  | { kind: "noStatAtLeast"; min: number }        // inverse (Quick Learner)
  | { kind: "derived"; metric: "standingReach"|"spikingReach"|"blockingReach"; min: number }
  | { kind: "ability"; id: string; minTier?: number }
  | { kind: "meta"; flag: "notFirstYear"|"thirdYear"|"creationOnly"|"yearlyOnly" }
  | { kind: "or"; any: Prereq[] };

type Effect =
  | { kind: "statDelta"; stat?: SkillStat; choose?: "any"|"twoSkills"|["Dig","Block"]; delta: number }
  | { kind: "heightDelta"; cm: number }
  | { kind: "spikingReachDelta"; cm: number }
  | { kind: "overrideBlockingCoef"; value: number };  // Swing Block
```

The engine recomputes **effective stats** and **derived reaches** from base + active ability effects
on every change, then re-evaluates every ability's prereqs and AP affordability.

---

## 4. Screen-by-screen UX

0. **Start** — name the character; New / Import JSON.
1. **Physical Attributes** — two `3d10` rollers (each shows 3 dice + total) feeding a 2-chip pool;
   assign to Height / Vertical. Live **Physical distribution chart** (bell curve + marker + percentile).
2. **Reaches** — auto-computed from Height/Vertical; **three reach distribution charts**
   (Standing, Spiking, Blocking) each with marker + percentile. Updates live if later abilities change Height/reach.
3. **Skill Stats** — ten `4d4` rollers into a 10-chip pool; assign across the ten skills. Numeric values, no charts.
4. **Year & Experience** — `1d3` school year + `2d8` experience rollers → computes total **AP budget**.
5. **Abilities** — responsive grid of ability cards. Each card shows cost, prereqs, tier ladder.
   - Unaffordable / unmet-prereq abilities are visibly disabled; **failing prereqs highlighted red**.
   - Live **AP meter** (spent / remaining); selection is blocked from exceeding budget (**no AP debt**).
   - Tier selector per tiered ability (cumulative cost). Choosers appear for "any Stat" / two-skill / Dig-or-Block effects.
   - Removing an ability that another depends on triggers a **cascade warning**.
6. **Review / Export** — full sheet; **Print / PDF / Discord-copy** outputs; JSON export.
7. **Level-up** (post-creation action) — prompts # teams played → adds AP, rolls `1d20×0.1cm` height growth,
   unlocks yearly-only abilities, reopens ability spending; recomputes everything.

**Discord export format** — wrapped in a triple-backtick code block: Name, Year, Height, the three Reaches,
all ten Stats, then each selected ability with its tier/level.

---

## 5. Distribution maths

- Height/Vertical roll = sum of `3d10`; exact pmf via convolution (small, computed once).
- Reach pmf = push each roll's pmf through the reach equation (treat Height-roll and Vertical-roll as
  independent `3d10`; population baseline). Percentile = CDF at the character's value.
- Rendered as lightweight hand-rolled **SVG** area/bars + marker line (no heavy chart dependency).

---

## 6. Repo & deployment

```
/  (public repo, MIT licence)
├─ src/ … React app (components, data/abilities.ts, engine/, charts/)
├─ public/
├─ .github/workflows/deploy.yml   # build + deploy to GitHub Pages
├─ DATA_NOTES.md                  # every WIP-source interpretation
├─ README.md                      # play/dev/edit-abilities guide
└─ vite.config.ts                 # base path set to the repo name
```

Deploy path: you create an **empty public repo** (no README) → tell me **username + repo name** →
provide a **short-lived fine-grained PAT** (Contents + Pages: write) → I push and the Action publishes Pages →
you **revoke the token**. Pages URL will be `https://<username>.github.io/<repo>/`.

---

## 7. Build orchestration (model tiers)

**Sonnet** is the primary driver across the milestones below. **Opus** is escalated to only on a true
blocker (a genuine architectural ambiguity or a failure Sonnet can't resolve after a real attempt).
Work fails forward: unblocked tasks continue while any blocker is parked for you.

Milestones:
1. Scaffold (Vite + React + Tailwind + Pages workflow), theme tokens, app shell + wizard nav + live sheet.
2. Dice roller component + roll/assign pool mechanic; Physical step + distribution chart.
3. Reaches step + three reach charts; Skills step.
4. Year/Experience + AP budget; persistence (autosave + JSON import/export).
5. Abilities data module + DATA_NOTES; the live prereq/AP engine; abilities grid with validation.
6. Level-up flow; Review screen + Print/PDF/Discord exports.
7. Verification pass (engine unit tests for prereqs/AP/tiers, build + a Chrome smoke test of the live Pages site), then deploy.

---

## 8. Open inputs needed from you (only blockers)

1. **GitHub username**
2. **Repo name** (suggestion: `haikyu-gauntlet-builder`)
3. **Short-lived fine-grained PAT** when we reach the deploy milestone

Everything else proceeds without you.
```
