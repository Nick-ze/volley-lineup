import { useMemo, useState } from 'react';

import { emptySetLineup } from '@/domain/lineup';
import { setServeFirst } from '@/domain/lineupEditing';
import {
  defaultWeServeFirst,
  isSetComplete,
  setupSources,
  type SetupSources,
} from '@/domain/matchFlow';
import { applyPresetToSet, type PresetLineup } from '@/domain/presets';
import type { Match, Player, SetLineup, SetNumber } from '@/domain/types';
import { useAppStore } from '@/store';

export interface SetupDraft {
  /** The lineup being set up (not stored until Start / Edit lineup). */
  draft: SetLineup;
  sources: SetupSources;
  /** Players left out by the last fill (injured / not in the team). */
  skipped: string[];
  complete: boolean;
  fill: (lineup: PresetLineup) => void;
  setServe: (weServeFirst: boolean) => void;
  /** Forget local changes (after saving): the draft follows the stored set again. */
  clear: () => void;
}

/**
 * A local draft of a set being set up in live mode. It starts from the stored set, or an empty
 * one where the team that received first in the previous set serves. Filling uses the same rules
 * as the lineup builder (`applyPresetToSet`: injured/removed players skipped, nobody twice).
 */
export function useSetupDraft(
  match: Match,
  setNumber: SetNumber,
  players: readonly Player[],
): SetupDraft {
  const presets = useAppStore((s) => s.presets);
  const sources = useMemo(
    () => setupSources(match, setNumber, presets),
    [match, setNumber, presets],
  );
  const stored = match.sets.find((s) => s.setNumber === setNumber);
  const [local, setLocal] = useState<SetLineup | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const draft = local ??
    stored ?? {
      ...emptySetLineup(setNumber),
      weServeFirst: defaultWeServeFirst(sources.previous),
    };

  return {
    draft,
    sources,
    skipped,
    complete: isSetComplete(draft),
    fill: (lineup) => {
      const result = applyPresetToSet(draft, lineup, players);
      setLocal(result.set);
      setSkipped(result.skipped);
    },
    setServe: (v) => setLocal(setServeFirst(draft, v)),
    clear: () => {
      setLocal(null);
      setSkipped([]);
    },
  };
}
