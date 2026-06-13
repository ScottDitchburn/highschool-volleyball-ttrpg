// App.tsx -- Stepped wizard shell with persistent live character-sheet panel.
// Navigation is internal wizard state; NO router dependency.
import React, { useState, useEffect, useCallback } from 'react';
import { CharacterProvider, useCharacter } from './state/characterStore';
import { CoachApp } from './coach/CoachApp';
import { CharacterSheet } from './components/CharacterSheet';
import { SaveControls } from './components/SaveControls';
import { PhysicalStep } from './steps/PhysicalStep';
import { ReachesStep } from './steps/ReachesStep';
import { SkillsStep } from './steps/SkillsStep';
import { YearExperienceStep } from './steps/YearExperienceStep';
import { AbilitiesStep } from './steps/AbilitiesStep';
import { ReviewStep } from './steps/ReviewStep';
import { generateRandomSeed } from './rng/seeded';

// -- Step definitions --

const STEPS = [
  { id: 'physical',       label: 'Physical',      short: 'Phys',  component: PhysicalStep },
  { id: 'reaches',        label: 'Reaches',       short: 'Reach', component: ReachesStep },
  { id: 'skills',         label: 'Skills',        short: 'Skl',   component: SkillsStep },
  { id: 'yearExperience', label: 'Year & Exp',    short: 'Yr',    component: YearExperienceStep },
  { id: 'abilities',      label: 'Abilities',     short: 'Abl',   component: AbilitiesStep },
  { id: 'review',         label: 'Review',        short: 'Rev',   component: ReviewStep },
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

// -- Name entry modal --

function NameEntry({ onStart, onCoach }: { onStart: () => void; onCoach: () => void }) {
  const { character, dispatch } = useCharacter();
  const [seeded, setSeeded] = useState(false);
  const [seed, setSeed] = useState('');

  const seedReady = !seeded || seed.trim().length > 0;
  const canStart = character.name.trim().length > 0 && seedReady;

  function handleStart() {
    if (!canStart) return;
    if (seeded) {
      dispatch({ type: 'START_SEEDED_RUN', seed: seed.trim() });
    }
    onStart();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-court p-6 gap-8">
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-black text-orange-400 tracking-tight">
          Haikyuu: Gauntlet RPG
        </h1>
        <p className="text-charcoal-400 mt-2 text-lg">v2 Character Builder</p>
      </div>

      <div className="card w-full max-w-md flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-charcoal-300">Character Name</span>
          <input
            type="text"
            value={character.name}
            onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })}
            placeholder="Enter your player's name..."
            className="bg-charcoal-800 border border-charcoal-600 rounded-lg px-4 py-2.5
                       text-charcoal-100 placeholder:text-charcoal-600 focus:outline-none
                       focus:border-orange-600 focus:ring-1 focus:ring-orange-600"
            maxLength={48}
          />
        </label>

        {/* Seeded Run */}
        <div className="flex flex-col gap-2 rounded-lg border border-charcoal-700 bg-charcoal-800/40 p-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={seeded}
              onChange={(e) => setSeeded(e.target.checked)}
              className="w-4 h-4 accent-orange-500"
            />
            <span className="text-sm font-semibold text-charcoal-200">Seeded Run</span>
            <span className="text-xs text-charcoal-500">— same seed always rolls the same character</span>
          </label>

          {seeded && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Enter a seed (e.g. karasuno-2026)"
                  className="flex-1 min-w-0 bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2
                             text-charcoal-100 placeholder:text-charcoal-600 focus:outline-none
                             focus:border-orange-600 focus:ring-1 focus:ring-orange-600 font-mono text-sm"
                  maxLength={64}
                />
                <button
                  type="button"
                  onClick={() => setSeed(generateRandomSeed())}
                  className="btn-ghost text-xs py-2 px-3 shrink-0"
                  aria-label="Generate a random seed"
                  title="Generate a random seed"
                >
                  🎲 Random
                </button>
              </div>
              <p className="text-xs text-charcoal-500">
                Every roll is determined by this seed and locked — no rerolling. You still assign
                stats and pick abilities freely.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {seeded ? 'Start Seeded Run' : 'Start Building'}
        </button>

        <div className="flex items-center gap-3 text-charcoal-600 text-xs">
          <span className="flex-1 h-px bg-charcoal-700" />
          or
          <span className="flex-1 h-px bg-charcoal-700" />
        </div>

        <button
          type="button"
          onClick={onCoach}
          className="btn-ghost"
          title="Open team management to build a roster and starting lineup"
        >
          Coach — Team Management
        </button>
      </div>

      <p className="text-charcoal-600 text-xs max-w-xs text-center">
        Your character is autosaved to localStorage. You can export it as JSON at any time.
      </p>
    </div>
  );
}

// -- Step indicator --

interface StepIndicatorProps {
  current: StepIndex;
  onNavigate: (i: StepIndex) => void;
}

function StepIndicator({ current, onNavigate }: StepIndicatorProps) {
  return (
    <nav
      className="step-indicator flex items-center gap-1 overflow-x-auto py-2 px-1"
      aria-label="Wizard steps"
    >
      {STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'pending';
        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => i <= current && onNavigate(i as StepIndex)}
              disabled={i > current}
              className="flex flex-col items-center gap-1 min-w-[3rem] disabled:cursor-default group"
              aria-current={i === current ? 'step' : undefined}
            >
              <span
                className={
                  state === 'active'  ? 'step-badge-active' :
                  state === 'done'    ? 'step-badge-done' :
                                        'step-badge-pending'
                }
              >
                {i + 1}
              </span>
              <span className={`text-xs font-medium hidden sm:block ${
                state === 'active'  ? 'text-orange-400' :
                state === 'done'    ? 'text-charcoal-400' :
                                      'text-charcoal-600'
              }`}>
                {step.short}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px min-w-[0.5rem] ${i < current ? 'bg-orange-700' : 'bg-charcoal-700'}`} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// -- Main wizard --

function Wizard() {
  const [step, setStep] = useState<StepIndex>(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { character } = useCharacter();

  // Listen for level-up navigation requests from ReviewStep
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ stepId: string }>).detail;
      const idx = STEPS.findIndex((s) => s.id === detail.stepId);
      if (idx !== -1) setStep(idx as StepIndex);
    };
    window.addEventListener('haikyu:goto-step', handler);
    return () => window.removeEventListener('haikyu:goto-step', handler);
  }, []);

  const StepComponent = STEPS[step].component;
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  return (
    <div className="flex flex-col min-h-screen bg-court">
      {/* Top bar */}
      <header className="no-print bg-charcoal-950 border-b border-charcoal-800 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-orange-400 font-black text-lg tracking-tight">Haikyuu</span>
          <span className="text-charcoal-500 text-sm ml-2">Gauntlet Builder</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-charcoal-400 text-sm hidden sm:block truncate max-w-[12rem]">
            {character.name || 'Unnamed Player'}
          </span>
          <button
            className="btn-ghost text-sm py-1.5 px-3 lg:hidden"
            onClick={() => setSheetOpen(!sheetOpen)}
            aria-expanded={sheetOpen}
            aria-label="Toggle character sheet"
          >
            Sheet
          </button>
        </div>
      </header>

      {/* Mobile sheet overlay */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 flex justify-end">
          <div className="w-80 max-w-full bg-charcoal-950 border-l border-charcoal-800 p-4 overflow-y-auto flex flex-col gap-4">
            <button
              onClick={() => setSheetOpen(false)}
              className="text-charcoal-400 hover:text-orange-400 text-sm self-start"
            >
              Close
            </button>
            <CharacterSheet />
            <div className="border-t border-charcoal-800 pt-3">
              <SaveControls />
            </div>
          </div>
        </div>
      )}

      {/* Body: wizard + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main wizard column */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          <div className="no-print bg-charcoal-900 border-b border-charcoal-800 px-4">
            <StepIndicator current={step} onNavigate={setStep} />
          </div>

          <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full">
            <StepComponent />
          </div>

          <div className="wizard-nav no-print bg-charcoal-900 border-t border-charcoal-800 px-4 py-3 flex justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1) as StepIndex)}
              disabled={isFirst}
              className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <span className="text-charcoal-500 text-sm self-center">
              {step + 1} / {STEPS.length}
            </span>
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1) as StepIndex)}
              disabled={isLast}
              className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </main>

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 bg-charcoal-950 border-l border-charcoal-800 overflow-y-auto p-4 gap-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-charcoal-500">
            Character Sheet
          </h2>
          <CharacterSheet />
          <div className="border-t border-charcoal-800 pt-3">
            <SaveControls />
          </div>
        </aside>
      </div>
    </div>
  );
}

// -- App root --

type AppState = 'name-entry' | 'wizard';

function AppInner({ onCoach }: { onCoach: () => void }) {
  const [appState, setAppState] = useState<AppState>('name-entry');

  // Reset (from SaveControls or graduation) clears the session and returns the
  // player to the landing page to enter a new character name.
  useEffect(() => {
    const handler = () => setAppState('name-entry');
    window.addEventListener('haikyu:reset', handler);
    return () => window.removeEventListener('haikyu:reset', handler);
  }, []);

  if (appState === 'name-entry') {
    return <NameEntry onStart={() => setAppState('wizard')} onCoach={onCoach} />;
  }

  return <Wizard />;
}

// Lightweight routing: /Coach (any case) → coach mode, everything else → builder.
// No router dependency — just pathname + history.pushState, matching the app's
// existing zero-router style. (vercel.json rewrites /Coach to index.html.)
const COACH_PATH = /^\/coach\/?$/i;

export default function App() {
  const [path, setPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
    }
    setPath(to);
  }, []);

  if (COACH_PATH.test(path)) {
    return <CoachApp onExit={() => navigate('/')} />;
  }

  return (
    <CharacterProvider>
      <AppInner onCoach={() => navigate('/Coach')} />
    </CharacterProvider>
  );
}
