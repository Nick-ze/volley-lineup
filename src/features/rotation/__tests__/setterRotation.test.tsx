import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Player, SetLineup } from '@/domain/types';
import { useAppStore } from '@/store';

import { match, players, seedStore, set1 } from '../__fixtures__/seed';

const hidden = { includeHiddenElements: true };
const title = () => screen.getByTestId('rotation-title');
const next = () => fireEvent.press(screen.getByRole('button', { name: 'Next rotation' }));
const numberAt = (position: number, num: string) =>
  expect(within(screen.getByTestId(`spot-${position}`)).getByText(num)).toBeTruthy();
const roleAt = (position: number) => screen.getByTestId(`role-tag-${position}`, hidden);

/** The setter #1 starts at position 4. */
const setterAt4: SetLineup = {
  ...set1,
  slots: { 1: 'p4', 2: 'p5', 3: 'p6', 4: 'p1', 5: 'p2', 6: 'p3' },
};

function seedWith(set: SetLineup, extraPlayers: Player[] = []) {
  seedStore({ ...match, sets: [set] });
  if (extraPlayers.length > 0) useAppStore.setState({ players: [...players, ...extraPlayers] });
}

describe('rotation viewer — rotation named after the setter (v4)', () => {
  it('setter at 4 is "Rotation 4"; stepping goes 4 → 3 → 2 → 1 → 6 → 5 → 4', async () => {
    seedWith(setterAt4);
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    expect(await screen.findByText('Rotation 4 (setter on 4)')).toBeTruthy();
    numberAt(4, '1');
    const seen = [];
    for (let i = 0; i < 6; i += 1) {
      await next();
      seen.push(title().props.children);
    }
    expect(seen).toEqual([
      'Rotation 3 (setter on 3)',
      'Rotation 2 (setter on 2)',
      'Rotation 1 (setter on 1)',
      'Rotation 6 (setter on 6)',
      'Rotation 5 (setter on 5)',
      'Rotation 4 (setter on 4)',
    ]);
  });

  it('the 1–6 row jumps by the setter’s position', async () => {
    seedWith(setterAt4);
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 4 (setter on 4)');
    const row = screen.getByLabelText('Rotations');
    const labels = within(row)
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Show rotation ${n}`));

    await fireEvent.press(screen.getByRole('button', { name: 'Show rotation 1' }));
    expect(title()).toHaveTextContent('Rotation 1 (setter on 1)');
    numberAt(1, '1');
    await fireEvent.press(screen.getByRole('button', { name: 'Show rotation 6' }));
    numberAt(6, '1');
  });

  it('with two setters (6-2) the back-row setter names the rotation', async () => {
    // #4 plays setter too (off position): setters at 1 (#1, back row) and 4 (#4, front row).
    seedWith({ ...set1, roles: { p4: 'S' } });
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    // Each number comes up twice: title and jump buttons tell the two apart.
    expect(await screen.findByText('Rotation 1 (setter on 1), first time')).toBeTruthy();
    await next(); // setters at 6 and 3
    expect(title()).toHaveTextContent('Rotation 6 (setter on 6), first time');
    await next(); // 5 and 2
    expect(title()).toHaveTextContent('Rotation 5 (setter on 5), first time');
    await next(); // #1 front at 4, #4 back at 1
    expect(title()).toHaveTextContent('Rotation 1 (setter on 1), second time');
    numberAt(1, '4');
    const jumps = within(screen.getByLabelText('Rotations'))
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel);
    expect(jumps).toEqual([
      'Show rotation 1, first time',
      'Show rotation 1, second time',
      'Show rotation 5, first time',
      'Show rotation 5, second time',
      'Show rotation 6, first time',
      'Show rotation 6, second time',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Show rotation 6, second time' }));
    expect(title()).toHaveTextContent('Rotation 6 (setter on 6), second time');
  });

  it('without a setter on court the rotations are counted from the start', async () => {
    // #1 plays defensive specialist: nobody sets.
    seedWith({ ...set1, roles: { p1: 'DS' } });
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    expect(await screen.findByText('Rotation 1 of 6')).toBeTruthy();
    await next();
    expect(title()).toHaveTextContent('Rotation 2 of 6');
    await fireEvent.press(screen.getByRole('button', { name: 'Show rotation 5' }));
    expect(title()).toHaveTextContent('Rotation 5 of 6');
  });

  it('shows each role on top of the spot, "*" when it is none of the player’s positions', async () => {
    const wing2: Player = { ...players[4]!, id: 'p8', number: 8, positions: ['OH', 'OPP'] };
    // #8 plays opposite (secondary: no "*"), #3 plays outside (off position: "*").
    seedWith(
      {
        ...set1,
        slots: { ...set1.slots, 5: 'p8' },
        roles: { p8: 'OPP', p3: 'OH' },
        liberoReplaces: ['p6'],
      },
      [wing2],
    );
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 (setter on 1)');
    expect(roleAt(1)).toHaveTextContent('S');
    expect(roleAt(5)).toHaveTextContent('OPP');
    expect(screen.queryByTestId('role-tag-5-off', hidden)).toBeNull();
    expect(roleAt(3)).toHaveTextContent('OH');
    expect(screen.getByTestId('role-tag-3-off', hidden)).toBeTruthy();
    expect(
      screen.getByLabelText(
        /^Position 3, Front row: Number 3, .*plays Outside Hitter, not one of their positions$/,
      ),
    ).toBeTruthy();
    // The libero standing in for #6 shows "L".
    expect(roleAt(6)).toHaveTextContent('L');
    // Roles follow the players around: #3 (OH*) moves to 2.
    await next();
    expect(roleAt(2)).toHaveTextContent('OH');
  });

  it('a switched-off libero never swaps in and the toggle is replaced by a note', async () => {
    seedWith({ ...set1, liberoReplaces: ['p3', 'p6'], liberoActive: false });
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 (setter on 1)');
    expect(screen.getByTestId('libero-off-note')).toHaveTextContent(
      'Libero switched off for this set',
    );
    expect(screen.queryByRole('switch')).toBeNull();
    numberAt(6, '6');
    expect(screen.queryByTestId(/^libero-tag-/, hidden)).toBeNull();
    await next();
    numberAt(5, '6');
    expect(screen.queryByTestId(/^libero-tag-/, hidden)).toBeNull();
  });
});

describe('starters overview — roles and setter rotation (v4)', () => {
  it('shows role tags and the rotation named after the setter on each card', async () => {
    seedWith(setterAt4);
    await renderRouter('./app', { initialUrl: '/match/m1/starters' });
    expect(await screen.findByTestId('starters-rotation-1')).toHaveTextContent(
      'Rotation 4 (setter on 4)',
    );
    expect(roleAt(4)).toHaveTextContent('S');
    expect(roleAt(1)).toHaveTextContent('OPP');
  });
});
