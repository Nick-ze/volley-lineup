import { useCallback, useState } from 'react';

import {
  parseImport,
  type ImportErrorCode,
  type ImportSummary,
  type TransferData,
} from '@/domain/exportSchema';
import { hostedOf, importHosted } from '@/domain/hostedTournament';
import {
  importChangesMatches,
  importWithSharedTeams,
  sharedTeamsInFile,
  sharedTeamsOf,
} from '@/domain/syncImport';
import type { ExportFile } from '@/domain/types';
import { pickTextFile } from '@/lib/fileTransfer';
import {
  heldMatchesNow,
  putPhotos,
  transferSnapshotNow,
  useAppStore,
  whenPhotosLoaded,
} from '@/store';

/**
 * v10: `SHARED_CONFLICT` = Replace clashes with a team shared on this device; `LIVE_MATCH` = the
 * file would change a match another device is scoring live right now.
 */
export type ImportError =
  ImportErrorCode | 'MERGE_CONFLICT' | 'SHARED_CONFLICT' | 'LIVE_MATCH' | 'READ_FAILED';
export type ImportMode = 'merge' | 'replace';

export type ImportState =
  | { step: 'idle' }
  | {
      step: 'preview';
      fileName: string;
      file: ExportFile;
      summary: ImportSummary;
      /** v10: the file's shared teams (names) that merge (manager) / are skipped (viewer). */
      shared: { merged: string[]; skipped: string[]; any: boolean };
    }
  | { step: 'done'; mode: ImportMode }
  | { step: 'error'; error: ImportError };

/** Stands in for the current data where the import doesn't read it (Replace, no shared teams). */
const emptyTransfer = (): TransferData => ({
  profiles: [],
  teams: [],
  players: [],
  matches: [],
  presets: [],
  photos: [],
  seasons: [],
  opponents: [],
});

/** After an import: if no valid profile is selected and there is exactly one, select it. */
function selectOnlyProfile() {
  const { profiles, currentProfileId, selectProfile } = useAppStore.getState();
  const hasValid = profiles.some((p) => p.id === currentProfileId);
  if (!hasValid && profiles.length === 1) selectProfile(profiles[0].id);
}

/**
 * Import flow: pick a file → parse + validate → preview → merge or replace.
 * The store is only written in `apply`, and only with data that passed validation, so any
 * error leaves the existing data untouched. v10: teams shared through the cloud are never removed
 * or replaced (`importWithSharedTeams`); without shared teams nothing changes.
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
    if (!result.ok) {
      setState({ step: 'error', error: result.error });
      return;
    }
    const { sync, teams } = useAppStore.getState();
    const shared = sharedTeamsOf(sync.teams, teams);
    const inFile = sharedTeamsInFile(result.file, shared);
    setState({
      step: 'preview',
      fileName: picked.name,
      file: result.file,
      summary: result.summary,
      shared: {
        merged: inFile.merged.map((x) => x.name),
        skipped: inFile.skipped.map((x) => x.name),
        any: shared.length > 0,
      },
    });
  }, []);

  const apply = useCallback(
    async (mode: ImportMode) => {
      if (state.step !== 'preview') return;
      const file = state.file;
      await whenPhotosLoaded();
      // v10 audit H10: from reading the current data to writing the result nothing is awaited.
      // A sync cycle that ran in between would be undone by the older snapshot, and what it
      // had pulled would be pushed back as deletions to every member of a shared team.
      const store = useAppStore.getState();
      const shared = sharedTeamsOf(store.sync.teams, store.teams);
      // Replace without shared teams doesn't read the current data (as before v10).
      const current =
        mode === 'merge' || shared.length > 0 ? transferSnapshotNow() : emptyTransfer();
      const result = importWithSharedTeams(current, file, mode, shared);
      if (!result.ok) {
        // Replace only fails because of a kept shared team ("use Replace instead" wouldn't help).
        const error = mode === 'replace' ? 'SHARED_CONFLICT' : result.error;
        setState({ step: 'error', error });
        return;
      }
      // v10 audit M15 (found by the review): not while another device is scoring a match live
      // that the file would change. Its copy would replace the scorer's rallies here, be pushed
      // as this device's newer save, and take them from every device.
      const live = heldMatchesNow([
        ...new Set([...store.matches, ...result.data.matches].map((m) => m.id)),
      ]);
      if (importChangesMatches(store.matches, result.data.matches, live)) {
        setState({ step: 'error', error: 'LIVE_MATCH' });
        return;
      }
      // v12: the hosted tournaments follow the same mode (they are never shared): Replace takes
      // the file's, Merge matches by id. Only tournaments of profiles the import leaves here.
      const hosted = importHosted(
        hostedOf(store),
        hostedOf(file),
        mode,
        new Set(result.data.profiles.map((p) => p.id)),
      );
      if (!hosted.ok) {
        setState({ step: 'error', error: hosted.error });
        return;
      }
      // The pictures are in memory at once (`putPhotos` sets them before its first await) and
      // referred to in the same step, so the prune can't drop them in between; they are
      // written to storage while the screen moves on. Photos nobody refers to afterwards
      // (Replace) are removed by the prune.
      const saving = putPhotos(result.data.photos);
      store.replaceAll({ ...result.data, ...hosted.hosted });
      selectOnlyProfile();
      await saving;
      setState({ step: 'done', mode });
    },
    [state],
  );

  const cancel = useCallback(() => setState({ step: 'idle' }), []);

  return { state, pick, apply, cancel };
}
