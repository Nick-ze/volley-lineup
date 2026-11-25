/**
 * v10: how a team's sync records depend on each other (docs/V10_SYNC_DESIGN.md §3.5). Pure.
 *
 * Parents: the team for players, seasons, presets and the starters; the season for opponents;
 * the opponent for matches (a match also needs at least one set); the match for sets. Used by
 * `mergeRemote` for orphans, cascades and resurrection.
 */
import { isPlayerInSet } from './playerUsage';
import { parseRecordKey, recordKey, setRecordId, type RecordPayload } from './syncRecords';
import { COURT_POSITIONS, SET_NUMBERS, type LineupPreset, type SetLineup } from './types';

export type Records = ReadonlyMap<string, RecordPayload>;

const str = (payload: RecordPayload, field: string): string => String(payload[field]);

/** The match id of a (valid) set record id `<matchId>/<n>`. */
const matchOfSet = (id: string): string => id.slice(0, id.lastIndexOf('/'));

type Parsed = NonNullable<ReturnType<typeof parseRecordKey>>;
const parse = (key: string): Parsed => parseRecordKey(key) as Parsed;

/** True when some set of the match is a record. */
function hasSet(records: Records, matchId: string): boolean {
  return SET_NUMBERS.some((n) => records.has(recordKey('set', setRecordId(matchId, n))));
}

/** The key of the record's parent (null for the team itself). */
export function parentKey(teamId: string, key: string, payload: RecordPayload): string | null {
  const { kind, id } = parse(key);
  switch (kind) {
    case 'team':
      return null;
    case 'opponent':
      return recordKey('season', str(payload, 'seasonId'));
    case 'match':
      return recordKey('opponent', str(payload, 'opponentId'));
    case 'set':
      return recordKey('match', matchOfSet(id));
    default:
      return recordKey('team', teamId);
  }
}

/** True when the record's parent is there (and a match has a set). */
export function parentPresent(
  records: Records,
  teamId: string,
  key: string,
  payload: RecordPayload,
): boolean {
  const parent = parentKey(teamId, key, payload);
  if (parent === null) return true;
  if (!records.has(parent)) return false;
  const { kind, id } = parse(key);
  return kind !== 'match' || hasSet(records, id);
}

/** The keys of every record below a season, opponent or match (opponents, matches, sets). */
export function descendants(records: Records, key: string): string[] {
  const { kind, id } = parse(key);
  const entries = [...records].map(([k, payload]) => ({ ...parse(k), key: k, payload }));
  const opponents = new Set(
    kind === 'season'
      ? entries
          .filter((e) => e.kind === 'opponent' && str(e.payload, 'seasonId') === id)
          .map((e) => e.id)
      : [],
  );
  const matches = new Set(
    kind === 'match'
      ? [id]
      : entries
          .filter(
            (e) =>
              e.kind === 'match' &&
              (kind === 'season'
                ? str(e.payload, 'seasonId') === id || opponents.has(str(e.payload, 'opponentId'))
                : str(e.payload, 'opponentId') === id),
          )
          .map((e) => e.id),
  );
  const below = entries.filter(
    (e) =>
      (e.kind === 'opponent' && opponents.has(e.id)) ||
      (e.kind === 'match' && matches.has(e.id) && e.key !== key) ||
      (e.kind === 'set' && matches.has(matchOfSet(e.id))),
  );
  return below.map((e) => e.key);
}

const presetNames = (payload: RecordPayload, playerId: string): boolean => {
  const lineup = payload as unknown as Pick<LineupPreset, 'slots' | 'liberoId' | 'liberoReplaces'>;
  return (
    COURT_POSITIONS.some((p) => lineup.slots[p] === playerId) ||
    lineup.liberoId === playerId ||
    lineup.liberoReplaces.includes(playerId)
  );
};

/** The keys of records that name the player: sets, presets, the starters, the team (captain). */
export function playerReferences(records: Records, playerId: string): string[] {
  const keys: string[] = [];
  for (const [key, payload] of records) {
    const { kind } = parse(key);
    const named =
      kind === 'set'
        ? isPlayerInSet(payload as unknown as SetLineup, playerId) ||
          (payload as unknown as SetLineup).liberoReplaces.includes(playerId)
        : kind === 'preset' || kind === 'starters'
          ? presetNames(payload, playerId)
          : kind === 'team' && payload.captainId === playerId;
    if (named) keys.push(key);
  }
  return keys;
}

/** True when a set with live data names the player (it can't lose them: #73). */
export function inPlayedSet(records: Records, playerId: string): boolean {
  for (const [key, payload] of records) {
    if (parse(key).kind !== 'set') continue;
    const set = payload as unknown as SetLineup;
    if (set.events.length > 0 && isPlayerInSet(set, playerId)) return true;
  }
  return false;
}
