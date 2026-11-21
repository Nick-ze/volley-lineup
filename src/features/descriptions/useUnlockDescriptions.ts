import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';
import { deviceUnlock } from '@/lib/unlock';

import { setPrompting, useDescriptionLock } from './descriptionLock';

/**
 * The "Show descriptions" flow: the device's biometrics / PIN where available, otherwise the
 * in-app confirmation dialog (`confirmVisible`, `confirm`, `cancel`).
 */
export function useUnlockDescriptions() {
  const t = useT();
  const unlocked = useDescriptionLock((s) => s.unlocked);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestUnlock = useCallback(async () => {
    setFailed(false);
    setBusy(true);
    setPrompting(true);
    try {
      const result = await deviceUnlock({
        promptMessage: t.playerDetail.description.prompt,
        cancelLabel: t.playerDetail.description.cancel,
      });
      // Only while the app is still in front: leaving it during the prompt keeps it locked.
      if (result === 'unlocked') {
        if (AppState.currentState === 'active') useDescriptionLock.getState().unlock();
      } else if (result === 'confirm') setConfirmVisible(true);
      else setFailed(true);
    } finally {
      setPrompting(false);
      setBusy(false);
    }
  }, [t]);

  const confirm = useCallback(() => {
    setConfirmVisible(false);
    useDescriptionLock.getState().unlock();
  }, []);

  const cancel = useCallback(() => setConfirmVisible(false), []);

  const lock = useCallback(() => {
    setFailed(false);
    useDescriptionLock.getState().lock();
  }, []);

  return { unlocked, busy, failed, requestUnlock, lock, confirmVisible, confirm, cancel };
}
