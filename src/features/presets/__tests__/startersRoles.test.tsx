import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useAppStore } from '@/store';

import { fullLineup, seedTeam } from '@/test-utils/presetsTeam';

const hidden = { includeHiddenElements: true };

describe('team starters tab — role tags (v4)', () => {
  beforeEach(() => seedTeam());

  it('shows each starter’s role on the court, "*" when it is none of their positions', async () => {
    // #2 (outside) stands on the opposite spot 4 (v6: the spot decides): off position.
    const lineup = fullLineup();
    useAppStore
      .getState()
      .setStarters('team1', { ...lineup, slots: { ...lineup.slots, 2: 'p4', 4: 'p2' } });
    await renderRouter('./app', { initialUrl: '/team/team1?tab=starters' });
    const court = await screen.findByTestId('starters-court');
    expect(screen.getByTestId('role-tag-1', hidden)).toHaveTextContent('S');
    expect(screen.getByTestId('role-tag-4', hidden)).toHaveTextContent('OPP');
    expect(screen.getByTestId('role-tag-4-off', hidden)).toBeTruthy();
    expect(screen.queryByTestId('role-tag-1-off', hidden)).toBeNull();
    expect(court.props.accessibilityLabel).toMatch(
      /position 4 #2 Olga Test, plays Opposite, not one of their positions/,
    );
  });
});
