import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import type { Formation, Player, SetLineup } from '@/domain/types';
import { rosterPlayers } from '@/test-utils/presetsTeam';
import { useAppStore, selectStarters } from '@/store';

/** The fixture roster, with Olga (#2, OH) also listed as an opposite. */
const players = (): Player[] =>
  rosterPlayers('team1').map((p) => (p.id === 'p2' ? { ...p, positions: ['OH', 'OPP'] } : p));

const EMPTY = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };

function seed(set: SetLineup = emptySetLineup(1)) {
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
    teams: [{ id: 'team1', profileId: 'prof', name: 'Herren 1', createdAt: '' }],
    players: players(),
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
const hidden = { includeHiddenElements: true };
const tagText = () =>
  [1, 2, 3, 4, 5, 6].map((p) => {
    const node = screen.getByTestId(`role-tag-${p}`, hidden);
    return within(node).getByText(/^[A-Z]+$/, hidden).props.children as string;
  });
const set1 = () => useAppStore.getState().matches[0].sets.find((s) => s.setNumber === 1)!;
const open = () => renderRouter('./app', { initialUrl: '/match/m1?set=1' });
const bench = (n: number) => within(screen.getByTestId('bench')).getByTestId(`bench-player-${n}`);

describe('lineup builder — formation on an empty court', () => {
  beforeEach(() => seed());

  it('shows the six roles of a 5-1 (setter → outside) on the empty spots', async () => {
    await open();
    await screen.findByTestId('slot-empty-1');
    expect(tagText()).toEqual(['S', 'OH', 'MB', 'OPP', 'OH', 'MB']);
    expect(screen.getByTestId('slot-empty-4').props.accessibilityLabel).toBe(
      'OPP, Opposite: empty position 4',
    );
    expect(screen.getByTestId('formation-pattern')).toHaveTextContent(
      'From the setter: S · OH · MB · OPP · OH · MB',
    );
    expect(screen.getByTestId('formation-system-5-1')).toBeChecked();
    expect(screen.getByTestId('formation-order-outside')).toBeChecked();
  });

  it('switching to 6-2 and to setter → middle changes the tags (pairs stay opposite)', async () => {
    await open();
    await fireEvent.press(
      await screen.findByRole('radio', {
        name: '6-2: two setters across from each other, the back-row one sets',
      }),
    );
    expect(set1().formation).toEqual({ system: '6-2', order: 'outside', setterAt: 1 });
    expect(tagText()).toEqual(['S', 'OH', 'MB', 'S', 'OH', 'MB']);
    await fireEvent.press(
      screen.getByRole('radio', { name: 'S → Middle: S · MB · OH · S · MB · OH' }),
    );
    expect(set1().formation).toEqual({ system: '6-2', order: 'middle', setterAt: 1 });
    expect(tagText()).toEqual(['S', 'MB', 'OH', 'S', 'MB', 'OH']);
    await fireEvent.press(screen.getByTestId('formation-system-5-1'));
    expect(tagText()).toEqual(['S', 'MB', 'OH', 'OPP', 'MB', 'OH']);
    expect(screen.getByTestId('formation-order-middle')).toBeChecked();
  });

  it('rotating moves the tags and the setter rotation (6-2: the back-row setter counts)', async () => {
    await open();
    expect(await screen.findByTestId('setter-rotation')).toHaveTextContent('Setter on 1');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate clockwise' }));
    expect(tagText()).toEqual(['OH', 'MB', 'OPP', 'OH', 'MB', 'S']);
    expect(screen.getByTestId('setter-rotation')).toHaveTextContent('Setter on 6');
    await fireEvent.press(screen.getByTestId('formation-system-6-2'));
    // Setters on 6 and 3: the back-row one (6) names the rotation.
    expect(tagText()).toEqual(['OH', 'MB', 'S', 'OH', 'MB', 'S']);
    expect(screen.getByTestId('setter-rotation')).toHaveTextContent('Setter on 6');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate clockwise' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate clockwise' }));
    // Setters on 4 and 1 → rotation 1.
    expect(screen.getByTestId('setter-rotation')).toHaveTextContent('Setter on 1');
  });
});

describe('lineup builder — off-position confirmation', () => {
  beforeEach(() => seed());

  it('tap-placing an unlisted player asks first: Cancel stores nothing', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('bench-player-5'));
    await fireEvent.press(screen.getByTestId('slot-empty-3')); // MB spot, Ola is an OH
    expect(screen.getByTestId('placement-confirm')).toHaveTextContent(
      /#5 Ola Test isn’t listed as Middle Blocker\..*Put them on this spot\?/,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel: nothing changes' }));
    expect(screen.queryByTestId('placement-confirm')).toBeNull();
    expect(useAppStore.getState().matches[0].sets[0].slots).toEqual(EMPTY);
    expect(bench(5)).toBeTruthy();
    // Ola is still selected: tapping a listed spot (OH at 2) places her without asking.
    expect(screen.getByText(/Selected: 5 Ola Test/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('slot-empty-2'));
    expect(screen.queryByTestId('placement-confirm')).toBeNull();
    expect(set1().slots[2]).toBe('p5');
  });

  it('Confirm places the player and marks the spot with "*"', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('bench-player-5'));
    await fireEvent.press(screen.getByTestId('slot-empty-3'));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Confirm: put them on the spot anyway' }),
    );
    expect(set1().slots[3]).toBe('p5');
    expect(screen.getByTestId('role-off-3', hidden)).toBeTruthy();
  });

  it('places listed positions (primary or secondary) without asking', async () => {
    await open();
    await fireEvent.press(await screen.findByTestId('bench-player-3'));
    await fireEvent.press(screen.getByTestId('slot-empty-3')); // Mara MB → MB
    await fireEvent.press(screen.getByTestId('bench-player-2'));
    await fireEvent.press(screen.getByTestId('slot-empty-4')); // Olga OH, OPP → OPP
    expect(screen.queryByTestId('placement-confirm')).toBeNull();
    expect(set1().slots).toMatchObject({ 3: 'p3', 4: 'p2' });
    expect(screen.queryByTestId('role-off-3', hidden)).toBeNull();
    expect(screen.queryByTestId('role-off-4', hidden)).toBeNull();
  });

  it('a swap names both players in one dialog; same-role swaps need none', async () => {
    seed({
      ...emptySetLineup(1),
      slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
    });
    await open();
    await fireEvent.press(await screen.findByTestId('slot-player-2'));
    await fireEvent.press(screen.getByTestId('slot-player-5')); // OH ↔ OH
    expect(screen.queryByTestId('placement-confirm')).toBeNull();
    expect(set1().slots).toMatchObject({ 2: 'p5', 5: 'p2' });

    await fireEvent.press(screen.getByTestId('slot-player-1'));
    await fireEvent.press(screen.getByTestId('slot-player-3')); // S ↔ MB
    const dialog = screen.getByTestId('placement-confirm');
    expect(dialog).toHaveTextContent(/#3 Mara Test isn’t listed as Setter\./);
    expect(dialog).toHaveTextContent(/#1 Sina Test isn’t listed as Middle Blocker\./);
    expect(dialog).toHaveTextContent(/Put them on these spots\?/);
    await fireEvent.press(screen.getByTestId('placement-cancel'));
    expect(set1().slots).toMatchObject({ 1: 'p1', 3: 'p3' });
    // Sina stays selected after Cancel: tapping Mara again asks again.
    await fireEvent.press(screen.getByTestId('slot-player-3'));
    await fireEvent.press(screen.getByTestId('placement-confirm-button'));
    expect(set1().slots).toMatchObject({ 1: 'p3', 3: 'p1' });
    expect(screen.getByTestId('role-off-1', hidden)).toBeTruthy();
    expect(screen.getByTestId('role-off-3', hidden)).toBeTruthy();
  });
});

describe('lineup builder — formation changes with players on court', () => {
  const full = (): SetLineup => ({
    ...emptySetLineup(1),
    slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  });

  it('asks before a new order puts starters on unlisted roles; Cancel keeps the formation', async () => {
    seed(full());
    await open();
    await fireEvent.press(await screen.findByTestId('formation-order-middle'));
    // S · MB · OH · OPP · MB · OH: Olga (OH, OPP) → MB, Mara (MB) → OH, Ola (OH) → MB, Mia (MB) → OH.
    const dialog = screen.getByTestId('placement-confirm');
    expect(dialog).toHaveTextContent(/#2 Olga Test isn’t listed as Middle Blocker\./);
    expect(dialog).toHaveTextContent(/#3 Mara Test isn’t listed as Outside Hitter\./);
    expect(dialog).toHaveTextContent(/#5 Ola Test isn’t listed as Middle Blocker\./);
    expect(dialog).toHaveTextContent(/#6 Mia Test isn’t listed as Outside Hitter\./);
    expect(dialog).toHaveTextContent(/Change the formation anyway\?/);
    await fireEvent.press(screen.getByTestId('placement-cancel'));
    expect(set1().formation).toEqual({ system: '5-1', order: 'outside', setterAt: 1 });
    expect(screen.getByTestId('formation-order-outside')).toBeChecked();

    await fireEvent.press(screen.getByTestId('formation-order-middle'));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Confirm: change the formation anyway' }),
    );
    expect(set1().formation.order).toBe('middle');
    expect(screen.getByTestId('role-off-3', hidden)).toBeTruthy();
  });

  it('a libero who replaced the middles follows them to the new middle spots', async () => {
    seed({ ...full(), liberoId: 'p7', liberoReplaces: ['p3', 'p6'] });
    await open();
    await fireEvent.press(await screen.findByTestId('formation-order-middle'));
    await fireEvent.press(screen.getByTestId('placement-confirm-button'));
    // Middle spots are now 2 and 5 (Olga, Ola).
    expect(set1().liberoReplaces).toEqual(['p2', 'p5']);
  });

  it('any other libero choice stays when the formation changes', async () => {
    seed({
      ...full(),
      slots: { ...full().slots, 4: 'p8' },
      liberoId: 'p7',
      liberoReplaces: ['p3'],
    });
    await open();
    await fireEvent.press(await screen.findByTestId('formation-system-6-2'));
    expect(set1().formation.system).toBe('6-2');
    expect(set1().liberoReplaces).toEqual(['p3']);
  });

  it('a 6-2 that puts the opposite on a setter spot asks', async () => {
    // 6-2 turns spot 4 into a setter spot: Opal (OPP) would be off position → asks.
    seed(full());
    await open();
    await fireEvent.press(await screen.findByTestId('formation-system-6-2'));
    expect(screen.getByTestId('placement-confirm')).toHaveTextContent(
      /#4 Opal Test isn’t listed as Setter\./,
    );
    await fireEvent.press(screen.getByTestId('placement-cancel'));
    expect(set1().formation.system).toBe('5-1');
  });

  it('a change that keeps everyone on a listed role, and rotating, never ask', async () => {
    // Sara (S) on 4: a 6-2 needs no confirmation.
    seed({ ...full(), slots: { ...full().slots, 4: 'p8' } });
    await open();
    await fireEvent.press(await screen.findByTestId('formation-system-6-2'));
    expect(screen.queryByTestId('placement-confirm')).toBeNull();
    expect(set1().formation.system).toBe('6-2');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate clockwise' }));
    expect(screen.queryByTestId('placement-confirm')).toBeNull();
    expect(set1().formation.setterAt).toBe(6);
  });
});

describe('lineup builder — formation in a played set', () => {
  it('locks system and order', async () => {
    seed({
      ...emptySetLineup(1),
      slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
      events: [{ type: 'point', winner: 'us' }],
    });
    await open();
    const sixTwo = await screen.findByTestId('formation-system-6-2');
    expect(sixTwo).toBeDisabled();
    await fireEvent.press(sixTwo);
    await fireEvent.press(screen.getByTestId('formation-order-middle'));
    expect(set1().formation).toEqual({ system: '5-1', order: 'outside', setterAt: 1 });
    expect(sixTwo.props.accessibilityHint).toMatch(/played/i);
  });
});

describe('lineup builder — templates set the formation system', () => {
  it('a 6-2 template switches the system and fills by role', async () => {
    seed();
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Fill from template' }));
    expect(screen.getByText(/it becomes the formation \(5-1 or 6-2\)/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Fill the starting six with a 6-2 system' }),
    );
    expect(set1().formation.system).toBe('6-2');
    expect(screen.getByTestId('formation-system-6-2')).toBeChecked();
    expect(tagText()).toEqual(['S', 'OH', 'MB', 'S', 'OH', 'MB']);
    expect(set1().slots).toMatchObject({ 1: 'p1', 4: 'p8' });
    expect(screen.getByTestId('template-message')).toHaveTextContent(
      'Formation set to 6-2, players filled in by role.',
    );
  });
});

describe('preset and team starters editors — formation', () => {
  const formation = (system: Formation['system'], order: Formation['order']) =>
    expect.objectContaining({ system, order });

  it('the preset editor shows and stores the formation', async () => {
    seed();
    const preset = useAppStore.getState().addPreset({
      teamId: 'team1',
      name: 'Alpha',
      slots: EMPTY,
      liberoId: null,
      liberoReplaces: [],
      formation: { system: '5-1', order: 'outside', setterAt: 1 },
      liberoActive: true,
    });
    await renderRouter('./app', { initialUrl: `/team/team1/preset/${preset.id}` });
    await screen.findByTestId('formation-controls');
    expect(tagText()).toEqual(['S', 'OH', 'MB', 'OPP', 'OH', 'MB']);
    await fireEvent.press(screen.getByTestId('formation-order-middle'));
    const stored = useAppStore.getState().presets.find((p) => p.id === preset.id)!;
    expect(stored.formation).toEqual(formation('5-1', 'middle'));
    expect(tagText()).toEqual(['S', 'MB', 'OH', 'OPP', 'MB', 'OH']);
  });

  it('the team starters editor shows the formation and asks before off-position moves', async () => {
    seed();
    await renderRouter('./app', { initialUrl: '/team/team1/starters' });
    await fireEvent.press(await screen.findByTestId('formation-system-6-2'));
    expect(selectStarters(useAppStore.getState(), 'team1')?.formation).toEqual(
      formation('6-2', 'outside'),
    );
    expect(tagText()).toEqual(['S', 'OH', 'MB', 'S', 'OH', 'MB']);
    await fireEvent.press(screen.getByTestId('bench-player-3'));
    await fireEvent.press(screen.getByTestId('slot-empty-4')); // Mara (MB) on a setter spot
    expect(screen.getByTestId('placement-confirm')).toHaveTextContent(/isn’t listed as Setter/);
    await fireEvent.press(screen.getByTestId('placement-confirm-button'));
    expect(selectStarters(useAppStore.getState(), 'team1')?.slots[4]).toBe('p3');
  });
});
