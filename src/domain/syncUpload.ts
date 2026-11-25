/**
 * v10: uploading a local team to the cloud (docs/V10_SYNC_DESIGN.md §3.9). Pure.
 *
 * Team ids are global on the server and also name the team's photo folder, so they must be
 * plain (`[A-Za-z0-9._~-]`, at most 100 characters). A team whose id doesn't fit, or whose id is
 * already taken by someone else's team, gets a new id on the device first (`rekeyTeam`).
 */
import type { TeamData } from './syncRecords';

const SERVER_TEAM_ID = /^[A-Za-z0-9._~-]{1,100}$/;

/** True when the server accepts `id` as a team id. */
export function isServerSafeTeamId(id: string): boolean {
  return SERVER_TEAM_ID.test(id);
}

/**
 * The data with team `oldId` renamed to `newId` everywhere: the team, its players, seasons,
 * matches and presets (the starters too). Opponents follow their season and ids inside sets
 * don't name the team. Copy-on-write; `data` itself when the team isn't there. Throws when
 * another local team already has `newId` (ids are unique on a device).
 */
export function rekeyTeam<T extends TeamData>(data: T, oldId: string, newId: string): T {
  if (oldId === newId || !data.teams.some((t) => t.id === oldId)) return data;
  if (data.teams.some((t) => t.id === newId)) {
    throw new Error(`rekeyTeam: team id ${newId} is already used on this device`);
  }
  const move = <E extends { teamId: string }>(list: E[]): E[] =>
    list.some((x) => x.teamId === oldId)
      ? list.map((x) => (x.teamId === oldId ? { ...x, teamId: newId } : x))
      : list;
  return {
    ...data,
    teams: data.teams.map((t) => (t.id === oldId ? { ...t, id: newId } : t)),
    players: move(data.players),
    seasons: move(data.seasons),
    matches: move(data.matches),
    presets: move(data.presets),
  };
}
