import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useAppStore } from '@/store';

import { fullLineup, seedTeam } from '../__fixtures__/team';

const hidden = { includeHiddenElements: true };
const roleAt = (position: number) => screen.getByTestId(`role-tag-${position}`, hidden);

describe('team starters tab — formation roles on empty spots (v6)', () => {
  beforeEach(() => seedTeam());

  it('shows every spot’s role from the formation, also on the empty spots', async () => {
    // Half filled: #1 on the setter spot 3, #3 on 4; a 6-2 with a middle after the setter:
    // S 3 · MB 4 · OH 5 · S 6 · MB 1 · OH 2.
    useAppStore.getState().setStarters('team1', {
      ...fullLineup(),
      slots: { 1: null, 2: null, 3: 'p1', 4: 'p3', 5: null, 6: null },
      liberoReplaces: [],
      formation: { system: '6-2', order: 'middle', setterAt: 3 },
    });
    await renderRouter('./app', { initialUrl: '/team/team1?tab=starters' });
    const court = await screen.findByTestId('starters-court');
    const expected = { 1: 'MB', 2: 'OH', 3: 'S', 4: 'MB', 5: 'OH', 6: 'S' } as const;
    for (const [pos, role] of Object.entries(expected))
      expect(roleAt(Number(pos))).toHaveTextContent(role);
    expect(screen.queryByTestId(/^role-tag-\d-off$/, hidden)).toBeNull();
    expect(court.props.accessibilityLabel).toMatch(
      /position 1 empty \(Middle Blocker\), position 2 empty \(Outside Hitter\), position 3 #1 Sina Test, plays Setter/,
    );
  });
});
