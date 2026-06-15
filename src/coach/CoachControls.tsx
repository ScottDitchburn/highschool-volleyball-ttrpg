// Coach export / backup controls: Print-or-PDF, Copy-for-Discord, and
// import/export of a self-contained coach JSON backup. Plus a reset.

import { useCallback, useRef, useState } from 'react';
import { useCoach } from './coachStore';
import { downloadCoach, importCoachFromFile } from './persistence';
import { buildCoachDiscordExport } from './export/coachDiscord';

export function CoachControls() {
  const { coach, dispatch } = useCoach();
  const fileRef = useRef<HTMLInputElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importOk, setImportOk] = useState(false);

  const handlePrint = useCallback(() => window.print(), []);

  const handleDiscord = useCallback(async () => {
    const text = buildCoachDiscordExport(coach);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 2500);
  }, [coach]);

  const handleImportClick = useCallback(() => {
    setImportError(null);
    setImportOk(false);
    fileRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const result = await importCoachFromFile(file);
      if (result.ok) {
        dispatch({ type: 'IMPORT_COACH', coach: result.coach });
        setImportOk(true);
        setImportError(null);
        setTimeout(() => setImportOk(false), 3000);
      } else {
        setImportError(result.error);
      }
    },
    [dispatch]
  );

  const handleReset = useCallback(() => {
    if (window.confirm('Reset the whole coach setup? This clears the roster and lineup and cannot be undone.')) {
      dispatch({ type: 'RESET' });
    }
  }, [dispatch]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handlePrint} className="btn-primary text-sm py-2 px-4" title="Print or save the team sheet as PDF">
          Print / Save PDF
        </button>
        <button type="button" onClick={handleDiscord} className="btn-ghost text-sm py-2 px-4" title="Copy a Discord-formatted team block">
          {copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Failed — try again' : 'Copy for Discord'}
        </button>
        <button type="button" onClick={() => downloadCoach(coach)} className="btn-ghost text-sm py-2 px-4" title="Download a coach backup JSON">
          ↓ Export Coach JSON
        </button>
        <button type="button" onClick={handleImportClick} className="btn-ghost text-sm py-2 px-4" title="Restore a coach backup JSON">
          ↑ Import Coach JSON
        </button>
        <button type="button" onClick={handleReset} className="btn-ghost text-sm py-2 px-4 text-red-400 hover:text-red-300" title="Reset coach setup">
          ↺ Reset
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFile}
        aria-label="Coach backup JSON file"
      />

      {importOk && (
        <p className="text-green-400 text-xs" role="status">
          Coach setup imported.
        </p>
      )}
      {importError && (
        <p className="text-red-400 text-xs" role="alert">
          Import failed: {importError}
        </p>
      )}
    </div>
  );
}
