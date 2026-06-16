# DATA_NOTES — Ability & Rule Interpretations

_Interpretations and design decisions for `src/data/abilities.ts` are logged here.
Every ambiguity in the WIP source document gets an entry. Milestone 2+ will populate this file._

---

## Format

Each entry:

```
### <Ability Name> (id: `<ability-id>`)
**Source text:** …exact quote from the rules document…
**Interpretation:** …what was decided and why…
**Date logged:** YYYY-MM-DD
```

---

## Pending (M2+)

Interpretations to be logged when `src/data/abilities.ts` is authored in Milestone 5.

---

## Milestone 2 — Abilities Data Module (`src/data/abilities.ts`)

_Date logged: 2026-06-12_

All 40 abilities from the "Abilities (WIP)" 2-column table in `Haikyu_ Gauntlet RPG v.2.md` are encoded.

---

### Training (id: `training`)
**Source text:** "Cost: 5 AP. Prereq: N/A. You train hard each practice and even on your time off. Add +0.25 to any Stat."
**Interpretation:** No `maxTimes` is listed. Encoded with no `maxTimes` field (undefined = unlimited). +0.25 to any Stat encoded as `{kind:'statDelta', choose:'any', delta:0.25}`.
**Date logged:** 2026-06-12

---

### Quick Learner (id: `quick-learner`)
**Source text:** "Cost: 3 AP. Prereq: No Stat 3.75 or higher (5). Add +0.25 to any Stat."
**Interpretation (superseded 2026-06-16):** Originally read as a *global inverse* constraint — the character must have **no** skill at 3.75+ to take it at all — encoded as `{kind:'noStatAtLeast', min:3.75}`. `(5)` means maxTimes 5; +0.25 to any Stat is `{kind:'statDelta', choose:'any', delta:0.25}`.
**Date logged:** 2026-06-12

### Quick Learner (id: `quick-learner`) — per-target gate, base-skill basis
**Source text:** Same as above; the "less than good skills" flavour clarifies intent.
**Interpretation:** The "No Stat 3.75+" rule is reinterpreted as a **per-target** acquisition gate rather than a global one. You may add Quick Learner (up to 5×) and direct its +0.25 to **any skill whose BASE value is below 3.75**, even if other skills are already 3.75+. Encoded as a new prereq `{kind:'anyStatBelow', max:3.75}` (eligible while at least one base skill is below the gate); the chooser UI locks targets whose base skill is ≥ 3.75. All thresholds use **base** (assigned) skills, not effective stats, so a Quick Learner's own +0.25 (or another ability's bonus) never trips its own gate — this also keeps the existing "effective stats may exceed 4.00 via bonuses; do not clamp" rule intact. The validation sweep treats `anyStatBelow`/`noStatAtLeast` as acquisition-only gates (they never auto-remove an owned copy). A purchased copy is auto-removed **only** once the skill it boosts reaches the 4.00 cap (gate.max 3.75 + bonus delta 0.25), and then only the instances targeting that skill. Old saves using `{kind:'noStatAtLeast'}` are unaffected: that kind still exists in the engine; only Quick Learner's data switched.
**Date logged:** 2026-06-16

---

### Setter Dumps (id: `setter-dumps`)
**Source text:** Tier ladder: I=0 AP, II=1 AP, III=3 AP, IV=4 AP, V=2 AP.
**Interpretation:** **Non-monotonic tier costs.** Oikawa Dump (Tier V) has addCost 2, which is *less* than Kageyama Dump (Tier IV) at addCost 4. This appears intentional — the Oikawa Dump may be considered a more specialized technique that costs less to add once Kageyama Dump is mastered. Encoded faithfully as written (`addCost` sequence: 0, 1, 3, 4, 2). The cumulative cost to reach Tier V = 2+0+1+3+4+2 = 12 AP.
**Date logged:** 2026-06-12

---

### Athletic Setting (id: `athletic-setting`)
**Source text:** Tier ladder: I=0 AP, II=2 AP, III=2 AP, IV=5 AP, V=3 AP.
**Interpretation:** **Non-monotonic tier costs.** Atsumu Athletics (Tier V) has addCost 3, less than Kageyama Athletics (Tier IV) at addCost 5. Encoded faithfully as written.
**Date logged:** 2026-06-12

---

### Block Follow (id: `block-follow`)
**Source text:** Tier ladder: I=0 AP, II=1 AP, III=3 AP, IV=2 AP.
**Interpretation:** **Non-monotonic tier costs.** Nishinoya Cover (Tier IV) has addCost 2, less than Komi Cover (Tier III) at addCost 3. Encoded faithfully as written.
**Date logged:** 2026-06-12

---

### Double Jump (id: `double-jump`)
**Source text:** "Cost: 3 AP. Prereq: Standing Reach 250cm+. Three tiers: I=Quick+3rd Tempo, II=Quick+2nd Tempo, III=Quick+Bic."
**Interpretation:** Prereq uses a derived metric: `{kind:'derived', metric:'standingReach', min:250}`. Three tiers (I–III). This ability is itself a prereq for Standing Block — that prereq is encoded as `{kind:'ability', id:'double-jump', minTier:3}` where `minTier:3` means the third tier (1-based index, Quick+Bic). The engine should check that the purchased tier of double-jump is >= 3.
**Date logged:** 2026-06-12

---

### Standing Block (id: `standing-block`)
**Source text:** "Cost: 2 AP. Prereq: Standing Reach 260cm+, Double Jump 3 (1)."
**Interpretation:** Two compound AND prereqs: `{kind:'derived', metric:'standingReach', min:260}` and `{kind:'ability', id:'double-jump', minTier:3}`. The `(1)` means maxTimes:1. `Double Jump 3` means the third tier of Double Jump must be purchased. minTier:3 is 1-based (matching the Roman numeral "III" = Quick+Bic tier).
**Date logged:** 2026-06-12

---

### Swing Block (id: `swing-block`)
**Source text:** "Cost: 2 AP. Prereq: Block 2.75+ or Speed 3+ (1). Your Blocking Reach is instead calculated by: 1.3*Height+0.9*Vertical Jump."
**Interpretation:** OR prereq encoded as `{kind:'or', any:[{kind:'stat',stat:'Block',min:2.75},{kind:'stat',stat:'Speed',min:3}]}`. The reach formula override is encoded as `{kind:'overrideBlockingCoef', value:0.9}`, replacing the default 0.85 coefficient. The engine's `blockingReach()` function already accepts a `coef` parameter; when Swing Block is active the engine passes 0.9. maxTimes:1.
**Date logged:** 2026-06-12

---

### Overhand Pass (id: `overhand-pass`)
**Source text:** "Cost: 2 AP. Prereq: Pass 2.75+ or Set 2.25+ (1)."
**Interpretation:** OR prereq: `{kind:'or', any:[{kind:'stat',stat:'Pass',min:2.75},{kind:'stat',stat:'Set',min:2.25}]}`. maxTimes:1. No creation-time stat delta.
**Date logged:** 2026-06-12

---

### Aggressive Spiker (id: `aggressive-spiker`)
**Source text:** "Cost: 3 AP. Prereq: Power 3.25+, Spike 3.25+ (1). Add +0.25 to your Power, and subtract -0.25 from your Stamina or IQ."
**Interpretation:** The +0.25 Power is encoded as `{kind:'statDelta', stat:'Power', delta:0.25}`. The −0.25 penalty requires a Stamina/IQ chooser. However, `types.ts` defines `Effect.choose` as `'any' | 'twoSkills' | ['Dig','Block']` — there is no `['Stamina','IQ']` literal variant. Since the type schema cannot be changed without downstream impact, the penalty effect is encoded as `{kind:'statDelta', choose:['Dig','Block'], delta:-0.25}` purely to satisfy the TypeScript type. **The runtime engine MUST override the chooser to present Stamina/IQ options, consulting the `notes` field.** This is a known schema gap — the `Effect` type would need `'choose?: ... | [Stamina,IQ]'` to fully support this ability without a notes-based workaround.
**Date logged:** 2026-06-12

---

### Footage Maestro (id: `footage-maestro`)
**Source text:** "Cost: 2 AP. Prereq: IQ 2.5+ (3). Add +0.25 to either your Dig or Block Stat. Subtract -0.5 to your Stamina Stat."
**Interpretation:** Two effects: (1) `{kind:'statDelta', choose:['Dig','Block'], delta:0.25}` — the chooser matches the `['Dig','Block']` literal in the Effect type exactly. (2) `{kind:'statDelta', stat:'Stamina', delta:-0.5}`. Both effects apply each time the ability is purchased (maxTimes:3).
**Date logged:** 2026-06-12

---

### Momentum Player (id: `momentum-player`)
**Source text:** "Cost: 3 AP. Prereq: N/A (1). Choose two Skill Stats. Each game roll 1d4: 3-4 both +0.5; 1 both -0.75. Reset at end of every game."
**Interpretation:** The per-game 1d4 roll is an *in-play* effect, not a creation-time stat delta. The chooser is represented as `{kind:'statDelta', choose:'twoSkills', delta:0}` to record that two stats are chosen at selection time and the delta is 0 at creation. The actual game-round bonuses/penalties are left entirely to the game engine and are noted here only. maxTimes:1.
**Date logged:** 2026-06-12

---

### New Technique (id: `new-technique`)
**Source text:** "Cost: 4 AP. Prereq: Yearly Only (1). Decrease Spike and Serve by -0.25. The next time you reach nationals, add +0.5 to both."
**Interpretation:** The immediate −0.25 Spike and −0.25 Serve are creation-time effects encoded as two `statDelta` effects. The conditional +0.5 upon reaching nationals is a future in-play event that cannot be modelled as an Effect at character creation; noted here and in `notes` field only. The `yearlyOnly` flag is set in both `prereqs` (as `kind:'meta'`) and `meta[]`.
**Date logged:** 2026-06-12

---

### Left Handed (id: `left-handed`)
**Source text:** "Cost: 2 AP. Prereq: Select on Character Creation (1)."
**Interpretation:** The `creationOnly` flag is encoded in both `prereqs` (`{kind:'meta', flag:'creationOnly'}`) and `meta:['creationOnly']`. No stat delta — the mechanical effect (blockers/passers must adjust) is in-play only.
**Date logged:** 2026-06-12

---

### Coaching Potential (id: `coaching-potential`)
**Source text:** "Cost: 4 AP. Prereq: Any Stat 4.25+, Third Year (1). When you graduate, three teammates of your choice add +0.25 to their Stat that is the same as your highest Stat."
**Interpretation:** Two prereqs: `{kind:'statAny', min:4.25}` and `{kind:'meta', flag:'thirdYear'}`. The graduation effect is an inter-character post-session event; not a creation-time self Effect. Left as descriptive only. `thirdYear` flag appears in both `prereqs` and `meta[]`.
**Date logged:** 2026-06-12

---

### Bully (id: `bully`)
**Source text:** "Cost: 2 AP. Prereq: Not a First Year. Choose one stat and a teammate. If that teammate's stat is lower than but within 1 point of yours, reduce it by -0.5. Then add +0.25 to your same stat."
**Interpretation:** The self +0.25 to a chosen stat is encoded as `{kind:'statDelta', choose:'any', delta:0.25}`. The teammate −0.5 reduction is an inter-character effect not modelled in `Effect[]`. No maxTimes listed. `notFirstYear` flag in both `prereqs` and `meta[]`.
**Date logged:** 2026-06-12

---

### Antagonize (id: `antagonize`)
**Source text:** "Cost: 4 AP. Prereq: IQ 2+. If their IQ is lower than yours, reduce one of their Stats by -0.5."
**Interpretation:** Entirely an inter-character in-play effect. No creation-time self stat delta. Left as descriptive only in `notes`. No maxTimes listed.
**Date logged:** 2026-06-12

---

### Fan (id: `fan`) / Nationally Recognized (id: `nationally-recognized`) / Teammate Chemistry (id: `teammate-chemistry`)
**Source text:** Flavor/social abilities with no stat-modifying effects.
**Interpretation:** All three have empty `effects: []`. Effects are purely narrative/social (Fan: one loyal fan; Nationally Recognized: national magazine feature; Teammate Chemistry: in-play mutual understanding). These are noted as descriptive-only.
**Date logged:** 2026-06-12

---

### Fan (id: `fan`) — uncapped repeatable
**Source text:** "Cost: 1 AP." Fan is purchasable an unlimited number of times; each copy costs a flat 1 AP (1 fan = 1 AP, 2 fans = 2 AP, 3 fans = 3 AP, …).
**Interpretation:** Fan now has `repeatable: true`, matching the existing uncapped-repeat mechanic used by Training. Each instance is an independent `SelectedAbility` and `computeSpent` already sums `baseCost` per instance, so total cost scales linearly (three copies = 3 AP). Previously Fan had no `repeatable` flag and so defaulted to single-purchase (`maxTimes` 1), which was the bug. No schema change was needed.
**Date logged:** 2026-06-13

---

### Teammate Chemistry (id: `teammate-chemistry`) — uncapped repeatable
**Source text:** "Cost: 2 AP. Prereq: N/A." You gain chemistry with a teammate of your choice who also has this ability. Each copy represents chemistry with a different teammate, so the ability is purchasable an unlimited number of times, AP allowance permitting.
**Interpretation:** Teammate Chemistry now has `repeatable: true`, matching the Fan/Training uncapped-repeat mechanic. Each instance is an independent `SelectedAbility` and `computeSpent` sums `baseCost` per instance, so total cost scales linearly with no per-copy scaling (each copy a flat 2 AP). Previously it had no `repeatable` flag and so defaulted to single-purchase (`maxTimes` 1). No schema change was needed.
**Date logged:** 2026-06-15

---

### Hustle / Block Follow — "+" notation in prereqs
**Source text:** "Prereq: Speed +3.25, Dig +2.5" (Hustle); "Speed +3, Dig +3" (Block Follow).
**Interpretation:** The `+` prefix before stat values is a formatting artifact, not an addition operator. Interpreted as minimum thresholds: Speed >= 3.25, Dig >= 2.5 etc. All other abilities use `Stat X+` notation consistently.
**Date logged:** 2026-06-12

---

### Abilities with no maxTimes
The following abilities have no `(N)` in the source and therefore have no `maxTimes` field (purchasable unlimited times unless otherwise noted): Training, Jump Serve, Read Block, Jump Float Serve, Captain Reliability, Boom Jump Technique, Growth Spurt, Route Running (MB), Route Running (WS), Emergency Setting, Tooling the Block, Guess Blocking, Out of System Hitting, Hitting Angles, Setter Dumps, Athletic Setting, Hustle, Block Follow, Block Breaker, Mental Fortitude, Fan, Nationally Recognized, Teammate Chemistry, Aura, Double Jump, Footage Maestro (maxTimes:3), Form Reading, Backrow Attack, Setting Form, Bully, Antagonize.
**Date logged:** 2026-06-12
