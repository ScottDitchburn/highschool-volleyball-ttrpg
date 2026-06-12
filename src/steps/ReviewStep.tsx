// src/steps/ReviewStep.tsx
// Milestone 6 — Full review screen with Level-Up, Print/PDF, and Discord export.

import React, { useState, useCallback } from 'react';
import { useCharacter } from '../state/characterStore';
import { SKILL_STAT_NAMES } from '../types';
import { ABILITY_MAP } from '../data/abilities';
import { computeAPBudget } from '../engine/apEngine';
import { LevelUpModal } from '../components/LevelUpModal';
import { PrintSheet } from '../export/PrintSheet';
import { buildDiscordExport } from '../export/discord';
import { cmDual } from '../utils/units';
import { SkillRadar } from '../charts/SkillRadar';

// ── helpers ─────────────────────────────────────────────────────────────────

function yearLabel(y: number): string {
  if (y === 1) return '1st Year';
  if (y === 2) return '2nd Year';
  return '3rd Year';
}

function toRoman(n: number): string {
  const map: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[n] ?? String(n);
}

// ── Section header ────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500 mb-2 mt-0">
      {children}
    </h3>
  );
}

// ── Stat row ─────────────────────────────────────────────────────────────

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 border-b border-charcoal-800 last:border-0">
      <span className="text-charcoal-400 text-sm">{label}</span>
      <span className="font-mono font-semibold text-charcoal-100 text-sm">
        {value}
        {sub && <span className="text-charcoal-500 text-xs ml-1">{sub}</span>}
      </span>
    </div>
  );
}

// ── AP Meter ──────────────────────────────────────────────────────────────

function APSection({ spent, total, remaining }: { spent: number; total: number; remaining: number }) {
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const isOver = remaining < 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span className="text-charcoal-400">Spent / Total</span>
        <span className="font-mono text-charcoal-200">{spent} / {total}</span>
      </div>
      <div className="h-2 rounded-full bg-charcoal-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'bg-red-600' : 'bg-orange-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-charcoal-500">Remaining</span>
        <span className={`font-mono font-bold ${isOver ? 'text-red-400' : 'text-orange-400'}`}>
          {remaining}
        </span>
      </div>
    </div>
  );
}

// ── Main ReviewStep ────────────────────────────────────────────────────────

export function ReviewStep() {
  const { character, effectiveStats, derivedReaches } = useCharacter();
  const { name, schoolYear, physical, selectedAbilities, levelUpHistory } = character;

  const apBudget = computeAPBudget(character);

  const [showLevelUp, setShowLevelUp] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  // Navigate to abilities step — relies on parent Wizard; we emit a custom event
  // and App.tsx can intercept it, OR we simply show a toast + close the modal.
  // For simplicity: after level-up the modal closes, user can click Abilities in nav.
  const handleGoToAbilities = useCallback(() => {
    // Fire a custom DOM event that App can listen to (optional enhancement).
    window.dispatchEvent(new CustomEvent('haikyu:goto-step', { detail: { stepId: 'abilities' } }));
  }, []);

  // ── Discord copy ──────────────────────────────────────────────────────────
  const handleDiscordCopy = useCallback(async () => {
    const text = buildDiscordExport(character, effectiveStats, derivedReaches);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2500);
    }
  }, [character, effectiveStats, derivedReaches]);

  // ── Print / PDF ───────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const isThirdYear = schoolYear === 3;

  return (
    <>
      {/* ── Level-Up modal ── */}
      {showLevelUp && (
        <LevelUpModal
          onClose={() => setShowLevelUp(false)}
          onGoToAbilities={handleGoToAbilities}
        />
      )}

      {/* ── Print-only sheet (hidden on screen, shown in @media print) ── */}
      <div className="print-only" aria-hidden="true">
        <PrintSheet
          character={character}
          effectiveStats={effectiveStats}
          derived={derivedReaches}
        />
      </div>

      {/* ── Screen content ── */}
      <div className="no-print flex flex-col gap-6">

        {/* Header row */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black text-orange-400 tracking-tight">
              {name || 'Unnamed Player'}
            </h2>
            <p className="text-charcoal-400 text-sm mt-0.5">{yearLabel(schoolYear)}</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePrint}
              className="btn-ghost text-sm py-2 px-4"
              title="Print or save as PDF via browser print dialog"
            >
              Print / Save PDF
            </button>
            <button
              onClick={handleDiscordCopy}
              className={`text-sm py-2 px-4 rounded-lg font-bold border transition-colors ${
                copyState === 'copied'
                  ? 'bg-green-700 border-green-600 text-white'
                  : copyState === 'error'
                  ? 'bg-red-700 border-red-600 text-white'
                  : 'btn-ghost'
              }`}
              title="Copy Discord-formatted character block"
            >
              {copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Failed — try again' : 'Copy for Discord'}
            </button>
            <button
              onClick={() => setShowLevelUp(true)}
              className={`text-sm py-2 px-4 rounded-lg font-bold transition-colors ${
                isThirdYear
                  ? 'bg-charcoal-700 border border-charcoal-600 text-charcoal-400 cursor-default'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
              title={isThirdYear ? '3rd year — graduation only' : `Advance to ${yearLabel((schoolYear + 1) as 1|2|3)}`}
            >
              {isThirdYear ? 'Graduate...' : 'Level Up'}
            </button>
          </div>
        </div>

        {/* Main grid: 2 columns on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── Physical & Reaches ── */}
          <div className="card flex flex-col gap-4">
            <div>
              <SectionHead>Physical Attributes</SectionHead>
              <StatRow label="Height" value={physical ? cmDual(physical.heightCm) : '—'} />
              <StatRow label="Vertical Jump" value={physical ? cmDual(physical.verticalCm, 0) : '—'} />
            </div>

            {derivedReaches && (
              <div>
                <SectionHead>Derived Reaches</SectionHead>
                <StatRow label="Standing Reach" value={cmDual(derivedReaches.standingReachCm)} />
                <StatRow label="Spiking Reach"  value={cmDual(derivedReaches.spikingReachCm)} />
                <StatRow label="Blocking Reach" value={cmDual(derivedReaches.blockingReachCm)}
                  sub={`(×${derivedReaches.blockingCoef})`} />
              </div>
            )}
          </div>

          {/* ── Skill Stats ── */}
          <div className="card">
            <SectionHead>Skill Stats</SectionHead>
            {effectiveStats ? (
              <div>
                <SkillRadar stats={effectiveStats} />
                {SKILL_STAT_NAMES.map((stat) => {
                  const base = character.skills?.[stat];
                  const eff = effectiveStats[stat];
                  const delta = base !== undefined ? eff - base : 0;
                  const deltaStr = delta !== 0
                    ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`
                    : undefined;
                  return (
                    <StatRow
                      key={stat}
                      label={stat}
                      value={eff.toFixed(2)}
                      sub={deltaStr ? `(base ${base!.toFixed(2)}, ${deltaStr})` : undefined}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-charcoal-500 italic text-sm">Stats not assigned yet</p>
            )}
          </div>

          {/* ── AP Budget ── */}
          <div className="card">
            <SectionHead>Ability Points</SectionHead>
            <div className="grid grid-cols-2 gap-x-4 text-sm mb-3">
              <span className="text-charcoal-400">Base</span>
              <span className="font-mono text-right text-charcoal-200">{apBudget.base}</span>
              <span className="text-charcoal-400">Year Bonus</span>
              <span className="font-mono text-right text-charcoal-200">+{apBudget.yearBonus}</span>
              <span className="text-charcoal-400">Experience</span>
              <span className="font-mono text-right text-charcoal-200">+{apBudget.experienceBonus}</span>
              {apBudget.levelUpGains > 0 && (
                <>
                  <span className="text-charcoal-400">Level-Up Gains</span>
                  <span className="font-mono text-right text-orange-400">+{apBudget.levelUpGains}</span>
                </>
              )}
              <span className="text-charcoal-300 font-semibold col-span-2 border-t border-charcoal-800 mt-1 pt-1">
              </span>
            </div>
            <APSection spent={apBudget.spent} total={apBudget.total} remaining={apBudget.remaining} />
          </div>

          {/* ── Level-Up History ── */}
          {levelUpHistory.length > 0 && (
            <div className="card">
              <SectionHead>Level-Up History</SectionHead>
              <div className="flex flex-col gap-2">
                {levelUpHistory.map((record, i) => (
                  <div key={i} className="bg-charcoal-800 rounded-lg px-3 py-2 text-sm flex justify-between items-center gap-2 flex-wrap">
                    <span className="text-charcoal-300 font-semibold">
                      Y{record.fromYear} → Y{record.toYear}
                    </span>
                    <div className="flex gap-3 text-xs text-charcoal-400">
                      <span>{record.teamsPlayed} teams</span>
                      <span className="text-orange-400 font-bold">+{record.apGained} AP</span>
                      <span className="text-orange-300">+{record.heightGainCm.toFixed(1)} cm</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Selected Abilities ── */}
        {selectedAbilities.length > 0 && (
          <div className="card">
            <SectionHead>Selected Abilities ({selectedAbilities.length})</SectionHead>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedAbilities.map((sel) => {
                const ability = ABILITY_MAP[sel.abilityId];
                if (!ability) return null;
                const tierLabel =
                  sel.tier > 0 && ability.tiers && ability.tiers[sel.tier - 1]
                    ? `Tier ${toRoman(sel.tier)}: ${ability.tiers[sel.tier - 1].label}`
                    : null;
                const choiceEntries = Object.entries(sel.chooserSelections);
                const costTotal = ability.baseCost + (ability.tiers
                  ? ability.tiers.slice(0, sel.tier).reduce((a, t) => a + t.addCost, 0)
                  : 0);
                return (
                  <div key={sel.uid} className="bg-charcoal-800 rounded-lg px-3 py-2.5 flex flex-col gap-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-charcoal-100 font-semibold text-sm leading-snug">{ability.name}</span>
                      <span className="text-orange-400 font-mono font-bold text-sm shrink-0">{costTotal} AP</span>
                    </div>
                    {tierLabel && (
                      <span className="text-charcoal-400 text-xs">{tierLabel}</span>
                    )}
                    {choiceEntries.length > 0 && (
                      <div className="text-xs text-charcoal-500">
                        {choiceEntries.map(([idx, v]) => (
                          <span key={idx} className="mr-2">
                            {Array.isArray(v) ? (v as string[]).join(' + ') : String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                    {ability.meta && ability.meta.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {ability.meta.map((m) => (
                          <span key={m} className="text-xs bg-charcoal-700 text-charcoal-400 px-1.5 py-0.5 rounded">
                            {m === 'notFirstYear' ? 'Not 1st Year'
                              : m === 'thirdYear' ? '3rd Year'
                              : m === 'yearlyOnly' ? 'Yearly Only'
                              : m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedAbilities.length === 0 && (
          <div className="card text-charcoal-500 italic text-sm text-center py-6">
            No abilities selected yet — go to the Abilities step to spend your AP.
          </div>
        )}

        {/* ── Level-Up CTA (bottom) ── */}
        <div className="card flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-charcoal-200 font-semibold text-sm">
              {isThirdYear
                ? 'Your player has reached 3rd year.'
                : `Ready to advance to ${yearLabel((schoolYear + 1) as 1|2|3)}?`}
            </div>
            <div className="text-charcoal-500 text-xs mt-0.5">
              {isThirdYear
                ? 'Export your sheet, then start a new character.'
                : 'Level up to gain AP, grow taller, and unlock new abilities.'}
            </div>
          </div>
          <button
            onClick={() => setShowLevelUp(true)}
            className={`text-sm py-2 px-5 rounded-lg font-bold transition-colors ${
              isThirdYear
                ? 'bg-charcoal-700 border border-charcoal-600 text-charcoal-300 hover:border-orange-600 hover:text-orange-300'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            {isThirdYear ? 'Graduation...' : 'Level Up'}
          </button>
        </div>

      </div>
    </>
  );
}
