import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

import { seedTeam } from '../../presets/__fixtures__/team';
import { parseTeamTab } from '../tabs';

const nav = t.presets.nav;

beforeEach(seedTeam);

describe('team nav bar', () => {
  it('parses ?tab= (unknown → roster)', () => {
    expect(parseTeamTab('presets')).toBe('presets');
    expect(parseTeamTab(['starters'])).toBe('starters');
    expect(parseTeamTab('stats')).toBe('stats');
    expect(parseTeamTab('nope')).toBe('roster');
    expect(parseTeamTab(undefined)).toBe('roster');
  });

  it('switches between Roster, Matches, Presets, Starters and Stats via the URL', async () => {
    await renderRouter('./app', { initialUrl: '/team/team1?tab=bogus' });
    const tab = (name: string) => screen.getByRole('tab', { name });
    expect(await screen.findByTestId('team-nav')).toBeTruthy();
    expect(tab(nav.roster)).toBeSelected();
    expect(screen.getByText(t.roster.team.playerCount(12))).toBeTruthy();

    await fireEvent.press(tab(nav.matches));
    expect(screen).toHaveSearchParams({ teamId: 'team1', tab: 'matches' });
    expect(tab(nav.matches)).toBeSelected();
    expect(tab(nav.roster)).not.toBeSelected();
    // v7: the Matches tab lists the team's seasons (matches live inside a season).
    expect(screen.getByText(t.seasons.list.empty)).toBeTruthy();

    await fireEvent.press(tab(nav.presets));
    expect(screen).toHaveSearchParams({ teamId: 'team1', tab: 'presets' });
    expect(screen.getByText(t.presets.list.empty)).toBeTruthy();

    await fireEvent.press(tab(nav.starters));
    expect(screen).toHaveSearchParams({ teamId: 'team1', tab: 'starters' });
    expect(screen.getByText(t.presets.starters.empty)).toBeTruthy();

    await fireEvent.press(tab(nav.stats));
    expect(screen).toHaveSearchParams({ teamId: 'team1', tab: 'stats' });
    expect(tab(nav.stats)).toBeSelected();
    expect(screen.getByText(t.stats.empty)).toBeTruthy();

    await fireEvent.press(tab(nav.roster));
    expect(screen.getByText(t.roster.team.playerCount(12))).toBeTruthy();
  });

  it('every tab is at least 44 px high and has a hint', async () => {
    await renderRouter('./app', { initialUrl: '/team/team1' });
    expect(await screen.findAllByRole('tab')).toHaveLength(5);
    for (const name of [nav.roster, nav.matches, nav.presets, nav.starters, nav.stats]) {
      const item = await screen.findByRole('tab', { name });
      expect(item.props.accessibilityHint).toBeTruthy();
    }
    const style = screen.getByTestId('team-tab-roster').props.style;
    const flat = Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('shows German labels', async () => {
    useAppStore.getState().setLanguage('de');
    try {
      await renderRouter('./app', { initialUrl: '/team/team1?tab=presets' });
      const names = [de.presets.nav.roster, de.presets.nav.matches, de.presets.nav.starters];
      for (const name of [...names, de.presets.nav.stats]) {
        expect(await screen.findByRole('tab', { name })).toBeTruthy();
      }
      expect(screen.getByRole('tab', { name: de.presets.nav.presets })).toBeSelected();
      expect(screen.getByText('Vorlagen')).toBeTruthy();
      expect(screen.getByText(de.presets.list.empty)).toBeTruthy();
    } finally {
      useAppStore.getState().setLanguage('en');
    }
  });
});
