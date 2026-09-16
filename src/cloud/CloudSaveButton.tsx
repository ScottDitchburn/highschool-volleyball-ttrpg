// ─────────────────────────────────────────────────────────────────────────────
// CloudSaveButton — "Save to cloud" alongside the Review step's export buttons.
// Renders nothing unless cloud saves are configured AND the user is signed in;
// the banner Cloud control is where signing in happens.
// ─────────────────────────────────────────────────────────────────────────────

import { useCloudAuth } from './authContext';
import { useCloudSave } from './useCloudSave';

export function CloudSaveButton() {
  const { configured, userId } = useCloudAuth();
  const { canSave, isUpdate, state, saveNow } = useCloudSave();

  if (!configured || userId === null) return null;

  const failed = state.status === 'error';
  const saved = state.status === 'saved';

  return (
    <div className="flex flex-col items-start gap-1">
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
      {failed && state.message && (
        <p className="text-red-400 text-xs max-w-[16rem]" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
