import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import type { Player, SetLineup } from '@/domain/types';
import { includeHidden } from '@/test-utils';
import { rosterPlayers } from '@/test-utils/presetsTeam';
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
        seasonId: 's1',
        opponentId: 'o1',
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
  screen[query](id, includeHidden);

const set1 = () => useAppStore.getState().matches[0].sets.find((s) => s.setNumber === 1)!;
const open = () => renderRouter('./app', { initialUrl: '/match/m1?set=1' });

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

  it('marks a role that is none of the player’s positions; a secondary one is fine (v6)', async () => {
    // Setter spot at 5: S 5 · OH 6 · MB 1 · OPP 2 · OH 3 · MB 4 (the formation decides).
    seed(lineup({ formation: { system: '5-1', order: 'outside', setterAt: 5 } }));
    await open();
    // Olga (OH, OPP) on the OPP spot plays a listed position: no asterisk.
    expect(await tag('findByTestId', 'role-tag-2')).toHaveTextContent('OPP');
    expect(tag('queryByTestId', 'role-off-2')).toBeNull();
    // Ola (OH) on the setter spot: off position.
    expect(tag('getByTestId', 'role-tag-5')).toHaveTextContent('S');
    expect(tag('getByTestId', 'role-off-5')).toBeTruthy();
    expect(screen.getByTestId('slot-player-5').props.accessibilityLabel).toMatch(
      /plays Setter, not one of their positions/,
    );
    // No role picker any more: the role belongs to the spot.
    expect(screen.queryByTestId('role-picker')).toBeNull();
  });

  it('while a player is selected, the role tag places / swaps like the spot', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('slot-player-1'));
    await fireEvent.press(screen.getByTestId('slot-role-4'));
    expect(screen.queryByTestId('role-picker')).toBeNull();
    // Setter ↔ opposite: both end up off position → confirm (v6).
    await fireEvent.press(screen.getByTestId('placement-confirm-button'));
    expect(set1().slots[1]).toBe('p4');
    expect(set1().slots[4]).toBe('p1');
  });

  it('a press on the role tag selects the player like the chip, unless it moved (a drag)', async () => {
    await open();
    const roleTag = await screen.findByTestId('slot-role-2');
    await fireEvent(roleTag, 'pressIn', { nativeEvent: { pageX: 10, pageY: 10 } });
    await fireEvent(roleTag, 'press', { nativeEvent: { pageX: 60, pageY: 40 } });
    // The moved press selected nobody: this tap on #4's tag only selects #4 (no swap with #2).
    const tag4 = screen.getByTestId('slot-role-4');
    await fireEvent(tag4, 'pressIn', { nativeEvent: { pageX: 10, pageY: 10 } });
    await fireEvent(tag4, 'press', { nativeEvent: { pageX: 12, pageY: 11 } });
    expect(set1().slots).toEqual({ 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' });
    // #4 is selected now: tapping #1 swaps them (after confirming the off-position roles).
    await fireEvent.press(screen.getByTestId('slot-player-1'));
    await fireEvent.press(screen.getByTestId('placement-confirm-button'));
    expect(set1().slots[1]).toBe('p4');
    expect(set1().slots[4]).toBe('p1');
    expect(screen.queryByTestId('role-picker')).toBeNull();
  });

  it('rotates the starting six both ways, the formation (and so the roles) turning along', async () => {
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Rotate clockwise' }));
    expect(set1().slots).toEqual({ 1: 'p2', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6', 6: 'p1' });
    expect(set1().formation).toEqual({ system: '5-1', order: 'outside', setterAt: 6 });
    // Sina keeps S (now at 6), Olga keeps OH (now at 1).
    expect(tag('getByTestId', 'role-tag-6')).toHaveTextContent('S');
    expect(tag('getByTestId', 'role-tag-1')).toHaveTextContent('OH');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate counter-clockwise' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate counter-clockwise' }));
    expect(set1().slots).toEqual({ 1: 'p6', 2: 'p1', 3: 'p2', 4: 'p3', 5: 'p4', 6: 'p5' });
    expect(set1().formation.setterAt).toBe(2);
    expect(tag('getByTestId', 'role-tag-2')).toHaveTextContent('S');
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

  it('rotates the formation on an empty court too (v6: the spots have roles)', async () => {
    seed(lineup({ slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } }));
    await open();
    expect(await screen.findByTestId('setter-rotation')).toHaveTextContent('Setter on\u00a01');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate counter-clockwise' }));
    expect(set1().formation.setterAt).toBe(2);
    expect(tag('getByTestId', 'role-tag-2')).toHaveTextContent('S');
    expect(screen.getByTestId('setter-rotation')).toHaveTextContent('Setter on\u00a02');
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
      screen.getByRole('button', { name: '6-2: fill the starting six with a 6-2 system' }),
    );
    expect(screen.queryByTestId('role-confirm')).toBeNull();
    expect(set1().slots[5]).toBe('p4');
    expect(set1().formation.system).toBe('6-2');
    expect(tag('getByTestId', 'role-tag-5')).toHaveTextContent('OH');
    expect(tag('getByTestId', 'role-off-5')).toBeTruthy();
  });
});

describe('preset editor — roles', () => {
  it('rotating turns the formation with the players and stores it on the preset', async () => {
    seed();
    const preset = useAppStore.getState().addPreset({
      teamId: 'team1',
      name: 'Alpha',
      slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
      liberoId: 'p7',
      liberoReplaces: ['p3', 'p6'],
      formation: { system: '5-1', order: 'outside', setterAt: 1 },
      liberoActive: true,
    });
    await renderRouter('./app', { initialUrl: `/team/team1/preset/${preset.id}` });
    const stored = () => useAppStore.getState().presets.find((p) => p.id === preset.id)!;
    expect(await tag('findByTestId', 'role-tag-1')).toHaveTextContent('S');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate clockwise' }));
    expect(stored().slots[2]).toBe('p3');
    expect(stored().formation).toEqual({ system: '5-1', order: 'outside', setterAt: 6 });
    expect(tag('getByTestId', 'role-tag-6')).toHaveTextContent('S');
  });
});
