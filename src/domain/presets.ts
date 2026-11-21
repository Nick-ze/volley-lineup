/**
 * Lineup presets and team starters (schema v3). Pure functions, no React, no storage.
 *
 * A preset stores a starting six, a libero and whom the libero replaces for a team. It is never
 * played itself: applying it copies the lineup into a match set, skipping players who are
 * injured (inactive) or no longer in the team. The lineup builder edits a preset through a
 * draft `SetLineup` (`presetToDraft` / `presetFromSet`), so the same editing logic is reused.
 */
import { emptySetLineup } from './lineup';
import { isLineupLocked } from './lineupLock';
import { NAME_MAX_LENGTH } from './roster';
import { COURT_POSITIONS, type LineupPreset, type Player, type SetLineup } from './types';

/** The lineup part of a preset (what the builder edits and what is applied to a set). */
export type PresetLineup = Pick<LineupPreset, 'slots' | 'liberoId' | 'liberoReplaces'>;

/** Preset names have the same limit as other names (40 characters). */
export const PRESET_NAME_MAX_LENGTH = NAME_MAX_LENGTH;

/** Copies the starting six, libero and whom the libero replaces out of a set. */
export function presetFromSet(set: SetLineup): PresetLineup {
  return {
    slots: { ...set.slots },
    liberoId: set.liberoId,
    liberoReplaces: [...set.liberoReplaces],
  };
}

/** A draft set for editing a preset in the lineup builder (set 1, we serve, never played). */
export function presetToDraft(preset: PresetLineup): SetLineup {
  return {
    ...emptySetLineup(1),
    slots: { ...preset.slots },
    liberoId: preset.liberoId,
    liberoReplaces: [...preset.liberoReplaces],
  };
}

/** An empty lineup for a new preset. */
export function emptyPresetLineup(): PresetLineup {
  return presetFromSet(emptySetLineup(1));
}

export interface ApplyPresetResult {
  set: SetLineup;
  /** Players of the preset who were left out (injured or no longer in the team), in order. */
  skipped: string[];
}

/**
 * Applies a preset to a match set: copies slots, libero and whom the libero replaces; keeps the
 * set number, serve choice and events. Players who are inactive or not in `players` (the team's
 * roster) are skipped and their spot stays empty; nobody is placed twice. A locked (played) set
 * is returned unchanged with nothing skipped.
 */
export function applyPresetToSet(
  set: SetLineup,
  preset: PresetLineup,
  players: readonly Player[],
): ApplyPresetResult {
  if (isLineupLocked(set)) return { set, skipped: [] };
  const usable = new Set(players.filter((p) => p.active).map((p) => p.id));
  const used = new Set<string>();
  const skipped: string[] = [];
  const take = (id: string | null): string | null => {
    if (id === null || used.has(id)) return null;
    if (!usable.has(id)) {
      skipped.push(id);
      return null;
    }
    used.add(id);
    return id;
  };
  const slots: SetLineup['slots'] = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  for (const position of COURT_POSITIONS) slots[position] = take(preset.slots[position]);
  const liberoId = take(preset.liberoId);
  const onCourt = new Set(COURT_POSITIONS.map((p) => slots[p]));
  const liberoReplaces = preset.liberoReplaces.filter(
    (id, i) => onCourt.has(id) && preset.liberoReplaces.indexOf(id) === i,
  );
  return { set: { ...set, slots, liberoId, liberoReplaces }, skipped };
}

/** True when all six court positions of the preset are filled. */
export function isPresetComplete(preset: PresetLineup): boolean {
  return COURT_POSITIONS.every((p) => preset.slots[p] !== null);
}

/** Number of court positions filled (0–6). */
export function filledCount(preset: PresetLineup): number {
  return COURT_POSITIONS.filter((p) => preset.slots[p] !== null).length;
}

/** The team's starters, if set. */
export function startersFor(
  presets: readonly LineupPreset[],
  teamId: string,
): LineupPreset | undefined {
  return presets.find((p) => p.teamId === teamId && p.kind === 'starters');
}

/** The team's named presets (not the starters), sorted by name. */
export function namedPresetsFor(presets: readonly LineupPreset[], teamId: string): LineupPreset[] {
  return presets
    .filter((p) => p.teamId === teamId && p.kind === 'preset')
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Set 1 for a new match: pre-filled from the team's starters when they are complete, otherwise
 * empty. Always "we serve first" with no events.
 */
export function firstSetForNewMatch(
  presets: readonly LineupPreset[],
  teamId: string,
  players: readonly Player[],
): SetLineup {
  const empty = emptySetLineup(1);
  const starters = startersFor(presets, teamId);
  if (!starters || !isPresetComplete(starters)) return empty;
  return applyPresetToSet(empty, starters, players).set;
}

/** Removes a player from a preset (court, libero, libero replaces); same object if not in it. */
export function removePlayerFromPreset(preset: LineupPreset, playerId: string): LineupPreset {
  const inIt =
    preset.liberoId === playerId ||
    preset.liberoReplaces.includes(playerId) ||
    COURT_POSITIONS.some((p) => preset.slots[p] === playerId);
  if (!inIt) return preset;
  const slots = { ...preset.slots };
  for (const p of COURT_POSITIONS) if (slots[p] === playerId) slots[p] = null;
  return {
    ...preset,
    slots,
    liberoId: preset.liberoId === playerId ? null : preset.liberoId,
    liberoReplaces: preset.liberoReplaces.filter((id) => id !== playerId),
  };
}

export type PresetNameError = 'required' | 'tooLong' | 'taken';

export type PresetNameResult = { ok: true; value: string } | { ok: false; error: PresetNameError };

/**
 * A preset name: required (after trimming), at most 40 characters, unique (ignoring case)
 * among the team's named presets, except the one being renamed (`exceptId`).
 */
export function validatePresetName(
  name: string,
  presets: readonly LineupPreset[],
  teamId: string,
  exceptId?: string,
): PresetNameResult {
  const value = name.trim();
  if (value.length === 0) return { ok: false, error: 'required' };
  if (value.length > PRESET_NAME_MAX_LENGTH) return { ok: false, error: 'tooLong' };
  const lower = value.toLocaleLowerCase();
  const taken = namedPresetsFor(presets, teamId).some(
    (p) => p.id !== exceptId && p.name.trim().toLocaleLowerCase() === lower,
  );
  return taken ? { ok: false, error: 'taken' } : { ok: true, value };
}

/** A free name like "Preset 2" (the base text comes from the UI) for a new or copied preset. */
export function nextPresetName(
  base: string,
  presets: readonly LineupPreset[],
  teamId: string,
): string {
  const names = new Set(namedPresetsFor(presets, teamId).map((p) => p.name.toLocaleLowerCase()));
  let n = 1;
  while (names.has(`${base} ${n}`.toLocaleLowerCase())) n += 1;
  return `${base} ${n}`;
}
