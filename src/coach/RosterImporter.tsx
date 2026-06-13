// Roster importer — drag-drop a drop zone OR click to browse. Accepts one or many
// character-JSON files at once. Reuses the builder's character importer/validator.

import { useRef, useState, useCallback } from 'react';
import type { Character } from '../types';
import { importCharacterFromFile } from '../state/persistence';
import { useCoach } from './coachStore';
import { MAX_ROSTER } from './types';

export function RosterImporter() {
  const { coach, dispatch } = useCoach();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [okCount, setOkCount] = useState<number | null>(null);

  const remaining = MAX_ROSTER - coach.roster.length;
  const full = remaining <= 0;

  const ingest = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
      if (files.length === 0) {
        setErrors(['No JSON files found in the dropped items.']);
        setOkCount(null);
        return;
      }
      setBusy(true);
      setErrors([]);
      setOkCount(null);

      const accepted: Character[] = [];
      const errs: string[] = [];
      for (const file of files) {
        const result = await importCharacterFromFile(file);
        if (result.ok) accepted.push(result.character);
        else errs.push(`${file.name}: ${result.error}`);
      }

      const room = MAX_ROSTER - coach.roster.length;
      const toAdd = accepted.slice(0, Math.max(0, room));
      if (toAdd.length > 0) dispatch({ type: 'ADD_PLAYERS', characters: toAdd });
      if (accepted.length > room) {
        errs.push(`Roster is capped at ${MAX_ROSTER}; ${accepted.length - room} extra player(s) were not added.`);
      }

      setOkCount(toAdd.length);
      setErrors(errs);
      setBusy(false);
    },
    [coach.roster.length, dispatch]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (full) return;
      if (e.dataTransfer?.files?.length) void ingest(e.dataTransfer.files);
    },
    [full, ingest]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      e.target.value = ''; // allow re-importing the same file
      if (files?.length) void ingest(files);
    },
    [ingest]
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Import player JSON files: click to browse or drop files here"
        aria-disabled={full}
        onClick={() => !full && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (full) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          'rounded-xl border-2 border-dashed p-6 text-center transition-colors select-none',
          full
            ? 'border-charcoal-800 bg-charcoal-900/40 cursor-not-allowed opacity-60'
            : dragOver
              ? 'border-orange-500 bg-orange-500/10 cursor-pointer'
              : 'border-charcoal-600 hover:border-orange-600 bg-charcoal-900/40 cursor-pointer',
        ].join(' ')}
      >
        <div className="text-charcoal-200 font-semibold">
          {full ? 'Roster full (12 / 12)' : busy ? 'Importing…' : 'Drop player JSON files here'}
        </div>
        {!full && (
          <div className="text-charcoal-500 text-sm mt-1">
            or <span className="text-orange-400 underline">click to browse</span> — one or many at once ·{' '}
            {remaining} slot{remaining === 1 ? '' : 's'} left
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          multiple
          className="hidden"
          onChange={handleChange}
          aria-label="Player JSON files"
        />
      </div>

      {okCount !== null && okCount > 0 && (
        <p className="text-green-400 text-xs" role="status">
          Imported {okCount} player{okCount === 1 ? '' : 's'}.
        </p>
      )}
      {errors.length > 0 && (
        <ul className="text-red-400 text-xs flex flex-col gap-0.5" role="alert">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
