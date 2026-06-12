// ─────────────────────────────────────────────────────────────────────────────
// SaveControls — lightweight Export / Import / Reset buttons
// Placed in the app header or character-sheet panel.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import { downloadCharacter, importCharacterFromFile } from '../state/persistence';

export function SaveControls() {
  const { character, dispatch } = useCharacter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importOk, setImportOk] = useState(false);

  const handleExport = () => {
    downloadCharacter(character);
  };

  const handleImportClick = () => {
    setImportError(null);
    setImportOk(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be re-imported if needed
    e.target.value = '';

    const result = await importCharacterFromFile(file);
    if (result.ok) {
      dispatch({ type: 'IMPORT_CHARACTER', character: result.character });
      setImportOk(true);
      setImportError(null);
      setTimeout(() => setImportOk(false), 3000);
    } else {
      setImportError(result.error);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset character? This cannot be undone.')) {
      dispatch({ type: 'RESET' });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {/* Export */}
        <button
          type="button"
          onClick={handleExport}
          className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
          title="Export character as JSON"
        >
          <span aria-hidden="true">↓</span> Export JSON
        </button>

        {/* Import */}
        <button
          type="button"
          onClick={handleImportClick}
          className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
          title="Import character from JSON"
        >
          <span aria-hidden="true">↑</span> Import JSON
        </button>

        {/* Reset */}
        <button
          type="button"
          onClick={handleReset}
          className="btn-ghost text-xs py-1.5 px-3 text-red-400 hover:text-red-300 flex items-center gap-1.5"
          title="Reset character to defaults"
        >
          <span aria-hidden="true">↺</span> Reset
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Import character JSON file"
      />

      {/* Feedback messages */}
      {importOk && (
        <p className="text-green-400 text-xs" role="status">
          Character imported successfully.
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
