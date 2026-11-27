import { render, screen } from '@testing-library/react-native';
import type { NativeStackHeaderProps } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { headerVariant } from '@/lib/headerVariant';
import { darkColors, typography } from '@/theme';

import { AppHeader } from '../AppHeader';
import { HeaderTitle } from '../HeaderTitle';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

/** The header's props as the stack passes them (only what `AppHeader` reads). */
const props = (
  name: string,
  options: Partial<NativeStackHeaderProps['options']>,
): NativeStackHeaderProps =>
  ({
    route: { key: name, name },
    options,
    back: { title: undefined, href: undefined },
    navigation: {},
  }) as unknown as NativeStackHeaderProps;

describe('AppHeader', () => {
  it('has no bar: the page background, clear of the status bar', async () => {
    await render(<AppHeader {...props('match/[matchId]/index', { title: 'vs Rivals' })} />);
    const bar = StyleSheet.flatten(screen.getByTestId('app-header').props.style);
    expect(bar.backgroundColor).toBe(darkColors.background);
    expect(bar.paddingTop).toBe(24);
    expect(bar.borderBottomWidth).toBeUndefined();
  });

  it('compact: back, the title and the right button of the screen in one row', async () => {
    await render(
      <AppHeader
        {...props('match/[matchId]/live', {
          title: 'Live · Set 1',
          headerLeft: () => <Text>back</Text>,
          headerRight: () => <Text>Performance</Text>,
        })}
      />,
    );
    const title = screen.getByRole('header');
    expect(title).toHaveTextContent('Live · Set 1');
    expect(StyleSheet.flatten(title.props.style).fontSize).toBe(typography.displayM.fontSize);
    expect(screen.getByText('back')).toBeTruthy();
    expect(screen.getByText('Performance')).toBeTruthy();
  });

  it('large: the title of a browse screen on a row of its own', async () => {
    await render(
      <AppHeader
        {...props('team/[teamId]/index', {
          title: 'Herren 1',
          headerTitle: ({ children }) => <HeaderTitle>{children}</HeaderTitle>,
          headerRight: () => <Text>Share</Text>,
        })}
      />,
    );
    const title = screen.getByRole('header');
    expect(title).toHaveTextContent('Herren 1');
    expect(StyleSheet.flatten(title.props.style).fontSize).toBe(typography.displayL.fontSize);
    expect(screen.getByText('Share')).toBeTruthy();
  });

  it('shows a title given as `headerTitle` text', async () => {
    await render(<AppHeader {...props('join', { title: 'x', headerTitle: 'Join a team' })} />);
    expect(screen.getByRole('header')).toHaveTextContent('Join a team');
  });
});

describe('headerVariant', () => {
  it('browse screens are large, match screens and forms compact', () => {
    for (const name of [
      'team/[teamId]/index',
      'team/[teamId]/season/[seasonId]',
      'team/[teamId]/players/[playerId]',
      'team/[teamId]/members',
      'account/index',
      'account/sign-in',
      'account/teams',
      'join',
    ]) {
      expect(headerVariant(name)).toBe('large');
    }
    for (const name of [
      'match/[matchId]/index',
      'match/[matchId]/live',
      'match/[matchId]/rotation',
      'team/[teamId]/player',
      'team/[teamId]/preset/[presetId]',
      'team/[teamId]/starters',
      'something-else',
    ]) {
      expect(headerVariant(name)).toBe('compact');
    }
  });
});
