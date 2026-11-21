import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

import { fullLineup, seedTeam } from '../../presets/__fixtures__/team';

const store = () => useAppStore.getState();
const s = t.presets.apply;
const set = (n: number) => store().matches[0].sets.find((x) => x.setNumber === n);

function addMatch(sets = [emptySetLineup(1)]) {
  return store().addMatch({
    teamId: 'team1',
    opponent: 'Rivals',
    date: '2026-11-21',
    home: true,
    sets,
  });
}

beforeEach(seedTeam);

describe('presets in the match lineup builder', () => {
  it('uses the team starters for a set and reports injured players who were left out', async () => {
    store().setStarters('team1', fullLineup());
    store().updatePlayer('p4', { active: false });
    addMatch();
    await renderRouter('./app', { initialUrl: `/match/${store().matches[0].id}?set=2` });

    await fireEvent.press(await screen.findByTestId('use-starters'));
    expect(set(2)).toMatchObject({
      setNumber: 2,
      slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: null, 5: 'p5', 6: 'p6' },
      liberoId: 'p7',
      liberoReplaces: ['p3', 'p6'],
      weServeFirst: true,
      events: [],
    });
    expect(screen.getByTestId('preset-message')).toHaveTextContent(
      s.skipped(s.startersName, '#4 Opal Test'),
    );
  });

  it('applies a chosen preset, keeping the serve choice', async () => {
    store().addPreset({
      teamId: 'team1',
      name: 'Swap',
      ...fullLineup(),
      liberoId: 'p12',
      liberoReplaces: [],
    });
    store().addPreset({ teamId: 'team1', name: 'Other' });
    addMatch([{ ...emptySetLineup(1), weServeFirst: false }]);
    await renderRouter('./app', { initialUrl: `/match/${store().matches[0].id}?set=1` });

    expect((await screen.findByTestId('use-starters')).props.accessibilityState?.disabled).toBe(
      true,
    );
    expect(screen.getByText(s.noStarters)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('apply-preset'));
    expect(screen.getByTestId('preset-picker')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: s.presetLabel('Swap') }));
    expect(screen.queryByTestId('preset-picker')).toBeNull();
    expect(set(1)).toMatchObject({
      slots: fullLineup().slots,
      liberoId: 'p12',
      liberoReplaces: [], // copied as saved, no middles suggested on top
      weServeFirst: false,
    });
    expect(screen.getByTestId('preset-message')).toHaveTextContent(s.applied('Swap'));
  });

  it('is disabled when there is nothing to apply', async () => {
    addMatch();
    await renderRouter('./app', { initialUrl: `/match/${store().matches[0].id}` });
    expect((await screen.findByTestId('apply-preset')).props.accessibilityState?.disabled).toBe(
      true,
    );
    expect(screen.getByText(s.noPresets)).toBeTruthy();
  });

  it('is disabled for a played (locked) set', async () => {
    store().setStarters('team1', fullLineup());
    store().addPreset({ teamId: 'team1', name: 'Swap', ...fullLineup() });
    addMatch([{ ...emptySetLineup(1), events: [{ type: 'point', winner: 'us' }] }]);
    await renderRouter('./app', { initialUrl: `/match/${store().matches[0].id}?set=1` });
    expect((await screen.findByTestId('use-starters')).props.accessibilityState?.disabled).toBe(
      true,
    );
    expect(screen.getByTestId('apply-preset').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('use-starters'));
    expect(set(1)?.slots[1]).toBeNull();
    expect(screen.getByText(s.locked)).toBeTruthy();
  });

  it('shows German labels', async () => {
    store().setLanguage('de');
    try {
      addMatch();
      await renderRouter('./app', { initialUrl: `/match/${store().matches[0].id}` });
      expect(await screen.findByText(de.presets.apply.useStarters)).toBeTruthy();
      expect(screen.getByText(de.presets.apply.applyPreset)).toBeTruthy();
    } finally {
      store().setLanguage('en');
    }
  });
});

describe('new match', () => {
  async function createMatch() {
    await renderRouter('./app', { initialUrl: '/team/team1/match-new' });
    await fireEvent.changeText(await screen.findByLabelText(t.roster.matchForm.opponent), 'Rivals');
    await fireEvent.press(screen.getByRole('button', { name: t.roster.matchForm.create }));
    return store().matches[0];
  }

  it('pre-fills set 1 from complete team starters', async () => {
    store().setStarters('team1', fullLineup());
    const match = await createMatch();
    expect(match.sets).toEqual([{ ...emptySetLineup(1), ...fullLineup() }]);
    expect(screen).toHavePathname(`/match/${match.id}`);
    expect(await screen.findByTestId('slot-player-1')).toBeTruthy();
  });

  it('starts empty when the starters are incomplete', async () => {
    store().setStarters('team1', { ...fullLineup(), slots: { ...fullLineup().slots, 2: null } });
    const match = await createMatch();
    expect(match.sets).toEqual([emptySetLineup(1)]);
  });
});
