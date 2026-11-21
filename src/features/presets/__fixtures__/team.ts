import type { Player, Position } from '@/domain/types';
import { useAppStore } from '@/store';

/** A 12-player roster: two setters, four outsides, three middles, one opposite, two liberos. */
const ROSTER: [number, string, Position][] = [
  [1, 'Sina', 'S'],
  [2, 'Olga', 'OH'],
  [3, 'Mara', 'MB'],
  [4, 'Opal', 'OPP'],
  [5, 'Ola', 'OH'],
  [6, 'Mia', 'MB'],
  [7, 'Lea', 'L'],
  [8, 'Sara', 'S'],
  [9, 'Otti', 'OH'],
  [10, 'Mona', 'MB'],
  [11, 'Oda', 'OH'],
  [12, 'Lou', 'L'],
];

export const rosterPlayers = (teamId: string): Player[] =>
  ROSTER.map(([number, firstName, position]) => ({
    id: `p${number}`,
    teamId,
    firstName,
    lastName: 'Test',
    number,
    positions: [position],
    active: true,
  }));

/** Profile "Coach" with team "Herren 1" (id team1) and 12 players, ready to render routes. */
export function seedTeam() {
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
    teams: [{ id: 'team1', profileId: 'prof', name: 'Herren 1', createdAt: '' }],
    players: rosterPlayers('team1'),
    currentProfileId: 'prof',
  });
}

/** A complete lineup p1–p6 with libero p7 replacing the middles. */
export const fullLineup = () => ({
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  liberoReplaces: ['p3', 'p6'],
});
