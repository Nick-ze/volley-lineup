/**
 * Test helper (v7.0): the `seasonId` / `opponentId` for a new match of `teamId` against
 * `opponent` — the team's first season (created when there is none) and a new opponent.
 */
import { useAppStore } from './appStore';

export function seasonRefs(teamId: string, opponent: string) {
  const store = useAppStore.getState();
  const season =
    store.seasons.find((s) => s.teamId === teamId) ??
    store.addSeason({ teamId, name: '2026', kind: 'season' });
  const existing = useAppStore
    .getState()
    .opponents.find((o) => o.seasonId === season.id && o.name === opponent);
  const opp = existing ?? store.addOpponent(season.id, opponent);
  return { seasonId: season.id, opponentId: opp.id };
}
