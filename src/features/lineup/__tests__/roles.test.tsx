import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import type { Player, SetLineup } from '@/domain/types';
import { rosterPlayers } from '@/features/presets/__fixtures__/team';
import { useAppStore } from '@/store';

/** The fixture roster, with Olga (#2, OH) also listed as an opposite. */
const players = (): Player[] =>
  rosterPlayers('team1').map((p) => (p.id === 'p2' ? { ...p, positions: ['OH', 'OPP'] } : p));

const lineup = (over: Partial<SetLineup> = {}): SetLineup => ({
  ...emptySetLineup(1),
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  liberoReplaces: ['p3', 'p6'],
  ...over,
});

function seed(set: SetLineup = lineup(), roster: Player[] = players()) {
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
    teams: [{ id: 'team1', profileId: 'prof', name: 'Herren 1', createdAt: '' }],
    players: roster,
    matches: [
      {
        id: 'm1',
        teamId: 'team1',
        opponent: 'Rivals',
        date: '2026-11-20',
        home: true,
        sets: [set],
      },
    ],
    currentProfileId: 'prof',
  });
}

/** Role tags are hidden from screen readers (the spot's label says the role), so include hidden. */
const tag = (query: 'findByTestId' | 'getByTestId' | 'queryByTestId', id: string) =>
  screen[query](id, { includeHiddenElements: true });

const set1 = () => useAppStore.getState().matches[0].sets.find((s) => s.setNumber === 1)!;
const open = () => renderRouter('./app', { initialUrl: '/match/m1?set=1' });

async function pickRole(position: number, role: string) {
  await fireEvent.press(await screen.findByTestId(`slot-role-${position}`));
  await fireEvent.press(screen.getByTestId(`role-option-${role}`));
}

describe('lineup builder — roles', () => {
  beforeEach(() => seed());

  it('shows each starter’s role on top of the spot, in words in the label', async () => {
    await open();
    expect(await tag('findByTestId', 'role-tag-1')).toHaveTextContent('S');
    expect(tag('getByTestId', 'role-tag-3')).toHaveTextContent('MB');
    expect(tag('getByTestId', 'role-tag-4')).toHaveTextContent('OPP');
    expect(tag('queryByTestId', 'role-off-4')).toBeNull();
    expect(screen.getByTestId('slot-player-1').props.accessibilityLabel).toBe(
      'Position 1, 1 Sina Test, plays Setter',
    );
  });

  it('applies a listed (secondary) position directly, without asterisk', async () => {
    await open();
    await pickRole(2, 'OPP');
    expect(screen.queryByTestId('role-confirm')).toBeNull();
    expect(set1().roles).toEqual({ p2: 'OPP' });
    expect(tag('getByTestId', 'role-tag-2')).toHaveTextContent('OPP');
    expect(tag('queryByTestId', 'role-off-2')).toBeNull();
  });

  it('asks before an unlisted role: cancel keeps, confirm stores and marks it', async () => {
    await open();
    await pickRole(4, 'S');
    expect(
      screen.getByText('#4 Opal Test isn’t listed as Setter. Play them as Setter?'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('role-confirm-cancel'));
    expect(screen.queryByTestId('role-confirm')).toBeNull();
    expect(set1().roles).toEqual({});
    expect(tag('getByTestId', 'role-tag-4')).toHaveTextContent('OPP');

    await pickRole(4, 'S');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm: play as Setter' }));
    expect(set1().roles).toEqual({ p4: 'S' });
    expect(tag('getByTestId', 'role-off-4')).toBeTruthy();
    expect(screen.getByTestId('slot-player-4').props.accessibilityLabel).toMatch(
      /plays Setter, not one of their positions/,
    );

    // The primary position again removes the override (no confirmation).
    await pickRole(4, 'OPP');
    expect(screen.queryByTestId('role-confirm')).toBeNull();
    expect(set1().roles).toEqual({});
    expect(tag('queryByTestId', 'role-off-4')).toBeNull();
  });

  it('while a player is selected, the role tag places / swaps like the spot', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('slot-player-1'));
    await fireEvent.press(screen.getByTestId('slot-role-4'));
    expect(screen.queryByTestId('role-picker')).toBeNull();
    expect(set1().slots[1]).toBe('p4');
    expect(set1().slots[4]).toBe('p1');
  });

  it('ignores a press on the role tag that moved (a drag)', async () => {
    await open();
    const roleTag = await screen.findByTestId('slot-role-2');
    await fireEvent(roleTag, 'pressIn', { nativeEvent: { pageX: 10, pageY: 10 } });
    await fireEvent(roleTag, 'press', { nativeEvent: { pageX: 60, pageY: 40 } });
    expect(screen.queryByTestId('role-picker')).toBeNull();
    await fireEvent(roleTag, 'pressIn', { nativeEvent: { pageX: 10, pageY: 10 } });
    await fireEvent(roleTag, 'press', { nativeEvent: { pageX: 12, pageY: 11 } });
    expect(screen.getByTestId('role-picker')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel: close the role choice' }));
    expect(screen.queryByTestId('role-picker')).toBeNull();
  });

  it('rotates the starting six both ways, roles following the players', async () => {
    seed(lineup({ roles: { p2: 'OPP' } }));
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Rotate clockwise' }));
    expect(set1().slots).toEqual({ 1: 'p2', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6', 6: 'p1' });
    expect(tag('getByTestId', 'role-tag-1')).toHaveTextContent('OPP');
    expect(tag('getByTestId', 'role-tag-6')).toHaveTextContent('S');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate counter-clockwise' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate counter-clockwise' }));
    expect(set1().slots).toEqual({ 1: 'p6', 2: 'p1', 3: 'p2', 4: 'p3', 5: 'p4', 6: 'p5' });
  });

  it('locks rotating and roles in a played set', async () => {
    seed(lineup({ events: [{ type: 'point', winner: 'us' }] }));
    await open();
    const rotate = await screen.findByRole('button', { name: 'Rotate clockwise' });
    expect(rotate).toBeDisabled();
    await fireEvent.press(rotate);
    expect(set1().slots[1]).toBe('p1');
    expect(screen.getByTestId('slot-role-1')).toBeDisabled();
  });

  it('disables rotating on an empty court', async () => {
    seed(lineup({ slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } }));
    await open();
    expect(await screen.findByRole('button', { name: 'Rotate clockwise' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rotate counter-clockwise' })).toBeDisabled();
  });
});

describe('lineup builder — libero by role and on/off', () => {
  beforeEach(() => seed());

  it('sets whom the libero replaces by role (several at once)', async () => {
    await open();
    expect(await screen.findByTestId('libero-role-MB')).toBeChecked();
    await fireEvent.press(screen.getByTestId('libero-role-OH'));
    expect(set1().liberoReplaces).toEqual(['p3', 'p6', 'p2', 'p5']);
    await fireEvent.press(screen.getByTestId('libero-role-MB'));
    expect(set1().liberoReplaces).toEqual(['p2', 'p5']);
    expect(screen.getByTestId('libero-role-DS')).toBeDisabled();
    // Single players can still be toggled.
    await fireEvent.press(screen.getByTestId('libero-replaces-2'));
    expect(set1().liberoReplaces).toEqual(['p5']);
  });

  it('switches the libero off and on', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('libero-plays'));
    expect(set1().liberoActive).toBe(false);
    expect(screen.getByTestId('libero-out')).toHaveTextContent(/stays out/);
    expect(screen.getByTestId('libero-role-OH')).toBeDisabled();
    expect(screen.getByTestId('libero-replaces-3')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('libero-plays'));
    expect(set1().liberoActive).toBe(true);
    expect(screen.queryByTestId('libero-out')).toBeNull();
  });
});

describe('lineup builder — templates set roles', () => {
  it('lets an opposite on a 6-2 hitter spot play OH (marked off position, no dialog)', async () => {
    // Only one outside is available, so the second hitter spot takes the opposite.
    const roster = players().map((p) =>
      ['p5', 'p9', 'p11'].includes(p.id) ? { ...p, active: false } : p,
    );
    seed(lineup({ slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } }), roster);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Fill from template' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Fill the starting six with a 6-2 system' }),
    );
    expect(screen.queryByTestId('role-confirm')).toBeNull();
    expect(set1().slots[5]).toBe('p4');
    expect(set1().roles).toEqual({ p4: 'OH' });
    expect(tag('getByTestId', 'role-tag-5')).toHaveTextContent('OH');
    expect(tag('getByTestId', 'role-off-5')).toBeTruthy();
  });
});

describe('preset editor — roles', () => {
  it('changes a role with confirmation and stores it on the preset', async () => {
    seed();
    const preset = useAppStore.getState().addPreset({
      teamId: 'team1',
      name: 'Alpha',
      slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
      liberoId: 'p7',
      liberoReplaces: ['p3', 'p6'],
      roles: {},
      liberoActive: true,
    });
    await renderRouter('./app', { initialUrl: `/team/team1/preset/${preset.id}` });
    await pickRole(3, 'OH');
    await fireEvent.press(screen.getByTestId('role-confirm-ok'));
    const stored = () => useAppStore.getState().presets.find((p) => p.id === preset.id)!;
    expect(stored().roles).toEqual({ p3: 'OH' });
    expect(tag('getByTestId', 'role-off-3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate clockwise' }));
    expect(stored().slots[2]).toBe('p3');
  });
});
