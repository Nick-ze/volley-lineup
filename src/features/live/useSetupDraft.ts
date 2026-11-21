import { useMemo, useState } from 'react';

import { emptySetLineup } from '@/domain/lineup';
import { setServeFirst } from '@/domain/lineupEditing';
import {
  defaultWeServeFirst,
  isSetComplete,
  setupSources,
  type SetupSources,
} from '@/domain/matchFlow';
import { applyPresetToSet, filledCount, type PresetLineup } from '@/domain/presets';
import { rotateStarters, type RotateDirection } from '@/domain/roles';
import type { Match, Player, SetLineup, SetNumber } from '@/domain/types';
import { useAppStore } from '@/store';

export interface SetupDraft {
  /** The lineup being set up (not stored until Start / Edit lineup). */
  draft: SetLineup;
  sources: SetupSources;
  /** Players left out by the last fill (injured / not in the team). */
  skipped: string[];
  complete: boolean;
  /** True when anyone is on court or libero (an empty draft isn't worth storing). */
  hasPlayers: boolean;
  fill: (lineup: PresetLineup) => void;
  setServe: (weServeFirst: boolean) => void;
  /** Moves the whole starting six one position (v4: so the setter can start anywhere). */
  rotate: (direction: RotateDirection) => void;
  /** Forget local lineup changes (after saving); a serve choice made here is kept. */
  clear: () => void;
}

/**
 * A local draft of a set being set up in live mode. It starts from the stored set (or an empty
 * one); who serves first defaults to the team that received first in the previous set. Filling uses the same rules
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
  const [lineup, setLineup] = useState<SetLineup | null>(null);
  const [serve, setServe] = useState<boolean | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const base = lineup ?? stored ?? emptySetLineup(setNumber);
  // Reached from the previous set: the rotating default, unless toggled here.
  const weServeFirst =
    serve ?? (sources.previous ? defaultWeServeFirst(sources.previous) : base.weServeFirst);
  const draft = setServeFirst(base, weServeFirst);

  return {
    draft,
    sources,
    skipped,
    complete: isSetComplete(draft),
    hasPlayers: filledCount(draft) > 0 || draft.liberoId !== null,
    fill: (preset) => {
      const result = applyPresetToSet(draft, preset, players);
      setLineup(result.set);
      setSkipped(result.skipped);
    },
    setServe,
    rotate: (direction) => setLineup(rotateStarters(draft, direction)),
    clear: () => {
      setLineup(null);
      setSkipped([]);
    },
  };
}
