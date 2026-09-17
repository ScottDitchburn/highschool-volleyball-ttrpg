// ─────────────────────────────────────────────────────────────────────────────
// CharactersScreen — the /Characters route.
//
// One searchable, sortable table of every character the viewer owns plus
// everything other players have made public. Owner is always the first
// column. Signed-out visitors see the public rows and a sign-in prompt.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import { useCloudAuth } from './authContext';
import { listMine, listPublic, load, remove, setPublic } from './characters';
import { shortDate } from './format';
import type { CloudCharacterSummary } from './types';
import {
  DEFAULT_SORT,
  EMPTY_FILTER,
  applyAdvancedFilter,
  filterRows,
  isFilterEmpty,
  mergeCharacterRows,
  nextSort,
  sortRows,
  statSortKey,
  type AdvancedFilter,
  type CharacterTableRow,
  type SortKey,
  type SortSpec,
  type StatCondition,
  type TableScope,
} from './tableModel';
import { SKILL_STAT_NAMES, type SkillStat } from '../types';
import { ABILITIES, ABILITY_MAP } from '../data/abilities';
import { requestJumpToFurthestStep, requestWizardOnReturn } from '../navigation';

interface Props {
  onBack: () => void;
}

interface LoadState {
  loading: boolean;
  error: string | null;
  mine: CloudCharacterSummary[];
  shared: CloudCharacterSummary[];
}

const COLUMNS: { key: SortKey; label: string; align?: 'right'; title?: string }[] = [
  { key: 'owner', label: 'Owner' },
  { key: 'name', label: 'Character' },
  { key: 'year', label: 'Year' },
  { key: 'positions', label: 'Pos', title: 'Preferred positions: primary / secondary / tertiary' },
  { key: 'traits', label: 'Traits' },
  { key: 'height', label: 'Height', align: 'right' },
  { key: 'vertical', label: 'Vertical', align: 'right' },
  ...SKILL_STAT_NAMES.map((stat) => ({
    key: statSortKey(stat),
    label: stat === 'Stamina' ? 'Stam' : stat,
    align: 'right' as const,
    title: `${stat} (effective, with ability bonuses)`,
  })),
  { key: 'abilities', label: 'Abilities', align: 'right' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'updated', label: 'Updated' },
];

/** Abilities offered in the filter, sorted by name. */
const ABILITY_OPTIONS = [...ABILITIES].sort((a, b) => a.name.localeCompare(b.name));

function cm(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(0)} cm`;
}

function stat(value: number | undefined | null): string {
  return value === undefined || value === null ? '—' : value.toFixed(2);
}

function abilityNames(ids: string[]): string {
  return ids.map((id) => ABILITY_MAP[id]?.name ?? id).join(', ');
}

// ── Advanced filter panel ────────────────────────────────────────────────────

function FilterPanel({
  filter,
  onChange,
}: {
  filter: AdvancedFilter;
  onChange: (next: AdvancedFilter) => void;
}) {
  const [abilityToAdd, setAbilityToAdd] = useState('');

  const updateCondition = (index: number, patch: Partial<StatCondition>) =>
    onChange({
      ...filter,
      stats: filter.stats.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });

  return (
    <div className="card flex flex-col gap-3" role="group" aria-label="Advanced filters">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal-400">
          Advanced filters
        </h3>
        {!isFilterEmpty(filter) && (
          <button type="button" onClick={() => onChange(EMPTY_FILTER)} className="text-xs text-charcoal-500 hover:text-orange-400">
            Clear all
          </button>
        )}
      </div>

      {/* Stat conditions */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-charcoal-500">Stats (every condition must hold)</span>
        {filter.stats.map((cond, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={cond.stat}
              onChange={(e) => updateCondition(index, { stat: e.target.value as SkillStat })}
              aria-label={`Stat for condition ${index + 1}`}
              className="bg-charcoal-800 border border-charcoal-600 rounded-lg px-2 py-1 text-sm text-charcoal-100"
            >
              {SKILL_STAT_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={cond.op}
              onChange={(e) => updateCondition(index, { op: e.target.value as StatCondition['op'] })}
              aria-label={`Comparison for condition ${index + 1}`}
              className="bg-charcoal-800 border border-charcoal-600 rounded-lg px-2 py-1 text-sm text-charcoal-100"
            >
              <option value="gte">at least</option>
              <option value="lte">at most</option>
            </select>
            <input
              type="number"
              step={0.25}
              min={1}
              max={5}
              value={cond.value}
              onChange={(e) => updateCondition(index, { value: Number(e.target.value) })}
              aria-label={`Value for condition ${index + 1}`}
              className="w-20 bg-charcoal-800 border border-charcoal-600 rounded-lg px-2 py-1 text-sm text-charcoal-100 font-mono"
            />
            <button
              type="button"
              onClick={() => onChange({ ...filter, stats: filter.stats.filter((_, i) => i !== index) })}
              className="text-xs text-red-400 hover:text-red-300"
              aria-label={`Remove condition ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...filter, stats: [...filter.stats, { stat: 'Spike', op: 'gte', value: 3 }] })}
          className="btn-ghost text-xs py-1 px-3 self-start"
        >
          + Add stat condition
        </button>
      </div>

      {/* Abilities */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-charcoal-500">Abilities (must have every one listed)</span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={abilityToAdd}
            onChange={(e) => setAbilityToAdd(e.target.value)}
            aria-label="Ability to require"
            className="bg-charcoal-800 border border-charcoal-600 rounded-lg px-2 py-1 text-sm text-charcoal-100 max-w-[16rem]"
          >
            <option value="">Choose an ability…</option>
            {ABILITY_OPTIONS.filter((a) => !filter.abilityIds.includes(a.id)).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={abilityToAdd === ''}
            onClick={() => {
              if (!abilityToAdd) return;
              onChange({ ...filter, abilityIds: [...filter.abilityIds, abilityToAdd] });
              setAbilityToAdd('');
            }}
            className="btn-ghost text-xs py-1 px-3 disabled:opacity-40"
          >
            + Require ability
          </button>
        </div>
        {filter.abilityIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filter.abilityIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-xs rounded-full border border-orange-700 bg-orange-500/10 text-orange-300 px-2 py-0.5"
              >
                {ABILITY_MAP[id]?.name ?? id}
                <button
                  type="button"
                  onClick={() => onChange({ ...filter, abilityIds: filter.abilityIds.filter((x) => x !== id) })}
                  aria-label={`Stop requiring ${ABILITY_MAP[id]?.name ?? id}`}
                  className="text-orange-400 hover:text-white leading-none"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CharactersScreen({ onBack }: Props) {
  const auth = useCloudAuth();
  const { character, dispatch } = useCharacter();
  const [state, setState] = useState<LoadState>({ loading: true, error: null, mine: [], shared: [] });
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<TableScope>('all');
  const [sort, setSort] = useState<SortSpec>(DEFAULT_SORT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AdvancedFilter>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const signedIn = auth.userId !== null;

  const refresh = useCallback(async () => {
    if (!auth.client) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const [mine, shared] = await Promise.all([
      auth.userId ? listMine(auth.client, auth.userId) : Promise.resolve({ ok: true as const, value: [] }),
      listPublic(auth.client, 500),
    ]);
    const errors = [mine, shared].filter((r) => !r.ok).map((r) => (r.ok ? '' : r.error));
    setState({
      loading: false,
      error: errors.length ? errors.join(' ') : null,
      mine: mine.ok ? mine.value : [],
      shared: shared.ok ? shared.value : [],
    });
  }, [auth.client, auth.userId]);

  useEffect(() => {
    if (auth.loading) return;
    void refresh();
  }, [auth.loading, refresh]);

  // Merge at render time so the owner column picks up the Discord display name
  // as soon as the profile arrives, without refetching the lists.
  const rows = useMemo(
    () => mergeCharacterRows(state.mine, state.shared, auth.displayName),
    [state.mine, state.shared, auth.displayName],
  );
  const visible = useMemo(
    () => sortRows(applyAdvancedFilter(filterRows(rows, query, scope), filter), sort),
    [rows, query, scope, filter, sort],
  );
  const activeFilterCount = filter.stats.length + filter.abilityIds.length;

  const handleLoad = async (row: CharacterTableRow) => {
    if (!auth.client) return;
    const prompt =
      row.source === 'mine'
        ? `Load "${row.name}"? This replaces the character you are building.`
        : `Load a copy of "${row.name}"? This replaces the character you are building.`;
    if (!window.confirm(prompt)) return;
    setBusyId(row.id);
    const result = await load(auth.client, row.id, auth.userId);
    setBusyId(null);
    if (!result.ok) {
      setState((prev) => ({ ...prev, error: result.error }));
      return;
    }
    dispatch({ type: 'IMPORT_CHARACTER', character: result.value });
    requestWizardOnReturn();
    requestJumpToFurthestStep();
    onBack();
  };

  const handleDelete = async (row: CharacterTableRow) => {
    if (!auth.client) return;
    if (!window.confirm(`Delete "${row.name}" from the cloud? This cannot be undone.`)) return;
    setBusyId(row.id);
    const result = await remove(auth.client, row.id);
    setBusyId(null);
    if (!result.ok) {
      setState((prev) => ({ ...prev, error: result.error }));
      return;
    }
    if (character.cloudId === row.id) dispatch({ type: 'SET_CLOUD_ID', cloudId: null });
    setState((prev) => ({
      ...prev,
      mine: prev.mine.filter((r) => r.id !== row.id),
      shared: prev.shared.filter((r) => r.id !== row.id),
    }));
  };

  const handleToggle = async (row: CharacterTableRow) => {
    if (!auth.client) return;
    const next = !row.isPublic;
    setBusyId(row.id);
    const result = await setPublic(auth.client, row.id, next);
    setBusyId(null);
    if (!result.ok) {
      setState((prev) => ({ ...prev, error: result.error }));
      return;
    }
    setState((prev) => ({
      ...prev,
      mine: prev.mine.map((r) => (r.id === row.id ? { ...r, isPublic: next } : r)),
      // Un-publishing removes it from the public listing; re-publishing shows up on refresh.
      shared: next ? prev.shared : prev.shared.filter((r) => r.id !== row.id),
    }));
  };

  const sortIndicator = (key: SortKey) =>
    sort.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="flex flex-col min-h-screen bg-court">
      <header className="bg-charcoal-950 border-b border-charcoal-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="btn-ghost text-sm py-1.5 px-3">
            ← Builder
          </button>
          <div>
            <span className="text-orange-400 font-black text-lg tracking-tight">Haikyuu</span>
            <span className="text-charcoal-500 text-sm ml-2">Characters</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {auth.configured && !signedIn && (
            <button
              type="button"
              onClick={() => void auth.signInWithDiscord()}
              disabled={auth.loading}
              className="btn-ghost text-sm py-1.5 px-3 disabled:opacity-40"
            >
              Sign in with Discord
            </button>
          )}
          {signedIn && (
            <span className="text-charcoal-400 text-sm hidden sm:flex items-center gap-1.5">
              {auth.avatarUrl && <img src={auth.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}
              {auth.displayName ?? 'Discord user'}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 flex flex-col gap-4 max-w-7xl w-full mx-auto">
        {!auth.configured ? (
          <p className="text-charcoal-400 text-sm">
            Cloud saves are not configured for this build, so there are no characters to browse.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by owner, character or year…"
                aria-label="Search characters"
                className="flex-1 min-w-[14rem] bg-charcoal-800 border border-charcoal-600 rounded-lg px-4 py-2
                           text-charcoal-100 placeholder:text-charcoal-600 focus:outline-none
                           focus:border-orange-600 focus:ring-1 focus:ring-orange-600"
              />
              <div className="flex items-center gap-1" role="group" aria-label="Show">
                {(['all', 'mine', 'public'] as TableScope[])
                  .filter((s) => s !== 'mine' || signedIn)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScope(s)}
                      aria-pressed={scope === s}
                      className={`text-xs font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg border transition-colors ${
                        scope === s
                          ? 'bg-orange-600 border-orange-500 text-white'
                          : 'btn-ghost'
                      }`}
                    >
                      {s === 'all' ? 'All' : s === 'mine' ? 'Mine' : 'Public'}
                    </button>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className={`text-xs font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg border transition-colors ${
                  activeFilterCount > 0 ? 'bg-orange-600 border-orange-500 text-white' : 'btn-ghost'
                }`}
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={state.loading}
                className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-40"
              >
                Refresh
              </button>
            </div>

            {filtersOpen && <FilterPanel filter={filter} onChange={setFilter} />}

            {!signedIn && (
              <p className="text-charcoal-500 text-xs">
                Showing public characters only. Sign in with Discord to see and manage your own.
              </p>
            )}

            {state.error && (
              <p className="text-red-400 text-sm" role="alert">
                {state.error}
              </p>
            )}

            <div className="card p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-charcoal-500 border-b border-charcoal-800">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className={`px-3 py-2 font-bold whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`}
                        aria-sort={
                          sort.key === col.key
                            ? sort.direction === 'asc' ? 'ascending' : 'descending'
                            : 'none'
                        }
                      >
                        <button
                          type="button"
                          onClick={() => setSort((s) => nextSort(s, col.key))}
                          className="hover:text-orange-400"
                          title={col.title}
                        >
                          {col.label}
                          {sortIndicator(col.key)}
                        </button>
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2 font-bold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.loading ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-charcoal-500 italic">
                        Loading characters…
                      </td>
                    </tr>
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-charcoal-500 italic">
                        {rows.length === 0
                          ? 'No characters yet. Save one to the cloud from the Review step.'
                          : 'No characters match that search or those filters.'}
                      </td>
                    </tr>
                  ) : (
                    visible.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-charcoal-800/60 hover:bg-charcoal-800/40"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={row.source === 'mine' ? 'text-orange-300 font-semibold' : 'text-charcoal-200'}>
                            {row.ownerLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-charcoal-100">{row.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-charcoal-300">{row.yearLabel}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-charcoal-300">{row.positions || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-charcoal-300 text-xs">{row.traits.join(', ') || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-charcoal-300">{cm(row.heightCm)}</td>
                        <td className="px-3 py-2 text-right font-mono text-charcoal-300">{cm(row.verticalCm)}</td>
                        {SKILL_STAT_NAMES.map((name) => (
                          <td key={name} className="px-2 py-2 text-right font-mono text-charcoal-300">
                            {stat(row.stats?.[name])}
                          </td>
                        ))}
                        <td
                          className="px-3 py-2 text-right font-mono text-charcoal-300"
                          title={row.abilityIds.length ? abilityNames(row.abilityIds) : undefined}
                        >
                          {row.abilityCount}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.source === 'mine' ? (
                            <label className="flex items-center gap-1.5 text-xs text-charcoal-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={row.isPublic}
                                disabled={busyId === row.id}
                                onChange={() => void handleToggle(row)}
                                className="w-3.5 h-3.5 accent-orange-500"
                                aria-label={`Make ${row.name} public`}
                              />
                              {row.isPublic ? 'Public' : 'Private'}
                            </label>
                          ) : (
                            <span className="text-xs text-charcoal-500">Public</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-charcoal-500">
                          {shortDate(row.updatedAt)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              className="btn-ghost text-xs py-1 px-2"
                              disabled={busyId === row.id}
                              onClick={() => void handleLoad(row)}
                            >
                              {row.source === 'mine' ? 'Load' : 'Load copy'}
                            </button>
                            {row.source === 'mine' && (
                              <button
                                type="button"
                                className="btn-ghost text-xs py-1 px-2 text-red-400 hover:text-red-300"
                                disabled={busyId === row.id}
                                onClick={() => void handleDelete(row)}
                                aria-label={`Delete ${row.name}`}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-charcoal-600 text-xs">
              {visible.length} of {rows.length} characters shown. Click a column heading to sort.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
