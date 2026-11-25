/**
 * v10: after a pull, a played set may name a player who isn't on this device (yet): repair leaves
 * played sets alone (`missingPlayer`) until the device that still has the player brings them
 * back. Everything that reads played sets must cope with an unknown player id.
 */
import { goldenTeamData, sliceOf } from '@/test-utils/syncFixtures';

import { en } from '../i18n/en';
import { lastRally } from './lastRally';
import { replaySet, replaySteps } from './liveSet';
import { liveCourtView } from './liveCourt';
import { buildLineupSheetHtml, type LineupSheetLabels } from './lineupSheet';
import { getMatchState } from './matchState';
import { matchPerformance, playerSeason, setPerformance } from './performance';
import { isPlayerInPlayedSet, isPlayerInSet } from './playerUsage';
import { buildScorerSheetHtml } from './scorerSheet';
import { matchStats, playerStatRows, seasonStats, setStats } from './stats';

const slice = sliceOf(goldenTeamData(), 't1');
const m1 = slice.matches[0];
// p1 starts, scores an ace and is on court; p8 comes on as a substitute.
const players = slice.players.filter((p) => p.id !== 'p1' && p.id !== 'p8');
const played = m1.sets[0];

const sheetLabels: LineupSheetLabels = {
  documentTitle: 'Lineup · Tigers vs Eagles',
  opponent: 'Opponent',
  date: 'Date',
  venue: 'Venue',
  home: 'Home',
  away: 'Away',
  season: 'Season',
  setTitle: (n) => `Set ${n}`,
  net: 'Net',
  positionShort: (n) => `P${n}`,
  emptySlot: '—',
  unknownPlayer: 'Unknown player',
  libero: 'Libero:',
  noLibero: 'none',
  liberoReplaces: (numbers) => `Libero replaces ${numbers}`,
  liberoOff: 'Libero off',
  offPositionNote: '* = plays a role that is none of their positions',
  captainMark: '(C)',
  serveFirst: 'First serve:',
  weServe: 'We serve',
  weReceive: 'We receive',
  server: '(serves)',
  noSets: 'No lineups yet.',
  roster: 'Roster',
  number: '#',
  name: 'Name',
  positions: 'Positions',
  status: 'Status',
  inactive: 'Injured',
  noPlayers: 'No players yet.',
  results: {
    heading: 'Result',
    won: 'Won',
    lost: 'Lost',
    inProgress: 'In progress',
    setsWon: 'Sets won:',
    setScore: (n, us, them, open) => `Set ${n} ${us}:${them}${open ? ' (in progress)' : ''}`,
    duration: 'Duration:',
    durationValue: (h, m) => (h > 0 ? `${h} h ${m} min` : `${m} min`),
  },
};

describe('played sets naming a player who is not on the device', () => {
  it('replay, live court and last rally work', () => {
    const state = replaySet(played, players);
    expect(state.score).toEqual(replaySet(played, slice.players).score);
    expect(replaySteps(played, players).length).toBe(played.events.length);
    expect(() => liveCourtView(played, state)).not.toThrow();
    expect(() => lastRally(played, players)).not.toThrow();
    expect(getMatchState(m1).sets.length).toBeGreaterThan(0);
  });

  it('stats and performance count them without a player record', () => {
    expect(setStats(played, players).players.p1?.aces).toBe(1);
    expect(() => matchStats(m1, players)).not.toThrow();
    expect(() => seasonStats(slice.matches, players)).not.toThrow();
    expect(
      playerStatRows(setStats(played, players), players).map((r) => r.player.id),
    ).not.toContain('p1');
    expect(setPerformance(played, players).players.p1?.rallies).toBeGreaterThan(0);
    expect(() => matchPerformance(m1, players)).not.toThrow();
    expect(() => playerSeason(slice.matches, players, 'p1')).not.toThrow();
  });

  it('print sheets and the delete check work', () => {
    const team = slice.team;
    const html = buildLineupSheetHtml({
      match: m1,
      team,
      players,
      labels: sheetLabels,
      withResults: true,
    });
    expect(html).toContain('<section class="set"');
    const scorer = buildScorerSheetHtml({
      team,
      players,
      match: m1,
      labels: { ...en.print.scorer.sheet, documentTitle: 'x' },
    });
    expect(scorer).toContain('<table');
    expect(isPlayerInSet(played, 'p8')).toBe(true);
    expect(isPlayerInPlayedSet(slice.matches, 'p1')).toBe(true);
  });
});
