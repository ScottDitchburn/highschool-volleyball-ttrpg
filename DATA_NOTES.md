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

All 40 abilities from the "Abilities (WIP)" 2-column table in `Haikyu_ Gauntlet RPG v.2.md` were encoded here.
They were revised and extended to 45 for v.3 — see the **v.3 rules update** section at the end of this file,
which supersedes the v.2 entries below wherever the two disagree.

---

### Training (id: `training`)
> **Superseded by v.3** — see "Training (v.3)" below.
**Source text:** "Cost: 5 AP. Prereq: N/A. You train hard each practice and even on your time off. Add +0.25 to any Stat."
**Interpretation:** No `maxTimes` is listed. Encoded with no `maxTimes` field (undefined = unlimited). +0.25 to any Stat encoded as `{kind:'statDelta', choose:'any', delta:0.25}`.
**Date logged:** 2026-06-12

---

### Quick Learner (id: `quick-learner`)
> **Superseded by v.3** — see "Quick Learner (v.3)" below.
**Source text:** "Cost: 3 AP. Prereq: No Stat 3.75 or higher (5). Add +0.25 to any Stat."
**Interpretation:** A **global inverse acquisition gate**, encoded as `{kind:'noStatAtLeast', min:3.75}`: Quick Learner cannot be **selected** once any (effective) skill is at 3.75 or higher. `(5)` means maxTimes 5; +0.25 to any Stat is `{kind:'statDelta', choose:'any', delta:0.25}`. The gate restricts **selection only** — the validation sweep treats `noStatAtLeast` as acquisition-only, so an **owned** Quick Learner is **never auto-removed** if a skill later rises (even to 4.0+). (Earlier 2026-06-16 iterations briefly tried a per-target `anyStatBelow` gate with a 4.0 cap-drop and then without it; both were reverted to this global-gate + never-drop model per the final design call.)
**Date logged:** 2026-06-12 (gate); 2026-06-16 (never-auto-drop sweep behaviour)

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
> **Superseded** — the `['Dig','Block']` placeholder described below is gone; see
> "Aggressive Spiker — chooser placeholder removed" in the v.3 section.
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

---

# v.3 rules update

_Source: `Haikyu_ Gauntlet RPG v.3.md` (replaces `Haikyu_ Gauntlet RPG v.2.md`).
Date logged: 2026-09-16._

The ability table grew from 40 to **45** abilities. Costs, effects and the schema
changed as recorded below. Where an entry above (v.2) disagrees with an entry here,
**this section wins**.

## Schema additions (`src/types.ts`)

| Addition | Why |
|----------|-----|
| `ChooseSpec = 'any' \| 'twoSkills' \| SkillStat[]` | `statDelta.choose` now takes an explicit stat list, so Training/Quick Learner's six-skill chooser and Aggressive Spiker's Stamina/IQ pair are expressible directly. Replaces the old `['Dig','Block']`-only literal. |
| `{ kind: 'verticalDelta'; cm }` | Weight Lifting's "+3cm to your Vertical Jump". Applied to the **effective** vertical jump, exactly as `heightDelta` is applied to effective height, so it flows into Spiking and Blocking Reach. |
| `{ kind: 'optionChoice'; prompt; options }` + `AbilityOption` + `OptionEffect` | "Choose one of the following": one option is recorded **per purchase**. Options may carry their own effects (Weight Lifting) or be purely narrative (Flexibility). |
| `DerivedReaches.effectiveVerticalCm` | Base vertical + `verticalDelta`. Surfaced on the live sheet, Reaches step, Review, print sheet and Discord export next to effective height. |
| `SelectedAbility.chooserSelections` widened to `SkillStat \| SkillStat[] \| string` | An `optionChoice` records the chosen `AbilityOption.id`; stat choosers are unchanged. |

`src/engine/effects.ts` is new: it is the single implementation of "apply the selected
abilities' effects", shared by the store selectors and the prereq engine's simulation
(previously duplicated, which would have needed every new effect kind taught twice).
`src/utils/abilityChoices.ts` is the single place that renders a recorded choice as text
(ability card, Review, print sheet, Discord export, coach roster).

**Stale picks from a v.2 save:** a recorded pick a chooser no longer offers (e.g. a v.2
Training on Power) grants nothing and the purchase is reported as still owing a choice,
so the player re-picks rather than silently keeping a bonus the rules withdrew. Fixed
effects on the same ability (the Stamina cost) still apply.

**Unresolved choices** behave exactly as the existing stat choosers do: nothing is applied,
`evaluateAbility().needsChooser` is true, and a repeatable ability cannot be bought again
until the outstanding choice is made.

**Clamping:** effective stats are still **not clamped** at either end. The existing
convention allowed stats above 4.00 via bonuses; v.3's Stamina costs make sub-1.00 values
reachable (e.g. three Weight Lifting purchases = −1.5 Stamina). Both are left as computed —
the source gives no floor or ceiling, and clamping would silently hide the cost from the
player. Noted here as the ambiguity it is.

---

### Training (v.3) (id: `training`)
**Source text:** "Training Cost: 6 AP Prereq: N/A  You train hard each practice and even on your time off. Add +0.25 to Serve, Spike, Set, Pass, Dig, or Block Stats. Decrease your Stamina by -0.25."
**Interpretation:** Cost 5 → **6 AP**. The chooser is narrowed from "any Stat" to the six VB skills, encoded as `choose: VB_SKILLS` (`['Serve','Spike','Set','Pass','Dig','Block']`) — Speed, Power, IQ and Stamina are no longer selectable. A second, fixed effect `{stat:'Stamina', delta:-0.25}` applies on **every** purchase and stacks with repeats. Still `repeatable: true` (no "(N)" in the source).
**Date logged:** 2026-09-16

---

### Quick Learner (v.3) (id: `quick-learner`)
**Source text:** "Quick Learner: Cost: 4 AP Prereq: No VB Stat 3.75 or higher (5) … Add +0.25 to Serve, Spike, Set, Pass, Dig, or Block Stats. Decrease your Stamina by -0.25."
**Interpretation:** Cost 3 → **4 AP**. "VB" is shorthand for *volleyball*, i.e. the character's stats generally — **not** the six-skill subset — so the existing global gate `{kind:'noStatAtLeast', min:3.75}` over all ten stats is unchanged (rules-owner confirmed). `(5)` → `maxTimes: 5`, unchanged. Same six-skill chooser and −0.25 Stamina as Training.
**Date logged:** 2026-09-16

---

### Rest (id: `rest`) — new in v.3
**Source text:** "Rest: Cost: 2 AP Prereq: N/A  You often learn it is best to let your body recover, increase your Stamina Stat by +0.25."
**Interpretation:** 2 AP, no prereqs, single fixed effect `{stat:'Stamina', delta:+0.25}`. The source shows **no "(N)"**, so it follows the repo's existing convention for uncapped abilities (Training, Fan, Teammate Chemistry): `repeatable: true`, no `maxTimes`, a flat 2 AP per copy. It is the natural counterweight to the new Stamina costs on Training / Quick Learner / Weight Lifting / Game Study.
**Date logged:** 2026-09-16

---

### Weight Lifting (id: `weight-lifting`) — new in v.3
**Source text:** "Weight Lifting: Cost: 3 AP Prereq: N/A (3)  You take extra time to hone your physique. Either add +0.25 to your Speed or Power Stats, or add +3cm to your Vertical Jump. Decrease your Stamina by -0.5."
**Interpretation:** 3 AP, no prereq, `(3)` → `maxTimes: 3`. Because one of the three choices is a **centimetre** bonus rather than a stat, it cannot be a `statDelta` chooser; it is encoded as an `optionChoice` with three options — `speed` (+0.25 Speed), `power` (+0.25 Power), `vertical` (`verticalDelta` +3 cm). The Vertical Jump bonus raises `effectiveVerticalCm`, and therefore Spiking Reach (`1.3×H + V`) and Blocking Reach (`1.3×H + coef×V`, including Swing Block's 0.9). Standing Reach is height-only and unaffected. The −0.5 Stamina is a separate fixed effect that applies on every purchase **regardless of the pick**, including while the pick is still outstanding.
**Date logged:** 2026-09-16

---

### Game Study (id: `game-study`) — new in v.3
**Source text:** "Game Study: Cost: 2 AP Prereq: N/A (3)  You are an avid watcher of all types of volleyball matches. Increase your IQ by +0.25 and decrease your Stamina by 0.25"
**Interpretation:** 2 AP, no prereq, `(3)` → `maxTimes: 3`. Two fixed effects (+0.25 IQ, −0.25 Stamina), no chooser. The source omits the minus sign on the Stamina figure ("decrease … by 0.25"); read as −0.25, matching the wording of Training and Quick Learner.
**Date logged:** 2026-09-16

---

### Flexibility (id: `flexibility`) — new in v.3
**Source text:** "Flexibility: Cost: 4 AP Prereq: Stamina 3.25+  Your dedication to stretches allow you to control your body in opportune ways. Choose one of the following:  You inflict major spin on every spike and serve, causing it to bounce and curve widely. / You are able to rotate your core and shoulders midair, opening up new hitting angles."
**Interpretation:** 4 AP, prereq `{stat:'Stamina', min:3.25}`. The source lists **no "(N)"**; per the rules owner this ability is capped at **two purchases** (`maxTimes: 2`) and each purchase records one of the two options — the two purchases may pick the same option or different ones. Encoded as an `optionChoice` whose options (`spin`, `midair-rotation`) carry **no effects**: both are narrative only, with the source sentence stored in each option's `detail` for the card tooltip and print sheet. The recorded pick is shown on the ability card, Review, print sheet, Discord export and coach roster.
**Date logged:** 2026-09-16

---

### Playcalling (id: `playcalling`) — new in v.3
**Source text:** "Playcalling: Cost: 2 AP Prereq: IQ 3+, Set 3.5+  You learn and are able to call upon combination plays to give your hitters an advantage.  Tier / Additional Cost / Effect: I 0 AP Kageyama Plays, II 2 AP Oikawa Plays, III 3 AP Kenma Plays"
**Interpretation:** 2 AP base with compound AND prereqs (IQ ≥ 3 **and** Set ≥ 3.5). Three tiers; Tier I has `addCost: 0` (the base cost covers it), matching every other tiered ability. Cumulative cost: Tier I = 2 AP, Tier II = 4 AP, Tier III = 7 AP. In-play only — no creation-time stat delta.
**Date logged:** 2026-09-16

---

### Boom Jump Technique (id: `boom-jump-technique`) / Growth Spurt (id: `growth-spurt`) — re-costed in v.3
**Source text:** "Boom Jump Technique: Cost: ~~4~~ 7 AP"; "Growth Spurt: Cost: ~~5~~ 9 AP" (struck-through old values in the source).
**Interpretation:** Base costs only: 4 → **7 AP** and 5 → **9 AP**. Their effects are unchanged (+6 cm Spiking Reach, +8 cm Height).
**Date logged:** 2026-09-16

---

### Aggressive Spiker — chooser placeholder removed (id: `aggressive-spiker`)
**Source text:** Unchanged from v.2: "…Add +0.25 to your Power, and subtract -0.25 from your Stamina or IQ".
**Interpretation:** No rules change — but now that `choose` accepts an explicit `SkillStat[]`, the ability is encoded honestly as `{kind:'statDelta', choose:['Stamina','IQ'], delta:-0.25}`. The old `['Dig','Block']` placeholder, the `getChooserOptions()` special case and the hard-coded card label that all existed to work around the schema gap are deleted. Behaviour is identical; the v.2 entry above is superseded.
**Date logged:** 2026-09-16

---

### Antagonize (id: `antagonize`) — wording only
**Source text:** v.3 adds a duration: "reduce one of their Stats by -0.5 **for the game**."
**Interpretation:** No mechanical change in the builder (the effect was, and remains, an inter-character in-play effect with no creation-time delta). The duration is recorded in the ability's `notes`.
**Date logged:** 2026-09-16

---

### Physical Attributes Table — "Height − Vert Jump Modifier" column (v.3)
**Source text:** A third column added to the Physical Attributes Table (+7 at roll 3 … −17 at roll 30).
**Interpretation:** **Out of scope for this entry** — implemented separately alongside the physical-roll code. `PhysicalAttributes.verticalCm` remains the base table value; ability bonuses are layered on top of it in the effective/derived layer (`effectiveVerticalCm`).
**Date logged:** 2026-09-16

---

### Abilities with no maxTimes (v.3 revision)
Unchanged from the v.2 list above, with these additions: **Rest** is uncapped (`repeatable: true`, no "(N)" in the source); **Weight Lifting** and **Game Study** are `maxTimes: 3` from their "(3)"; **Flexibility** is `maxTimes: 2` by rules-owner decision despite no "(N)"; **Playcalling** has no "(N)" and is a single purchase like the other tiered abilities.
**Date logged:** 2026-09-16
