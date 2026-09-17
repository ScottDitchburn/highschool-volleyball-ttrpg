// ─────────────────────────────────────────────────────────────────────────────
// CloudSaveButton — "Save to cloud" alongside the Review step's export buttons.
// Renders nothing unless cloud saves are configured AND the user is signed in;
// the banner Cloud control is where signing in happens.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import { useCloudAuth } from './authContext';
import { useCloudSave } from './useCloudSave';
import { getPublic, setPublic } from './characters';

export function CloudSaveButton() {
  const { configured, userId, client } = useCloudAuth();
  const { character } = useCharacter();
  const { canSave, isUpdate, state, saveNow } = useCloudSave();
  const cloudId = character.cloudId ?? null;

  // Public flag of the saved row: null until known (or when there is no row yet).
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [publicBusy, setPublicBusy] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsPublic(null);
    setPublicError(null);
    if (!client || !cloudId) return;
    void (async () => {
      const result = await getPublic(client, cloudId);
      if (!active) return;
      if (result.ok) setIsPublic(result.value);
      else setPublicError(result.error);
    })();
    return () => {
      active = false;
    };
  }, [client, cloudId]);

  if (!configured || userId === null) return null;

  const failed = state.status === 'error';
  const saved = state.status === 'saved';

  const togglePublic = async () => {
    if (!client || !cloudId || isPublic === null) return;
    const next = !isPublic;
    setPublicBusy(true);
    setPublicError(null);
    const result = await setPublic(client, cloudId, next);
    setPublicBusy(false);
    if (result.ok) setIsPublic(next);
    else setPublicError(result.error);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={() => void saveNow()}
        disabled={!canSave || state.status === 'saving'}
        className={`text-sm py-2 px-4 rounded-lg font-bold border transition-colors disabled:opacity-40 ${
          saved
            ? 'bg-green-700 border-green-600 text-white'
            : failed
              ? 'bg-red-700 border-red-600 text-white'
              : 'btn-ghost'
        }`}
        title={isUpdate ? 'Update this character in your cloud saves' : 'Save this character to your cloud saves'}
      >
        {state.status === 'saving'
          ? 'Saving…'
          : saved
            ? state.message
            : failed
              ? 'Save failed'
              : isUpdate
                ? 'Update cloud save'
                : 'Save to cloud'}
      </button>
      {cloudId && isPublic !== null && (
        <label
          className="flex items-center gap-1.5 text-sm text-charcoal-300 cursor-pointer select-none"
          title={isPublic ? 'Anyone can see this character in the Characters table' : 'Only you can see this character'}
        >
          <input
            type="checkbox"
            checked={isPublic}
            disabled={publicBusy}
            onChange={() => void togglePublic()}
            className="w-4 h-4 accent-orange-500"
            aria-label="Make this character public"
          />
          {isPublic ? 'Public' : 'Private'}
        </label>
      )}
      </div>
      {publicError && (
        <p className="text-red-400 text-xs max-w-[16rem]" role="alert">
          {publicError}
        </p>
      )}
      {failed && state.message && (
        <p className="text-red-400 text-xs max-w-[16rem]" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
