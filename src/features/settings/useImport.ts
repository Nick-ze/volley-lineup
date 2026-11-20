import { useCallback, useState } from 'react';

import {
  mergeData,
  parseImport,
  replaceData,
  type ImportErrorCode,
  type ImportSummary,
} from '@/domain/exportSchema';
import type { ExportFile } from '@/domain/types';
import { pickTextFile } from '@/lib/fileTransfer';
import { selectAppData, useAppStore } from '@/store';

export type ImportError = ImportErrorCode | 'MERGE_CONFLICT' | 'READ_FAILED';
export type ImportMode = 'merge' | 'replace';

export type ImportState =
  | { step: 'idle' }
  | { step: 'preview'; fileName: string; file: ExportFile; summary: ImportSummary }
  | { step: 'done'; mode: ImportMode }
  | { step: 'error'; error: ImportError };

/** After an import: if no valid profile is selected and there is exactly one, select it. */
function selectOnlyProfile() {
  const { profiles, currentProfileId, selectProfile } = useAppStore.getState();
  const hasValid = profiles.some((p) => p.id === currentProfileId);
  if (!hasValid && profiles.length === 1) selectProfile(profiles[0].id);
}

/**
 * Import flow: pick a file → parse + validate → preview → merge or replace.
 * The store is only written in `apply`, and only with data that passed validation, so any
 * error leaves the existing data untouched.
 */
export function useImport() {
  const [state, setState] = useState<ImportState>({ step: 'idle' });

  const pick = useCallback(async () => {
    let picked;
    try {
      picked = await pickTextFile();
    } catch {
      setState({ step: 'error', error: 'READ_FAILED' });
      return;
    }
    if (!picked) return; // cancelled: keep whatever was shown before
    const result = parseImport(picked.text);
    setState(
      result.ok
        ? { step: 'preview', fileName: picked.name, file: result.file, summary: result.summary }
        : { step: 'error', error: result.error },
    );
  }, []);

  const apply = useCallback(
    (mode: ImportMode) => {
      if (state.step !== 'preview') return;
      const store = useAppStore.getState();
      if (mode === 'replace') {
        store.replaceAll(replaceData(state.file));
      } else {
        const merged = mergeData(selectAppData(store), state.file);
        if (!merged.ok) {
          setState({ step: 'error', error: merged.error });
          return;
        }
        store.replaceAll(merged.data);
      }
      selectOnlyProfile();
      setState({ step: 'done', mode });
    },
    [state],
  );

  const cancel = useCallback(() => setState({ step: 'idle' }), []);

  return { state, pick, apply, cancel };
}
