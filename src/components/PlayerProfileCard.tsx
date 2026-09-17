// ─────────────────────────────────────────────────────────────────────────────
// PlayerProfileCard — Review step: two personality traits, preferred playing
// positions (primary / secondary / tertiary) and a free-text bio.
//
// Traits: slot 1 is positive or neutral, slot 2 negative or neutral. A seeded
// run's traits come from the seed and are shown locked; custom runs pick them.
// Positions: dropdowns show full names; everywhere else the short code is used.
// ─────────────────────────────────────────────────────────────────────────────

import { useCharacter } from '../state/characterStore';
import {
  PREFERRED_POSITIONS,
  profileOf,
  type PreferredPosition,
  type PreferredPositions,
} from '../types';
import { FIRST_TRAIT_OPTIONS, SECOND_TRAIT_OPTIONS, TRAIT_MAP, traitLabel, type Trait } from '../data/traits';

const BIO_MAX = 600;

const RANKS: { key: keyof PreferredPositions; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'tertiary', label: 'Tertiary' },
];

const SELECT_CLASS =
  'bg-charcoal-800 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-charcoal-100 ' +
  'focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 w-full';

function kindTag(id: string | null): string {
  if (!id) return '';
  const kind = TRAIT_MAP[id]?.kind;
  return kind ? ` (${kind})` : '';
}

function TraitSelect({
  slot,
  label,
  hint,
  options,
  value,
  locked,
  onChange,
}: {
  slot: 0 | 1;
  label: string;
  hint: string;
  options: Trait[];
  value: string | null;
  locked: boolean;
  onChange: (id: string | null) => void;
}) {
  if (locked) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-charcoal-500">{label}</span>
        <span className="font-semibold text-charcoal-100" data-testid={`trait-${slot}`}>
          {value ? traitLabel(value) : '—'}
          <span className="text-charcoal-500 text-xs font-normal">{kindTag(value)}</span>
        </span>
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-charcoal-500">{label} <span className="text-charcoal-600">· {hint}</span></span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        aria-label={label}
        className={SELECT_CLASS}
      >
        <option value="">Choose…</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label} ({t.kind})
          </option>
        ))}
      </select>
    </label>
  );
}

export function PlayerProfileCard() {
  const { character, dispatch } = useCharacter();
  const profile = profileOf(character);
  const locked = character.seeded;

  const chosen = new Set<PreferredPosition>(
    [profile.positions.primary, profile.positions.secondary, profile.positions.tertiary].filter(
      (p): p is PreferredPosition => p !== null,
    ),
  );

  return (
    <div className="card flex flex-col gap-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-500 m-0">Player Profile</h3>

      {/* Traits */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold text-charcoal-300">Traits</span>
          {locked && (
            <span className="text-xs text-charcoal-500" title="Seeded runs draw both traits from the seed">
              🔒 from seed
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TraitSelect
            slot={0}
            label="Trait 1"
            hint="positive or neutral"
            options={FIRST_TRAIT_OPTIONS}
            value={profile.traits[0]}
            locked={locked}
            onChange={(id) => dispatch({ type: 'SET_TRAIT', slot: 0, traitId: id })}
          />
          <TraitSelect
            slot={1}
            label="Trait 2"
            hint="negative or neutral"
            options={SECOND_TRAIT_OPTIONS}
            value={profile.traits[1]}
            locked={locked}
            onChange={(id) => dispatch({ type: 'SET_TRAIT', slot: 1, traitId: id })}
          />
        </div>
      </div>

      {/* Positions */}
      <div>
        <span className="text-sm font-semibold text-charcoal-300 block mb-2">Preferred Positions</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {RANKS.map((rank) => {
            const current = profile.positions[rank.key];
            return (
              <label key={rank.key} className="flex flex-col gap-1">
                <span className="text-xs text-charcoal-500">{rank.label}</span>
                <select
                  value={current ?? ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_POSITION',
                      rank: rank.key,
                      position: e.target.value === '' ? null : (e.target.value as PreferredPosition),
                    })
                  }
                  aria-label={`${rank.label} position`}
                  className={SELECT_CLASS}
                >
                  <option value="">None</option>
                  {PREFERRED_POSITIONS.filter((p) => p.code === current || !chosen.has(p.code)).map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </div>

      {/* Bio */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-charcoal-300">
          Bio <span className="text-xs font-normal text-charcoal-600">· who is this player?</span>
        </span>
        <textarea
          value={profile.bio}
          onChange={(e) => dispatch({ type: 'SET_BIO', bio: e.target.value.slice(0, BIO_MAX) })}
          maxLength={BIO_MAX}
          rows={4}
          placeholder="A short blurb: background, personality, what drives them on the court…"
          aria-label="Bio"
          className="bg-charcoal-800 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-charcoal-100
                     placeholder:text-charcoal-600 focus:outline-none focus:border-orange-600 focus:ring-1
                     focus:ring-orange-600 resize-y"
        />
        <span className="text-xs text-charcoal-600 self-end">{profile.bio.length}/{BIO_MAX}</span>
      </label>
    </div>
  );
}
