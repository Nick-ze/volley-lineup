import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useAppStore } from '@/store';

import { fullLineup, seedTeam } from '../__fixtures__/team';

const hidden = { includeHiddenElements: true };

describe('team starters tab — role tags (v4)', () => {
  beforeEach(() => seedTeam());

  it('shows each starter’s role on the court, "*" when it is none of their positions', async () => {
    // #2 (outside) plays opposite: off position.
    useAppStore.getState().setStarters('team1', { ...fullLineup(), roles: { p2: 'OPP' } });
    await renderRouter('./app', { initialUrl: '/team/team1?tab=starters' });
    const court = await screen.findByTestId('starters-court');
    expect(screen.getByTestId('role-tag-1', hidden)).toHaveTextContent('S');
    expect(screen.getByTestId('role-tag-2', hidden)).toHaveTextContent('OPP');
    expect(screen.getByTestId('role-tag-2-off', hidden)).toBeTruthy();
    expect(screen.queryByTestId('role-tag-1-off', hidden)).toBeNull();
    expect(court.props.accessibilityLabel).toMatch(
      /position 2 #2 Olga Test, plays Opposite, not one of their positions/,
    );
  });
});
