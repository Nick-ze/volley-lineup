/**
 * v10: a team as sync records (docs/V10_SYNC_DESIGN.md §3.1). Pure.
 *
 * A shared team is split into records — `team`, `player`, `season`, `opponent`, `match` (without
 * its sets), `set` (`<matchId>/<n>`), `preset` (named presets) and `starters` (one per team, keyed
 * by the team id) — each with a canonical payload that is hashed and pushed. Payloads leave out
 * the ids that are the record's key and the device-only fields (`Team.profileId`,
 * `Player.description`). Payloads and hashes are cached per entity object, so building the
 * records of an unchanged team again is cheap (it runs after every change of a shared team).
 */
import type { TransferData } from './exportFormat';
import { memoByIdentity } from './memo';
import type {
  LineupPreset,
  Match,
  Opponent,
  Player,
  Season,
  SetLineup,
  SetNumber,
  Team,
} from './types';

/** The kinds of sync records, in push order (parents before children). */
export type RecordKind =
  'team' | 'season' | 'opponent' | 'player' | 'match' | 'set' | 'preset' | 'starters';

export const RECORD_KINDS: readonly RecordKind[] = [
  'team',
  'season',
  'opponent',
  'player',
  'match',
  'set',
  'preset',
  'starters',
] as const;

/** A record's canonical content (never mutated; cached per entity object). */
export type RecordPayload = Readonly<Record<string, unknown>>;

/** The collections a team's records come from (the store's `AppData` without profiles). */
export type TeamData = Pick<
  TransferData,
  'teams' | 'players' | 'seasons' | 'opponents' | 'matches' | 'presets'
>;

/** One team and everything that belongs to it. */
export interface TeamSlice {
  team: Team;
  players: Player[];
  seasons: Season[];
  /** The opponents of the team's seasons. */
  opponents: Opponent[];
  matches: Match[];
  /** Named presets and the starters. */
  presets: LineupPreset[];
}

/** The local-only data `recordsToSlice` puts back (it never travels). */
export interface LocalFields {
  /** The profile of a team that isn't on the device yet. */
  profileId: string;
  /** Player id → the player's confidential description. */
  descriptions: ReadonlyMap<string, string>;
  /** The team as it is on the device: unchanged entities keep their objects and order. */
  previous?: TeamSlice;
}

/* ---------------------------------------------------------------- keys */

export function recordKey(kind: RecordKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseRecordKey(key: string): { kind: RecordKind; id: string } | null {
  const at = key.indexOf(':');
  const kind = key.slice(0, at) as RecordKind;
  const id = key.slice(at + 1);
  if (at < 0 || !RECORD_KINDS.includes(kind) || id === '') return null;
  return { kind, id };
}

/** The record id of a match's set: `<matchId>/<n>`. */
export function setRecordId(matchId: string, n: SetNumber): string {
  return `${matchId}/${n}`;
}

/** The match id and set number of a set record id (null when it isn't one). */
export function parseSetRecordId(id: string): { matchId: string; setNumber: SetNumber } | null {
  const at = id.lastIndexOf('/');
  const matchId = id.slice(0, at);
  const n = Number(id.slice(at + 1));
  if (at < 1 || !/^[1-5]$/.test(id.slice(at + 1))) return null;
  return { matchId, setNumber: n as SetNumber };
}

/* ---------------------------------------------------------------- hash */

/** JSON with sorted object keys and `undefined` properties dropped (arrays: `null`). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return value === undefined ? 'null' : (JSON.stringify(value) ?? 'null');
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`);
  return `{${parts.join(',')}}`;
}

/** cyrb53 (a small, fast, non-cryptographic 53-bit hash) as 14 hex digits. */
function cyrb53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** The payload's hash (cached per payload object). */
export const payloadHash: (payload: RecordPayload) => string = memoByIdentity((payload) =>
  cyrb53(stableStringify(payload)),
);

/* ---------------------------------------------------------------- payloads */

const teamPayload = memoByIdentity((team: Team): RecordPayload => {
  const { id: _id, profileId: _profileId, ...payload } = team;
  return payload;
});

const playerPayload = memoByIdentity((player: Player): RecordPayload => {
  const { id: _id, teamId: _teamId, description: _description, ...payload } = player;
  return payload;
});

const seasonPayload = memoByIdentity((season: Season): RecordPayload => {
  const { id: _id, teamId: _teamId, ...payload } = season;
  return payload;
});

const opponentPayload = memoByIdentity((opponent: Opponent): RecordPayload => {
  const { id: _id, ...payload } = opponent;
  return payload;
});

const matchPayload = memoByIdentity((match: Match): RecordPayload => {
  const { id: _id, teamId: _teamId, sets: _sets, ...payload } = match;
  return payload;
});

/** Named presets: minus id and team; the starters: the lineup with `presetId` (no kind). */
const presetPayload = memoByIdentity((preset: LineupPreset): RecordPayload => {
  const { id, teamId: _teamId, kind, ...rest } = preset;
  return kind === 'starters' ? { presetId: id, ...rest } : { kind, ...rest };
});

/* ---------------------------------------------------------------- slices */

/** The team with everything that belongs to it, or undefined when the team isn't there. */
export function teamSlice(data: TeamData, teamId: string): TeamSlice | undefined {
  const team = data.teams.find((t) => t.id === teamId);
  if (!team) return undefined;
  const seasons = data.seasons.filter((x) => x.teamId === teamId);
  const seasonIds = new Set(seasons.map((x) => x.id));
  return {
    team,
    players: data.players.filter((p) => p.teamId === teamId),
    seasons,
    opponents: data.opponents.filter((o) => seasonIds.has(o.seasonId)),
    matches: data.matches.filter((m) => m.teamId === teamId),
    presets: data.presets.filter((p) => p.teamId === teamId),
  };
}

/**
 * The team's records (key → payload), in push order of kinds and the slice's order within a
 * kind. Only the first starters of a team is a record (there is at most one).
 */
export function sliceToRecords(slice: TeamSlice): Map<string, RecordPayload> {
  const records = new Map<string, RecordPayload>();
  records.set(recordKey('team', slice.team.id), teamPayload(slice.team));
  for (const x of slice.seasons) records.set(recordKey('season', x.id), seasonPayload(x));
  for (const o of slice.opponents) records.set(recordKey('opponent', o.id), opponentPayload(o));
  for (const p of slice.players) records.set(recordKey('player', p.id), playerPayload(p));
  for (const m of slice.matches) records.set(recordKey('match', m.id), matchPayload(m));
  for (const m of slice.matches) {
    for (const set of m.sets) {
      // A set's payload is the set itself (cached by the same object).
      records.set(
        recordKey('set', setRecordId(m.id, set.setNumber)),
        set as unknown as RecordPayload,
      );
    }
  }
  const startersKey = recordKey('starters', slice.team.id);
  for (const p of slice.presets) {
    const key = p.kind === 'starters' ? startersKey : recordKey('preset', p.id);
    if (!records.has(key)) records.set(key, presetPayload(p));
  }
  return records;
}

/** Keys of every entity of the slice (the starters by its preset id), for `foreignKeys`. */
function entityKeys(data: TeamData, teamId: string): Set<string> {
  const keys = new Set<string>();
  const slice = teamSlice(data, teamId);
  if (!slice) return keys;
  for (const p of slice.players) keys.add(recordKey('player', p.id));
  for (const x of slice.seasons) keys.add(recordKey('season', x.id));
  for (const o of slice.opponents) keys.add(recordKey('opponent', o.id));
  for (const m of slice.matches) keys.add(recordKey('match', m.id));
  for (const p of slice.presets) keys.add(recordKey('preset', p.id));
  return keys;
}

/**
 * Entity keys (`player:`, `season:`, `opponent:`, `match:`, `preset:` + id) used by the device's
 * other teams. A pulled record whose id is one of them is skipped (`mergeRemote` `foreignIds`):
 * ids are unique per collection on a device.
 */
export function foreignKeys(data: TeamData, teamId: string): Set<string> {
  const own = entityKeys(data, teamId);
  const keys = new Set<string>();
  const add = (key: string) => {
    if (!own.has(key)) keys.add(key);
  };
  for (const p of data.players) add(recordKey('player', p.id));
  for (const x of data.seasons) add(recordKey('season', x.id));
  for (const o of data.opponents) add(recordKey('opponent', o.id));
  for (const m of data.matches) add(recordKey('match', m.id));
  for (const p of data.presets) add(recordKey('preset', p.id));
  return keys;
}

/* ---------------------------------------------------------------- records → slice */

interface Previous {
  records: ReadonlyMap<string, RecordPayload>;
  entities: Map<string, object>;
}

function previousOf(slice: TeamSlice | undefined): Previous {
  const entities = new Map<string, object>();
  if (!slice) return { records: new Map(), entities };
  entities.set(recordKey('team', slice.team.id), slice.team);
  for (const p of slice.players) entities.set(recordKey('player', p.id), p);
  for (const x of slice.seasons) entities.set(recordKey('season', x.id), x);
  for (const o of slice.opponents) entities.set(recordKey('opponent', o.id), o);
  for (const m of slice.matches) entities.set(recordKey('match', m.id), m);
  for (const p of slice.presets) {
    const key = p.kind === 'starters' ? recordKey('starters', p.teamId) : recordKey('preset', p.id);
    if (!entities.has(key)) entities.set(key, p);
  }
  return { records: sliceToRecords(slice), entities };
}

/** The previous entity of `key` when its payload is unchanged (same object or same hash). */
function reuse<E>(prev: Previous, key: string, payload: RecordPayload): E | undefined {
  const old = prev.records.get(key);
  if (old === undefined) return undefined;
  if (old !== payload && payloadHash(old) !== payloadHash(payload)) return undefined;
  return prev.entities.get(key) as E | undefined;
}

/** The previous set object when unchanged, else the payload (a whole `SetLineup`). */
function toSet(prev: Previous, key: string, payload: RecordPayload): SetLineup {
  const old = prev.records.get(key);
  if (old !== undefined && (old === payload || payloadHash(old) === payloadHash(payload))) {
    return old as unknown as SetLineup;
  }
  return payload as unknown as SetLineup;
}

const sameItems = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * The team built from its records (validated payloads), with the local-only fields put back:
 * the team's profile (the previous team's, else `local.profileId`) and the players'
 * descriptions. Entities whose payload didn't change keep their previous objects; the order is
 * the records' order (the previous slice's order, new records appended).
 */
export function recordsToSlice(
  teamId: string,
  records: ReadonlyMap<string, RecordPayload>,
  local: LocalFields,
): TeamSlice {
  const prev = previousOf(local.previous);
  const profileId = local.previous?.team.profileId ?? local.profileId;
  const players: Player[] = [];
  const seasons: Season[] = [];
  const opponents: Opponent[] = [];
  const matchRecords: [string, RecordPayload][] = [];
  const setsOf = new Map<string, SetLineup[]>();
  const presets: LineupPreset[] = [];
  let team: Team | undefined;
  for (const [key, payload] of records) {
    const parsed = parseRecordKey(key);
    if (!parsed) continue;
    const { kind, id } = parsed;
    if (kind === 'team') {
      team = reuse<Team>(prev, key, payload) ?? ({ id, profileId, ...payload } as Team);
    } else if (kind === 'player') {
      const description = local.descriptions.get(id);
      players.push(
        reuse<Player>(prev, key, payload) ??
          ({
            id,
            teamId,
            ...payload,
            ...(description === undefined ? {} : { description }),
          } as Player),
      );
    } else if (kind === 'season') {
      seasons.push(reuse<Season>(prev, key, payload) ?? ({ id, teamId, ...payload } as Season));
    } else if (kind === 'opponent') {
      opponents.push(reuse<Opponent>(prev, key, payload) ?? ({ id, ...payload } as Opponent));
    } else if (kind === 'match') {
      matchRecords.push([id, payload]);
    } else if (kind === 'set') {
      const ref = parseSetRecordId(id);
      if (!ref) continue;
      const list = setsOf.get(ref.matchId) ?? [];
      list.push(toSet(prev, key, payload));
      setsOf.set(ref.matchId, list);
    } else if (kind === 'preset') {
      presets.push(
        reuse<LineupPreset>(prev, key, payload) ??
          ({ id, teamId, ...payload, kind: 'preset' } as LineupPreset),
      );
    } else {
      const { presetId, ...lineup } = payload;
      presets.push(
        reuse<LineupPreset>(prev, key, payload) ??
          ({ id: presetId, teamId, ...lineup, kind: 'starters' } as LineupPreset),
      );
    }
  }
  const matches = matchRecords.map(([id, payload]) => {
    const sets = (setsOf.get(id) ?? []).sort((a, b) => a.setNumber - b.setNumber);
    const key = recordKey('match', id);
    const old = reuse<Match>(prev, key, payload);
    if (old && sameItems(old.sets, sets)) return old;
    return { id, teamId, ...payload, sets } as Match;
  });
  const resolved = team ?? local.previous?.team;
  if (!resolved) throw new Error(`recordsToSlice: no team record for ${teamId}`);
  return { team: resolved, players, seasons, opponents, matches, presets };
}

/* ---------------------------------------------------------------- slice → data */

function replaceItems<E extends { id: string }>(
  list: E[],
  oldItems: readonly E[],
  newItems: readonly E[],
): E[] {
  const oldIds = new Set(oldItems.map((x) => x.id));
  const next = new Map(newItems.map((x) => [x.id, x]));
  let changed = false;
  const out: E[] = [];
  for (const item of list) {
    if (!oldIds.has(item.id)) {
      out.push(item);
      continue;
    }
    const replacement = next.get(item.id);
    if (replacement === undefined) {
      changed = true;
      continue;
    }
    if (replacement !== item) changed = true;
    out.push(replacement);
    next.delete(item.id);
  }
  for (const item of next.values()) {
    out.push(item);
    changed = true;
  }
  return changed ? out : list;
}

/**
 * The data with the team's entities replaced by `slice` (undefined: removed), copy-on-write:
 * other teams and unchanged entities keep their objects and positions, new entities are
 * appended, and an unchanged collection (or all of `data`) is returned as it was.
 */
export function replaceTeamSlice<T extends TeamData>(
  data: T,
  teamId: string,
  slice: TeamSlice | undefined,
): T {
  const old = teamSlice(data, teamId);
  const teams = replaceItems(data.teams, old ? [old.team] : [], slice ? [slice.team] : []);
  const players = replaceItems(data.players, old?.players ?? [], slice?.players ?? []);
  const seasons = replaceItems(data.seasons, old?.seasons ?? [], slice?.seasons ?? []);
  const opponents = replaceItems(data.opponents, old?.opponents ?? [], slice?.opponents ?? []);
  const matches = replaceItems(data.matches, old?.matches ?? [], slice?.matches ?? []);
  const presets = replaceItems(data.presets, old?.presets ?? [], slice?.presets ?? []);
  const same =
    teams === data.teams &&
    players === data.players &&
    seasons === data.seasons &&
    opponents === data.opponents &&
    matches === data.matches &&
    presets === data.presets;
  return same ? data : { ...data, teams, players, seasons, opponents, matches, presets };
}
