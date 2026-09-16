// ─────────────────────────────────────────────────────────────────────────────
// useCloudSave — "Save to cloud" for the character currently in the builder.
// Shared by the banner Cloud menu and the Review step button.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react';
import { useCharacter } from '../state/characterStore';
import { useCloudAuth } from './authContext';
import { save } from './characters';

export interface CloudSaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  message: string | null;
}

const IDLE: CloudSaveState = { status: 'idle', message: null };

export interface CloudSaveHandle {
  /** True when a signed-in client is available to save through. */
  canSave: boolean;
  /** True when this character already has a cloud row (save = update). */
  isUpdate: boolean;
  state: CloudSaveState;
  saveNow: () => Promise<void>;
}

export function useCloudSave(): CloudSaveHandle {
  const { character, dispatch } = useCharacter();
  const { client, userId } = useCloudAuth();
  const [state, setState] = useState<CloudSaveState>(IDLE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSave = client !== null && userId !== null;
  const isUpdate = typeof character.cloudId === 'string';

  const saveNow = useCallback(async () => {
    if (!client || !userId) {
      setState({ status: 'error', message: 'Sign in with Discord first.' });
      return;
    }
    setState({ status: 'saving', message: null });
    const existing = character.cloudId;
    const result = await save(client, character, userId);
    if (!result.ok) {
      setState({ status: 'error', message: result.error });
      return;
    }
    if (result.value !== existing) {
      dispatch({ type: 'SET_CLOUD_ID', cloudId: result.value });
    }
    setState({
      status: 'saved',
      message: existing ? 'Updated in the cloud.' : 'Saved to the cloud.',
    });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState(IDLE), 3000);
  }, [client, userId, character, dispatch]);

  return { canSave, isUpdate, state, saveNow };
}
