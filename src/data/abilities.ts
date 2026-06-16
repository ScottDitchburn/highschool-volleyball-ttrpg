// src/data/abilities.ts
// Single source of truth for all ability definitions.
// See DATA_NOTES.md for interpretation log of every ambiguity / judgment call.
import type { Ability } from '../types';

/**
 * All 40 abilities from the Haikyū: Gauntlet RPG v2 rules (Abilities WIP table).
 * Encoded per PLAN.md §3 schema and types.ts. See DATA_NOTES.md for every
 * ambiguity, non-monotonic cost, and judgment call.
 */
export const ABILITIES: Ability[] = [
  // ── Row 1 ──────────────────────────────────────────────────────────────────

  {
    id: 'training',
    name: 'Training',
    baseCost: 5,
    repeatable: true,
    prereqs: [],
    effects: [
      { kind: 'statDelta', choose: 'any', delta: 0.25 },
    ],
    notes: 'No maxTimes listed; purchasable unlimited times (repeatable:true). +0.25 to any Stat.',
  },

  {
    id: 'quick-learner',
    name: 'Quick Learner',
    baseCost: 3,
    maxTimes: 5,
    prereqs: [
      { kind: 'anyStatBelow', max: 3.75 },
    ],
    effects: [
      { kind: 'statDelta', choose: 'any', delta: 0.25 },
    ],
    notes:
      'Per-target gate: the +0.25 may only be applied to a skill whose BASE value ' +
      'is below 3.75 (so it cannot push a skill past the 4.0 cap). You may add it ' +
      'to any qualifying skill even if other skills are already 3.75+. An owned copy ' +
      'is auto-removed only once its boosted skill reaches the 4.0 cap. Max 5 times.',
  },

  // ── Row 2 ──────────────────────────────────────────────────────────────────

  {
    id: 'jump-serve',
    name: 'Jump Serve',
    baseCost: 3,
    prereqs: [
      { kind: 'stat', stat: 'Serve', min: 3 },
    ],
    tiers: [
      { label: 'Nozawa Serve', addCost: 0 },
      { label: 'Tanka Serve',  addCost: 1 },
      { label: 'Kuroo Serve',  addCost: 2 },
      { label: 'Asahi Serve',  addCost: 3 },
      { label: 'Oikawa Serve', addCost: 4 },
    ],
    effects: [],
    notes: 'Tier I has addCost 0 (base cost covers it). Pure in-play ability; no creation-time stat delta.',
  },

  {
    id: 'read-block',
    name: 'Read Block',
    baseCost: 3,
    prereqs: [
      { kind: 'stat', stat: 'Block', min: 3.25 },
      { kind: 'stat', stat: 'Speed', min: 2.5 },
    ],
    tiers: [
      { label: 'Tanka Reads',     addCost: 0 },
      { label: 'Omimi Reads',     addCost: 1 },
      { label: 'Tsukishima Reads', addCost: 3 },
      { label: 'Hirugami Reads',  addCost: 3 },
      { label: 'Aone Reads',      addCost: 5 },
    ],
    effects: [],
    notes: 'Compound AND prereq. No creation-time stat delta; in-play blocking ability.',
  },

  // ── Row 3 ──────────────────────────────────────────────────────────────────

  {
    id: 'jump-float-serve',
    name: 'Jump Float Serve',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Serve', min: 2.5 },
    ],
    tiers: [
      { label: 'Kita Float',      addCost: 0 },
      { label: 'Kinoshita Float', addCost: 1 },
      { label: 'Besso Float',     addCost: 2 },
      { label: 'Yamaguchi Float', addCost: 3 },
      { label: 'Atsumu Float',    addCost: 3 },
    ],
    effects: [],
    notes: 'No creation-time stat delta; in-play serve ability.',
  },

  {
    id: 'captain-reliability',
    name: 'Captain Reliability',
    baseCost: 2,
    prereqs: [
      { kind: 'statAny', min: 4 },
    ],
    tiers: [
      { label: 'Terushima Leading', addCost: 0 },
      { label: 'Ushijima Leading',  addCost: 1 },
      { label: 'Oikawa Leading',    addCost: 2 },
      { label: 'Kuroo Leading',     addCost: 3 },
      { label: 'Daichi Leading',    addCost: 4 },
    ],
    effects: [],
    notes: 'Prereq: any stat 4+. Pure in-play leadership ability; no creation-time stat delta.',
  },

  // ── Row 4 ──────────────────────────────────────────────────────────────────

  {
    id: 'boom-jump-technique',
    name: 'Boom Jump Technique',
    baseCost: 4,
    prereqs: [],
    effects: [
      { kind: 'spikingReachDelta', cm: 6 },
    ],
    notes: '+6 cm to Spiking Reach. No prereqs.',
  },

  {
    id: 'growth-spurt',
    name: 'Growth Spurt',
    baseCost: 5,
    prereqs: [],
    effects: [
      { kind: 'heightDelta', cm: 8 },
    ],
    notes: '+8 cm to Height. No prereqs.',
  },

  // ── Row 5 ──────────────────────────────────────────────────────────────────

  {
    id: 'route-running-mb',
    name: 'Route Running (MB)',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Speed', min: 2.5 },
      { kind: 'stat', stat: 'IQ',    min: 2.5 },
    ],
    tiers: [
      { label: 'Matsukawa Routes', addCost: 0 },
      { label: 'Kuroo Routes',     addCost: 1 },
      { label: 'Lev Routes',       addCost: 2 },
      { label: 'Hinata Routes',    addCost: 4 },
    ],
    effects: [],
    notes: 'Middle Blocker variant. Four tiers (I-IV). No creation-time stat delta.',
  },

  {
    id: 'route-running-ws',
    name: 'Route Running (WS)',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Speed', min: 2.5 },
      { kind: 'stat', stat: 'IQ',    min: 2.5 },
    ],
    tiers: [
      { label: 'Inouka Routes',   addCost: 0 },
      { label: 'Kawatabi Routes', addCost: 1 },
      { label: 'Hanamaki Routes', addCost: 2 },
      { label: 'Kyotani Routes',  addCost: 4 },
    ],
    effects: [],
    notes: 'Wing Spiker variant. Four tiers (I-IV). No creation-time stat delta.',
  },

  // ── Row 6 ──────────────────────────────────────────────────────────────────

  {
    id: 'emergency-setting',
    name: 'Emergency Setting',
    baseCost: 3,
    prereqs: [
      { kind: 'stat', stat: 'Set', min: 3 },
    ],
    tiers: [
      { label: 'Tsukishima Setting', addCost: 0 },
      { label: 'Konoha Setting',     addCost: 1 },
      { label: 'Watari Setting',     addCost: 2 },
      { label: 'Osamu Setting',      addCost: 3 },
    ],
    effects: [],
    notes: 'Four tiers (I-IV). No creation-time stat delta; in-play fallback setting.',
  },

  {
    id: 'tooling-the-block',
    name: 'Tooling the Block',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Spike', min: 2.5 },
      { kind: 'stat', stat: 'IQ',    min: 3 },
    ],
    tiers: [
      { label: 'Maruyama Tooling',  addCost: 0 },
      { label: 'Bokuto Tooling',    addCost: 1 },
      { label: 'Daisho Tooling',    addCost: 2 },
      { label: 'Nakashima Tooling', addCost: 4 },
      { label: 'Hoshiumi Tooling',  addCost: 4 },
    ],
    effects: [],
    notes: 'Five tiers (I-V). No creation-time stat delta.',
  },

  // ── Row 7 ──────────────────────────────────────────────────────────────────

  {
    id: 'guess-blocking',
    name: 'Guess Blocking',
    baseCost: 4,
    prereqs: [
      { kind: 'stat', stat: 'IQ',   min: 3.5 },
      { kind: 'stat', stat: 'Block', min: 3.5 },
    ],
    effects: [],
    notes:
      'No tiers. No creation-time stat delta; in-play read-blocking ability. ' +
      'Described as off sheer instinct.',
  },

  {
    id: 'left-handed',
    name: 'Left Handed',
    baseCost: 2,
    maxTimes: 1,
    prereqs: [
      { kind: 'meta', flag: 'creationOnly' },
    ],
    meta: ['creationOnly'],
    effects: [],
    notes:
      'Select on Character Creation only. Max 1 time. ' +
      'No stat delta; mechanical effect is that blockers/passers must adjust angles -- in-play only.',
  },

  // ── Row 8 ──────────────────────────────────────────────────────────────────

  {
    id: 'out-of-system-hitting',
    name: 'Out of System Hitting',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Spike', min: 3.25 },
    ],
    tiers: [
      { label: 'Osamu Adjustment',     addCost: 0 },
      { label: 'Terushima Adjustment', addCost: 2 },
      { label: 'Asahi Adjustment',     addCost: 3 },
      { label: 'Kiryu Adjustment',     addCost: 5 },
    ],
    effects: [],
    notes: 'Four tiers (I-IV). No creation-time stat delta.',
  },

  {
    id: 'hitting-angles',
    name: 'Hitting Angles',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Spike', min: 3 },
    ],
    tiers: [
      { label: 'Ginjima Angles', addCost: 0 },
      { label: 'Kuguri Angles',  addCost: 2 },
      { label: 'Goshiki Angles', addCost: 2 },
      { label: 'Bokuto Angles',  addCost: 5 },
    ],
    effects: [],
    notes: 'Four tiers (I-IV). No creation-time stat delta.',
  },

  // ── Row 9 ──────────────────────────────────────────────────────────────────

  {
    id: 'setter-dumps',
    name: 'Setter Dumps',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'IQ',    min: 2.5 },
      { kind: 'stat', stat: 'Set',   min: 3 },
      { kind: 'stat', stat: 'Spike', min: 2 },
    ],
    tiers: [
      { label: 'Kogane Dump',   addCost: 0 },
      { label: 'Shirabu Dump',  addCost: 1 },
      { label: 'Futamata Dump', addCost: 3 },
      { label: 'Kageyama Dump', addCost: 4 },
      { label: 'Oikawa Dump',   addCost: 2 },
    ],
    effects: [],
    notes:
      'Five tiers (I-V). NON-MONOTONIC: Oikawa Dump (Tier V) addCost 2 < ' +
      'Kageyama Dump (Tier IV) addCost 4. Encoded faithfully as written in source.',
  },

  {
    id: 'athletic-setting',
    name: 'Athletic Setting',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Speed', min: 2.5 },
      { kind: 'stat', stat: 'Set',   min: 3.5 },
    ],
    tiers: [
      { label: 'Echigo Athletics',   addCost: 0 },
      { label: 'Futamata Athletics', addCost: 2 },
      { label: 'Kenma Athletics',    addCost: 2 },
      { label: 'Kageyama Athletics', addCost: 5 },
      { label: 'Atsumu Athletics',   addCost: 3 },
    ],
    effects: [],
    notes:
      'Five tiers (I-V). NON-MONOTONIC: Atsumu Athletics (Tier V) addCost 3 < ' +
      'Kageyama Athletics (Tier IV) addCost 5. Encoded faithfully as written in source.',
  },

  // ── Row 10 ─────────────────────────────────────────────────────────────────

  {
    id: 'hustle',
    name: 'Hustle',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Speed', min: 3.25 },
      { kind: 'stat', stat: 'Dig',   min: 2.5 },
    ],
    tiers: [
      { label: 'Hinata Hustle',   addCost: 0 },
      { label: 'Yamamoto Hustle', addCost: 1 },
      { label: 'Akagi Hustle',    addCost: 2 },
      { label: 'Yaku Hustle',     addCost: 3 },
    ],
    effects: [],
    notes:
      'Source uses "+ " notation ("Speed +3.25, Dig +2.5"); interpreted as min thresholds. ' +
      'Four tiers (I-IV). No creation-time stat delta.',
  },

  {
    id: 'block-follow',
    name: 'Block Follow',
    baseCost: 3,
    prereqs: [
      { kind: 'stat', stat: 'Speed', min: 3 },
      { kind: 'stat', stat: 'Dig',   min: 3 },
    ],
    tiers: [
      { label: 'Kageyama Cover',  addCost: 0 },
      { label: 'Daichi Cover',    addCost: 1 },
      { label: 'Komi Cover',      addCost: 3 },
      { label: 'Nishinoya Cover', addCost: 2 },
    ],
    effects: [],
    notes:
      'Source uses "+ " notation. Four tiers (I-IV). NON-MONOTONIC: ' +
      'Nishinoya Cover (Tier IV) addCost 2 < Komi Cover (Tier III) addCost 3. ' +
      'Encoded faithfully as written in source.',
  },

  // ── Row 11 ─────────────────────────────────────────────────────────────────

  {
    id: 'block-breaker',
    name: 'Block Breaker',
    baseCost: 3,
    prereqs: [
      { kind: 'stat', stat: 'Power', min: 3.25 },
    ],
    tiers: [
      { label: 'Futakuchi Spike', addCost: 0 },
      { label: 'Tanka Spike',     addCost: 1 },
      { label: 'Iwaizumi Spike',  addCost: 2 },
      { label: 'Asahi Spike',     addCost: 3 },
      { label: 'Ushijima Spike',  addCost: 4 },
    ],
    effects: [],
    notes: 'Five tiers (I-V). No creation-time stat delta.',
  },

  {
    id: 'mental-fortitude',
    name: 'Mental Fortitude',
    baseCost: 1,
    prereqs: [
      { kind: 'stat', stat: 'Stamina', min: 3 },
    ],
    tiers: [
      { label: 'Hinata Composure',   addCost: 0 },
      { label: 'Tanka Composure',    addCost: 1 },
      { label: 'Kunomi Composure',   addCost: 1 },
      { label: 'Yamamoto Composure', addCost: 1 },
      { label: 'Suwa Composure',     addCost: 1 },
    ],
    effects: [],
    notes: 'Five tiers (I-V). Tiers II-V all have addCost 1. No creation-time stat delta.',
  },

  // ── Row 12 ─────────────────────────────────────────────────────────────────

  {
    id: 'fan',
    name: 'Fan',
    baseCost: 1,
    repeatable: true,
    prereqs: [],
    effects: [],
    notes:
      'No prereqs. No tiers. Uncapped repeatable at a flat 1 AP per copy ' +
      '(1 fan = 1 AP, 2 fans = 2 AP, 3 fans = 3 AP, …). Pure narrative/flavor ' +
      'ability (one loyal fan watches every set). No mechanical stat delta.',
  },

  {
    id: 'nationally-recognized',
    name: 'Nationally Recognized',
    baseCost: 3,
    prereqs: [
      { kind: 'statAny', min: 4 },
    ],
    effects: [],
    notes:
      'Prereq: Any Stat 4+. No tiers. No creation-time stat delta. ' +
      'Purely narrative ability (featured in national magazine/interview).',
  },

  // ── Row 13 ─────────────────────────────────────────────────────────────────

  {
    id: 'teammate-chemistry',
    name: 'Teammate Chemistry',
    baseCost: 2,
    repeatable: true,
    prereqs: [],
    effects: [],
    notes:
      'No prereqs. No tiers. Effect is descriptive only -- in-play chemistry with ' +
      'another player who also has this ability. No creation-time stat delta. ' +
      'Uncapped repeatable at a flat 2 AP per copy (repeatable:true); one copy per ' +
      'teammate, AP allowance permitting. No cost scaling for additional copies.',
  },

  {
    id: 'new-technique',
    name: 'New Technique',
    baseCost: 4,
    maxTimes: 1,
    prereqs: [
      { kind: 'meta', flag: 'yearlyOnly' },
    ],
    meta: ['yearlyOnly'],
    effects: [
      { kind: 'statDelta', stat: 'Spike', delta: -0.25 },
      { kind: 'statDelta', stat: 'Serve', delta: -0.25 },
    ],
    notes:
      'Yearly Only. Max 1 time. Immediate creation-time effects: -0.25 Spike, -0.25 Serve. ' +
      'Future conditional: +0.5 to both Spike and Serve when reaching nationals -- ' +
      'this is an in-play conditional event, not modelled as an Effect[].',
  },

  // ── Row 14 ─────────────────────────────────────────────────────────────────

  {
    id: 'aura',
    name: 'Aura',
    baseCost: 1,
    prereqs: [],
    tiers: [
      { label: 'Hirugami Aura', addCost: 0 },
      { label: 'Aone Aura',     addCost: 1 },
      { label: 'Ushijima Aura', addCost: 1 },
      { label: 'Atsumu Aura',   addCost: 1 },
    ],
    effects: [],
    notes:
      'No prereqs. Four tiers (I-IV). All tiers II-IV have addCost 1. ' +
      'Pure flavor/narrative ability; no creation-time stat delta.',
  },

  {
    id: 'double-jump',
    name: 'Double Jump',
    baseCost: 3,
    prereqs: [
      { kind: 'derived', metric: 'standingReach', min: 250 },
    ],
    tiers: [
      { label: 'Quick+3rd Tempo', addCost: 0 },
      { label: 'Quick+2nd Tempo', addCost: 1 },
      { label: 'Quick+Bic',       addCost: 1 },
    ],
    effects: [],
    notes:
      'Prereq: Standing Reach 250 cm+. Three tiers (I-III). ' +
      'Standing Block requires this ability at Tier 3 (minTier:3 = the third tier entry, Quick+Bic).',
  },

  // ── Row 15 ─────────────────────────────────────────────────────────────────

  {
    id: 'footage-maestro',
    name: 'Footage Maestro',
    baseCost: 2,
    maxTimes: 3,
    prereqs: [
      { kind: 'stat', stat: 'IQ', min: 2.5 },
    ],
    effects: [
      { kind: 'statDelta', choose: ['Dig', 'Block'], delta: 0.25 },
      { kind: 'statDelta', stat: 'Stamina', delta: -0.5 },
    ],
    notes:
      'Max 3 times. Two effects each purchase: +0.25 to Dig OR Block (chooser), AND -0.5 Stamina.',
  },

  {
    id: 'coaching-potential',
    name: 'Coaching Potential',
    baseCost: 4,
    maxTimes: 1,
    prereqs: [
      { kind: 'statAny', min: 4.25 },
      { kind: 'meta', flag: 'thirdYear' },
    ],
    meta: ['thirdYear'],
    effects: [],
    notes:
      'Prereq: Any Stat 4.25+ AND Third Year. Max 1 time. ' +
      'Effect is post-graduation: three teammates gain +0.25 to the stat matching your highest. ' +
      'Not a creation-time self stat delta; left as descriptive only.',
  },

  // ── Row 16 ─────────────────────────────────────────────────────────────────

  {
    id: 'momentum-player',
    name: 'Momentum Player',
    baseCost: 3,
    maxTimes: 1,
    prereqs: [],
    effects: [
      { kind: 'statDelta', choose: 'twoSkills', delta: 0 },
    ],
    notes:
      'Max 1 time. Choose two Skill Stats at selection (encoded as twoSkills chooser, delta 0). ' +
      'Per-game 1d4 roll: 3-4 both +0.5; 1 both -0.75. In-game roll only, not a creation delta.',
  },

  {
    id: 'overhand-pass',
    name: 'Overhand Pass',
    baseCost: 2,
    maxTimes: 1,
    prereqs: [
      {
        kind: 'or',
        any: [
          { kind: 'stat', stat: 'Pass', min: 2.75 },
          { kind: 'stat', stat: 'Set',  min: 2.25 },
        ],
      },
    ],
    effects: [],
    notes:
      'OR prereq: Pass 2.75+ or Set 2.25+. Max 1 time. ' +
      'No creation-time stat delta; in-play passing technique against jump floats.',
  },

  // ── Row 17 ─────────────────────────────────────────────────────────────────

  {
    id: 'standing-block',
    name: 'Standing Block',
    baseCost: 2,
    maxTimes: 1,
    prereqs: [
      { kind: 'derived', metric: 'standingReach', min: 260 },
      { kind: 'ability', id: 'double-jump', minTier: 3 },
    ],
    effects: [],
    notes:
      'Two prereqs: Standing Reach 260 cm+ AND Double Jump at Tier 3 (Quick+Bic). ' +
      'minTier:3 is 1-based: the third tier entry. ' +
      'No creation-time stat delta; in-play blocking without jumping.',
  },

  {
    id: 'swing-block',
    name: 'Swing Block',
    baseCost: 2,
    maxTimes: 1,
    prereqs: [
      {
        kind: 'or',
        any: [
          { kind: 'stat', stat: 'Block', min: 2.75 },
          { kind: 'stat', stat: 'Speed', min: 3 },
        ],
      },
    ],
    effects: [
      { kind: 'overrideBlockingCoef', value: 0.9 },
    ],
    notes:
      'OR prereq: Block 2.75+ or Speed 3+. Max 1 time. ' +
      'Effect: Blocking Reach coefficient overridden from 0.85 to 0.9. ' +
      'Formula from source: 1.3*Height + 0.9*Vertical Jump.',
  },

  // ── Row 18 ─────────────────────────────────────────────────────────────────

  {
    id: 'form-reading',
    name: 'Form Reading',
    baseCost: 6,
    prereqs: [
      { kind: 'stat', stat: 'Dig', min: 4 },
      { kind: 'stat', stat: 'IQ',  min: 3 },
    ],
    effects: [],
    notes:
      'No tiers. High cost (6 AP). No creation-time stat delta. ' +
      'In-play: time slows when spiker approaches; step precisely into hitting lane.',
  },

  {
    id: 'aggressive-spiker',
    name: 'Aggressive Spiker',
    baseCost: 3,
    maxTimes: 1,
    prereqs: [
      { kind: 'stat', stat: 'Power', min: 3.25 },
      { kind: 'stat', stat: 'Spike', min: 3.25 },
    ],
    effects: [
      { kind: 'statDelta', stat: 'Power', delta: 0.25 },
      { kind: 'statDelta', choose: ['Dig', 'Block'], delta: -0.25 },
    ],
    notes:
      'Max 1 time. Effects: +0.25 Power. Then -0.25 from either Stamina OR IQ (player chooses). ' +
      "The Effect type's choose union only supports ['Dig','Block'] as a literal tuple array; " +
      "Stamina/IQ is not a supported literal pair. Encoded as choose:['Dig','Block'] with " +
      'delta:-0.25 so the type compiles. The runtime engine MUST treat this chooser as ' +
      'Stamina-or-IQ per the source rules, not Dig-or-Block. See DATA_NOTES.md.',
  },

  // ── Row 19 ─────────────────────────────────────────────────────────────────

  {
    id: 'backrow-attack',
    name: 'Backrow Attack',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Spike', min: 2.75 },
    ],
    tiers: [
      { label: 'Backrow',       addCost: 0 },
      { label: 'Backrow Quick', addCost: 2 },
    ],
    effects: [],
    notes: 'Two tiers (I-II). No creation-time stat delta.',
  },

  {
    id: 'setting-form',
    name: 'Setting Form',
    baseCost: 2,
    prereqs: [
      { kind: 'stat', stat: 'Set', min: 3.25 },
    ],
    tiers: [
      { label: 'Kageyama Form', addCost: 0 },
      { label: 'Oikawa Form',   addCost: 1 },
      { label: 'Kenma Form',    addCost: 2 },
    ],
    effects: [],
    notes: 'Three tiers (I-III). No creation-time stat delta.',
  },

  // ── Row 20 ─────────────────────────────────────────────────────────────────

  {
    id: 'bully',
    name: 'Bully',
    baseCost: 2,
    prereqs: [
      { kind: 'meta', flag: 'notFirstYear' },
    ],
    meta: ['notFirstYear'],
    effects: [
      { kind: 'statDelta', choose: 'any', delta: 0.25 },
    ],
    notes:
      'Prereq: Not a First Year. No maxTimes listed. Choose one stat. ' +
      'If a chosen teammate has that stat lower than yours but within 1 point, ' +
      'their stat is reduced by -0.5 (inter-character effect, not modelled in Effect[]). ' +
      'Self-effect: +0.25 to your chosen stat (encoded as choose:any, delta:+0.25). ' +
      'The teammate penalty is left as descriptive-only.',
  },

  {
    id: 'antagonize',
    name: 'Antagonize',
    baseCost: 4,
    prereqs: [
      { kind: 'stat', stat: 'IQ', min: 2 },
    ],
    effects: [],
    notes:
      'No tiers. No maxTimes. Effect: target an opposing player; if their IQ < yours, ' +
      'reduce one of their Stats by -0.5. Entirely an inter-character in-play effect; ' +
      'no creation-time self stat delta. Left as descriptive only.',
  },
];

/** Lookup map: id -> Ability */
export const ABILITY_MAP: Record<string, Ability> = Object.fromEntries(
  ABILITIES.map((a) => [a.id, a]),
);
