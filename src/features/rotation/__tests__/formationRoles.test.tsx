import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import type { SetLineup } from '@/domain/types';

import { match, seedStore, set1 } from '@/test-utils/rotationSeed';

const hidden = { includeHiddenElements: true };
const next = () => fireEvent.press(screen.getByRole('button', { name: 'Next rotation' }));
/** The role tags of positions 1–6 in the shown rotation. */
const roles = (scope: Pick<typeof screen, 'getByTestId'> = screen) =>
  [1, 2, 3, 4, 5, 6].map((p) => {
    const tag = scope.getByTestId(`role-tag-${p}`, hidden);
    return String(within(tag).getByText(/^[A-Z]+$/, hidden).props.children);
  });

/** An empty 5-1 set (setter followed by a middle), setter spot at 4. */
const emptyMiddle: SetLineup = {
  ...emptySetLineup(1),
  formation: { system: '5-1', order: 'middle', setterAt: 4 },
};

/** Half filled: setter #1 on the setter spot 1, #2 on 2, #3 on 3; 4–6 empty (6-2, outside). */
const halfSixTwo: SetLineup = {
  ...set1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: null, 5: null, 6: null },
  formation: { system: '6-2', order: 'outside', setterAt: 1 },
  liberoId: null,
};

describe('rotation viewer — the formation’s roles on every spot (v6)', () => {
  it('an empty court shows all six roles in every rotation, named after the setter spot', async () => {
    seedStore({ ...match, sets: [emptyMiddle] });
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    const title = await screen.findByTestId('rotation-title');
    const seen: [string, string[]][] = [];
    for (let i = 0; i < 6; i += 1) {
      seen.push([String(title.props.children), roles()]);
      await next();
    }
    // Positions 1–6. S · MB · OH · OPP · MB · OH around the court from the setter spot.
    expect(seen).toEqual([
      ['Rotation 4 (setter on 4)', ['OPP', 'MB', 'OH', 'S', 'MB', 'OH']],
      ['Rotation 3 (setter on 3)', ['MB', 'OH', 'S', 'MB', 'OH', 'OPP']],
      ['Rotation 2 (setter on 2)', ['OH', 'S', 'MB', 'OH', 'OPP', 'MB']],
      ['Rotation 1 (setter on 1)', ['S', 'MB', 'OH', 'OPP', 'MB', 'OH']],
      ['Rotation 6 (setter on 6)', ['MB', 'OH', 'OPP', 'MB', 'OH', 'S']],
      ['Rotation 5 (setter on 5)', ['OH', 'OPP', 'MB', 'OH', 'S', 'MB']],
    ]);
    // Back at the start: the setter spot 4 is empty.
    expect(screen.getByLabelText('Position 4, Front row: empty (Setter)')).toBeTruthy();
  });

  it('a half-filled 6-2 court shows the roles of the empty spots too', async () => {
    seedStore({ ...match, sets: [halfSixTwo] });
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 (setter on 1), first time');
    expect(roles()).toEqual(['S', 'OH', 'MB', 'S', 'OH', 'MB']);
    expect(screen.getByLabelText('Position 5, Back row: empty (Outside Hitter)')).toBeTruthy();
    await next();
    expect(roles()).toEqual(['OH', 'MB', 'S', 'OH', 'MB', 'S']);
    await next();
    await next();
    // Back where it started, but the second setter's (empty) spot is now at 1.
    expect(screen.getByTestId('rotation-title')).toHaveTextContent(
      'Rotation 1 (setter on 1), second time',
    );
    expect(roles()).toEqual(['S', 'OH', 'MB', 'S', 'OH', 'MB']);
    expect(screen.getByLabelText('Position 1, Back row: empty (Setter)')).toBeTruthy();
  });
});

describe('starters overview — roles on empty spots (v6)', () => {
  it('cards show every spot’s role and the setter-spot rotation, also when empty or half filled', async () => {
    seedStore({
      ...match,
      sets: [
        { ...halfSixTwo, setNumber: 1 },
        { ...emptyMiddle, setNumber: 2 },
      ],
    });
    await renderRouter('./app', { initialUrl: '/match/m1/starters' });
    const card1 = await screen.findByTestId('starters-card-1');
    const card2 = screen.getByTestId('starters-card-2');
    expect(roles(within(card1))).toEqual(['S', 'OH', 'MB', 'S', 'OH', 'MB']);
    expect(roles(within(card2))).toEqual(['OPP', 'MB', 'OH', 'S', 'MB', 'OH']);
    expect(screen.getByTestId('starters-rotation-2')).toHaveTextContent('Rotation 4 (setter on 4)');
    expect(card2.props.accessibilityLabel).toMatch(
      /position 1 empty \(Opposite\), .*position 4 empty \(Setter\)/,
    );
    expect(card2.props.accessibilityLabel).toMatch(/Rotation 4 \(setter on\s4\)\.$/);
  });
});
