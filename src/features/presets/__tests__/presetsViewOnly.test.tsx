import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { TeamRole } from '@/domain/types';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { fullLineup, seedTeam } from '@/test-utils/presetsTeam';

/* v10: presets and starters for a view-only member (player role) of a shared team. */

const store = () => useAppStore.getState();
const s = t.presets.list;

function seed(role: TeamRole | null, withStarters = true) {
  seedTeam();
  if (role) {
    useAppStore.setState({
      sync: {
        deviceId: 'dev1',
        account: { userId: 'u1', email: 'a@example.test', profileId: 'prof' },
        teams: { team1: { userId: 'u1', role, cursor: 0, base: {}, edits: {}, photos: [] } },
      },
    });
  }
  const lineup = { ...fullLineup(), slots: { ...fullLineup().slots, 6: null } };
  store().addPreset({ teamId: 'team1', name: 'Strong serve', ...lineup });
  if (withStarters) store().setStarters('team1', fullLineup());
}

const presetId = () => store().presets.find((p) => p.kind === 'preset')!.id;

describe('presets, view only (v10)', () => {
  it('a viewer opens presets but cannot add, rename, copy or delete them', async () => {
    seed('player');
    await renderRouter('./app', { initialUrl: '/team/team1?tab=presets' });
    const row = await screen.findByTestId('preset-row-Strong serve');
    expect(screen.getByText(t.sync.readOnly.viewer)).toBeTruthy();
    expect(screen.queryByTestId('new-preset')).toBeNull();
    for (const label of [s.renameLabel, s.duplicateLabel, s.deleteLabel]) {
      expect(screen.queryByRole('button', { name: label('Strong serve') })).toBeNull();
    }

    await fireEvent.press(row);
    expect(screen).toHavePathname(`/team/team1/preset/${presetId()}`);
    const before = store().presets;
    const bench = await screen.findByTestId('bench');
    expect(screen.getByText(t.sync.readOnly.viewer)).toBeTruthy();
    expect(screen.queryByText(t.presets.editor.presetHint)).toBeNull();
    expect(screen.queryByTestId('rename-preset')).toBeNull();
    expect(screen.queryByTestId('template-open')).toBeNull();
    expect(screen.queryByTestId('formation-controls')).toBeNull();
    await fireEvent.press(within(bench).getByTestId('bench-player-8'));
    await fireEvent.press(screen.getByTestId('slot-empty-6'));
    expect(store().presets).toBe(before);
  });

  it('a viewer sees the starters without Edit; the editor route is read-only', async () => {
    seed('player');
    await renderRouter('./app', { initialUrl: '/team/team1?tab=starters' });
    expect(await screen.findByTestId('starters-court')).toBeTruthy();
    expect(screen.getByText(t.sync.readOnly.viewer)).toBeTruthy();
    expect(screen.queryByTestId('edit-starters')).toBeNull();
  });

  it('the starters editor for a viewer changes nothing', async () => {
    seed('player', false);
    await renderRouter('./app', { initialUrl: '/team/team1/starters' });
    const bench = await screen.findByTestId('bench');
    expect(screen.getByText(t.sync.readOnly.viewer)).toBeTruthy();
    await fireEvent.press(within(bench).getByTestId('bench-player-1'));
    await fireEvent.press(screen.getByTestId('slot-empty-1'));
    expect(store().presets.some((p) => p.kind === 'starters')).toBe(false);
  });

  it('without starters a viewer gets no "Set starters" button', async () => {
    seed('player', false);
    await renderRouter('./app', { initialUrl: '/team/team1?tab=starters' });
    expect(await screen.findByText(t.presets.starters.empty)).toBeTruthy();
    expect(screen.queryByTestId('edit-starters')).toBeNull();
  });

  it.each(['manager', null] as const)('a %s team keeps every preset control', async (role) => {
    seed(role);
    await renderRouter('./app', { initialUrl: '/team/team1?tab=presets' });
    expect(await screen.findByTestId('new-preset')).toBeTruthy();
    expect(screen.queryByTestId('read-only-note')).toBeNull();
    for (const label of [s.renameLabel, s.duplicateLabel, s.deleteLabel]) {
      expect(screen.getByRole('button', { name: label('Strong serve') })).toBeTruthy();
    }
    await fireEvent.press(screen.getByTestId('preset-row-Strong serve'));
    expect(await screen.findByTestId('rename-preset')).toBeTruthy();
    expect(screen.getByText(t.presets.editor.presetHint)).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('bench')).getByTestId('bench-player-10'));
    await fireEvent.press(screen.getByTestId('slot-empty-6'));
    expect(store().presets.find((p) => p.kind === 'preset')!.slots[6]).toBe('p10');
  });
});
