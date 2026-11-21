import { emptySetLineup } from '@/domain/lineup';
import type { Match, Player, Position, SetLineup } from '@/domain/types';
import { useAppStore } from '@/store';

const player = (id: string, number: number, lastName: string, positions: Position[]): Player => ({
  id,
  teamId: 'team1',
  firstName: lastName.slice(0, 1),
  lastName,
  number,
  positions,
  active: true,
});

export const players: Player[] = [
  player('p1', 1, 'Setter', ['S']),
  player('p2', 2, 'Outside', ['OH']),
  player('p3', 3, 'Middle', ['MB']),
  player('p4', 4, 'Oppo', ['OPP']),
  player('p5', 5, 'Wing', ['OH']),
  player('p6', 6, 'Block', ['MB']),
  player('p7', 7, 'Dig', ['L']),
];

export const set1: SetLineup = {
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  weServeFirst: true,
  liberoReplaces: [],
  events: [],
};

/** Set 2 starts one rotation further on, opponent serves. */
export const set2: SetLineup = {
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 2,
  slots: { 1: 'p2', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6', 6: 'p1' },
  liberoId: null,
  weServeFirst: false,
  liberoReplaces: [],
  events: [],
};

export const match: Match = {
  id: 'm1',
  teamId: 'team1',
  opponent: 'Rivals',
  date: '2026-11-20',
  home: true,
  sets: [set1, set2, emptySetLineup(3)],
};

export function seedStore(m: Match = match) {
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof1', name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01' }],
    teams: [{ id: 'team1', profileId: 'prof1', name: 'Herren 1', createdAt: '2026-01-01' }],
    players,
    matches: [m],
    currentProfileId: 'prof1',
  });
}
