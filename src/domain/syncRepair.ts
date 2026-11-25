/**
 * v10: deterministic repair of a team after a pull (docs/V10_SYNC_DESIGN.md §0 hazard 7, §4.1).
 * Pure.
 *
 * Concurrent offline edits on two devices can each be valid and still break the import rules
 * together (two "2026/27" seasons, a set naming a player deleted elsewhere, two presets called
 * "Serve"). Every device repairs the same way, so they agree; the result passes `isConsistent`
 * except for duplicate jersey numbers, which can't be repaired without renumbering and are only
 * reported. Precondition (kept by `mergeRemote`): every opponent's season and every match's
 * opponent are in the slice. Unchanged parts keep their objects; repairing twice changes nothing.
 */
import { withValidCaptain } from './captain';
import { removePlayerEverywhere } from './playerUsage';
import { isValidPointTag } from './pointTags';
import { PRESET_NAME_MAX_LENGTH, removePlayerFromPreset } from './presets';
import { foldName } from './seasonNames';
import { recordKey, type TeamSlice } from './syncRecords';
import {
  COURT_POSITIONS,
  type LineupPreset,
  type Match,
  type Opponent,
  type PointEvent,
  type Season,
  type SetEvent,
  type SetLineup,
} from './types';

export type RepairIssue =
  | { kind: 'duplicateNumber'; numbers: number[] }
  | { kind: 'renamed'; recordKey: string }
  | { kind: 'merged'; from: string; into: string };

/** Oldest first: by creation time, then id (ids are unique, so the order is total). */
const ageKey = (x: { createdAt: string; id: string }) => `${x.createdAt}\u0000${x.id}`;
const byAge = <T extends { createdAt: string; id: string }>(a: T, b: T): number =>
  ageKey(a) < ageKey(b) ? -1 : 1;

/** Old id → surviving id for same-named items (the oldest of each group survives). */
function mergeMap<T extends { id: string; createdAt: string }>(
  items: readonly T[],
  group: (item: T) => string,
): Map<string, string> {
  const survivors = new Map<string, string>();
  const map = new Map<string, string>();
  for (const item of [...items].sort(byAge)) {
    const name = group(item);
    const survivor = survivors.get(name);
    if (survivor === undefined) survivors.set(name, item.id);
    else map.set(item.id, survivor);
  }
  return map;
}

const mapList = <T>(list: T[], fn: (item: T) => T): T[] => {
  const out = list.map(fn);
  return out.every((x, i) => x === list[i]) ? list : out;
};

function mergeSeasonsAndOpponents(slice: TeamSlice, issues: RepairIssue[]): TeamSlice {
  const seasonMap = mergeMap(slice.seasons, (x: Season) => foldName(x.name));
  for (const [from, into] of seasonMap) {
    issues.push({
      kind: 'merged',
      from: recordKey('season', from),
      into: recordKey('season', into),
    });
  }
  const movedOpponents = mapList(slice.opponents, (o) => {
    const seasonId = seasonMap.get(o.seasonId);
    return seasonId === undefined ? o : { ...o, seasonId };
  });
  const opponentMap = mergeMap(
    movedOpponents,
    (o: Opponent) => `${o.seasonId}\u0000${foldName(o.name)}`,
  );
  for (const [from, into] of opponentMap) {
    issues.push({
      kind: 'merged',
      from: recordKey('opponent', from),
      into: recordKey('opponent', into),
    });
  }
  const opponents = movedOpponents.filter((o) => !opponentMap.has(o.id));
  const opponentById = new Map(opponents.map((o) => [o.id, o]));
  const matches = mapList(slice.matches, (m) => {
    const opponentId = opponentMap.get(m.opponentId) ?? m.opponentId;
    const opponent = opponentById.get(opponentId);
    const seasonId = opponent?.seasonId ?? seasonMap.get(m.seasonId) ?? m.seasonId;
    const name = opponent?.name ?? m.opponent;
    if (opponentId === m.opponentId && seasonId === m.seasonId && name === m.opponent) return m;
    return { ...m, opponentId, seasonId, opponent: name };
  });
  return {
    ...slice,
    seasons:
      seasonMap.size === 0 ? slice.seasons : slice.seasons.filter((x) => !seasonMap.has(x.id)),
    opponents: opponentMap.size === 0 ? movedOpponents : opponents,
    matches,
  };
}

/** Nobody in two slots (the first position keeps them), the libero not also a starter. */
function dedupeLineup<L extends Pick<SetLineup, 'slots' | 'liberoId'>>(lineup: L): L {
  const seen = new Set<string>();
  let slots = lineup.slots;
  for (const p of COURT_POSITIONS) {
    const id = lineup.slots[p];
    if (id === null) continue;
    if (!seen.has(id)) {
      seen.add(id);
      continue;
    }
    if (slots === lineup.slots) slots = { ...lineup.slots };
    slots[p] = null;
  }
  const liberoId = lineup.liberoId !== null && seen.has(lineup.liberoId) ? null : lineup.liberoId;
  return slots === lineup.slots && liberoId === lineup.liberoId
    ? lineup
    : { ...lineup, slots, liberoId };
}

function untagged(event: PointEvent): PointEvent {
  const { kind: _kind, playerId: _playerId, errorType: _errorType, ...rest } = event;
  return rest;
}

const setPlayerIds = (set: SetLineup): string[] => [
  ...COURT_POSITIONS.map((p) => set.slots[p]).filter((x): x is string => x !== null),
  ...(set.liberoId === null ? [] : [set.liberoId]),
  ...set.liberoReplaces,
  ...set.events.flatMap((e) =>
    e.type === 'sub' ? [e.outPlayerId, e.inPlayerId] : e.playerId === undefined ? [] : [e.playerId],
  ),
];

function repairSet(set: SetLineup, players: ReadonlySet<string>): SetLineup {
  let next = set;
  for (const id of new Set(setPlayerIds(set))) {
    if (!players.has(id)) next = removePlayerEverywhere(next, id);
  }
  next = dedupeLineup(next);
  if (next.events.some((e) => e.type === 'point' && !isValidPointTag(e))) {
    const events = next.events.map((e): SetEvent =>
      e.type === 'point' && !isValidPointTag(e) ? untagged(e) : e,
    );
    next = { ...next, events };
  }
  return next;
}

function repairPreset(preset: LineupPreset, players: ReadonlySet<string>): LineupPreset {
  const ids = [
    ...COURT_POSITIONS.map((p) => preset.slots[p]),
    preset.liberoId,
    ...preset.liberoReplaces,
  ];
  let next = preset;
  for (const id of new Set(ids)) {
    if (id !== null && !players.has(id)) next = removePlayerFromPreset(next, id);
  }
  return dedupeLineup(next);
}

/** Named presets: valid, unique names; the oldest keeps a contested name, others get " (2)". */
function renamePresets(presets: LineupPreset[], issues: RepairIssue[]): LineupPreset[] {
  const lower = (name: string) => name.trim().toLocaleLowerCase();
  const valid = (name: string) => {
    const value = name.trim();
    return value.length > 0 && value.length <= PRESET_NAME_MAX_LENGTH;
  };
  const named = presets.filter((p) => p.kind === 'preset').sort(byAge);
  const taken = new Set<string>();
  const keep = new Set<string>();
  for (const p of named) {
    if (!valid(p.name) || taken.has(lower(p.name))) continue;
    taken.add(lower(p.name));
    keep.add(p.id);
  }
  const renamed = new Map<string, string>();
  for (const p of named) {
    if (keep.has(p.id)) continue;
    const base = p.name.trim().slice(0, PRESET_NAME_MAX_LENGTH).trim() || '?';
    let name = base;
    for (let k = 2; taken.has(lower(name)); k += 1) {
      const suffix = ` (${k})`;
      name = `${base.slice(0, PRESET_NAME_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`;
    }
    taken.add(lower(name));
    renamed.set(p.id, name);
    issues.push({ kind: 'renamed', recordKey: recordKey('preset', p.id) });
  }
  return mapList(presets, (p) => {
    const name = renamed.get(p.id);
    return name === undefined ? p : { ...p, name };
  });
}

function duplicateNumbers(slice: TeamSlice): number[] {
  const seen = new Set<number>();
  const dupes = new Set<number>();
  for (const p of slice.players) {
    if (seen.has(p.number)) dupes.add(p.number);
    seen.add(p.number);
  }
  return [...dupes].sort((a, b) => a - b);
}

/**
 * The repaired team (the same object when nothing needed repair) and what was done:
 * - same-named seasons (ignoring case and accents) merge into the oldest (createdAt, id), their
 *   opponents and matches move along; same-named opponents of a season likewise;
 * - every match takes its opponent's season and name;
 * - sets: references to players who aren't in the team are removed (court, libero, libero
 *   replacements, substitutions, point tags — the score is kept), nobody stands in two slots,
 *   the libero isn't also a starter, incoherent point tags are dropped;
 * - presets lose missing players the same way; only the first starters is kept;
 * - a captain who isn't a player of the team is cleared;
 * - named presets get valid, unique names (" (2)", " (3)" …);
 * - duplicate jersey numbers are only reported.
 */
export function repairSlice(slice: TeamSlice): { slice: TeamSlice; issues: RepairIssue[] } {
  const issues: RepairIssue[] = [];
  const merged = mergeSeasonsAndOpponents(slice, issues);
  const players = new Set(slice.players.map((p) => p.id));
  const matches = mapList(merged.matches, (m): Match => {
    const sets = mapList(m.sets, (set) => repairSet(set, players));
    return sets === m.sets ? m : { ...m, sets };
  });
  const firstStarters = slice.presets.find((p) => p.kind === 'starters');
  const onlyOneStarters = slice.presets.filter((p) => p.kind !== 'starters' || p === firstStarters);
  const presets = renamePresets(
    mapList(
      onlyOneStarters.length === slice.presets.length ? slice.presets : onlyOneStarters,
      (p) => repairPreset(p, players),
    ),
    issues,
  );
  const team = withValidCaptain(slice.team, slice.players);
  const numbers = duplicateNumbers(slice);
  if (numbers.length > 0) issues.push({ kind: 'duplicateNumber', numbers });
  const same =
    team === slice.team &&
    merged.seasons === slice.seasons &&
    merged.opponents === slice.opponents &&
    matches === slice.matches &&
    presets === slice.presets;
  if (same) return { slice, issues };
  return {
    slice: {
      ...slice,
      team,
      seasons: merged.seasons,
      opponents: merged.opponents,
      matches,
      presets,
    },
    issues,
  };
}
