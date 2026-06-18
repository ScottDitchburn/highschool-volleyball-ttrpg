// InfoWidget -- "Information" toggle in the wizard top banner (steps 1-6).
// Click the button to expand a help panel; click it again, click outside, or
// press Escape to hide it.

import { useEffect, useRef, useState } from 'react';

interface InfoEntry {
  question: string;
  /** Rendered as the body of the answer. */
  body: React.ReactNode;
}

const INFO_ENTRIES: InfoEntry[] = [
  {
    question: 'What does 3/5 in a stat even mean?',
    body: (
      <>
        <p>
          Since Haikyū is inconsistent with giving player stats, use the below as a
          general rule:
        </p>
        <ol className="mt-2 flex flex-col gap-1 list-decimal list-inside">
          <li><strong className="text-charcoal-100">Bad</strong> — probably a liability</li>
          <li><strong className="text-charcoal-100">Below Average</strong> — rather not have them do this</li>
          <li><strong className="text-charcoal-100">Above Average</strong> — it's acceptable to occur</li>
          <li><strong className="text-charcoal-100">Good</strong> — they are known for this</li>
          <li><strong className="text-charcoal-100">Great</strong> — one of the best at this</li>
        </ol>
      </>
    ),
  },
  {
    question: "What's the difference between Abilities and Stats?",
    body: (
      <>
        <p>
          Abilities are the maximum potential of what you can do. Stats are the
          capacity with which you can do it.
        </p>
        <p className="mt-2">
          <span className="text-charcoal-500">e.g.</span> A Tier 5 jump server with
          3.5 Serve is someone who can hit an Oikawa serve but doesn't have the
          control nor consistency. Meanwhile a Tier 1 jump server with 5 Serve is
          someone who can consistently control their Nozawa-level jump serve.
        </p>
      </>
    ),
  },
  {
    question: 'What is the baseline of not having an ability?',
    body: (
      <p>
        Someone who you don't think of when considering the ability. For example:
        Daichi and Block Breaker, Aone and Route Running, Sugawara and Setter Dumps.
      </p>
    ),
  },
];

export function InfoWidget() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5 ${open ? 'text-orange-400 border-orange-600' : ''}`}
      >
        <span aria-hidden="true">ℹ</span>
        Information
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Character creator information"
          className="absolute right-0 mt-2 z-50 w-[min(92vw,26rem)] max-h-[70vh] overflow-y-auto
                     rounded-lg border border-charcoal-700 bg-charcoal-950 shadow-2xl p-4
                     flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400">
              Information
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-charcoal-400 hover:text-orange-400 text-sm leading-none"
              aria-label="Close information"
            >
              ✕
            </button>
          </div>

          {INFO_ENTRIES.map((entry) => (
            <section key={entry.question} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-charcoal-100">{entry.question}</h3>
              <div className="text-xs text-charcoal-400 leading-relaxed">{entry.body}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
