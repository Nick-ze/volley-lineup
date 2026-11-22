import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { seasonRefs } from '@/store/testSeason';

const store = () => useAppStore.getState();

beforeEach(() => {
  store().resetAll();
  useAppStore.setState({ hydrated: true });
});

it('blocks deleting a player who appears only in a point tag of a played set', async () => {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const team = store().addTeam({ profileId: profile.id, name: 'Herren 1' });
  const add = (number: number, lastName: string) =>
    store().addPlayer({
      teamId: team.id,
      firstName: 'A',
      lastName,
      number,
      positions: ['OH'],
      active: true,
    });
  const onCourt = add(1, 'Court');
  const tagged = add(2, 'Tagged');
  const match = store().addMatch({
    teamId: team.id,
    ...seasonRefs(team.id, 'X'),
    opponent: 'X',
    date: '2026-11-21',
    home: true,
  });
  store().setLineup(match.id, {
    ...match.sets[0],
    slots: { 1: onCourt.id, 2: null, 3: null, 4: null, 5: null, 6: null },
    events: [{ type: 'point', winner: 'us', kind: 'kill', playerId: tagged.id }],
  });

  await renderRouter('./app', { initialUrl: `/team/${team.id}/player?playerId=${tagged.id}` });
  expect(screen.getByText(t.roster.player.deleteBlocked)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: t.roster.player.delete }));
  expect(screen.queryByTestId('confirm')).toBeNull();
  expect(store().players.map((p) => p.id)).toContain(tagged.id);
});
