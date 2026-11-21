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
    expect(screen.getByTestId('use-starters').props.accessibilityHint).toBe(s.noStarters);
    expect(screen.getByTestId('apply-preset').props.accessibilityHint).toBe(s.applyPresetLabel);
    expect(screen.queryByText(s.noStarters)).toBeNull(); // no permanent hint lines
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
    expect(screen.getByTestId('apply-preset').props.accessibilityHint).toBe(s.noPresets);
    expect(screen.queryByText(s.noPresets)).toBeNull();
    // Switching sets remounts the controls once (no duplicate after a set change).
    await fireEvent.press(screen.getByTestId('set-tab-2'));
    expect(screen.getAllByTestId('apply-preset')).toHaveLength(1);
    expect(screen.getAllByTestId('template-open')).toHaveLength(1);
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
    expect(screen.getByTestId('use-starters').props.accessibilityHint).toBe(s.locked);
    expect(screen.getByTestId('apply-preset').props.accessibilityHint).toBe(s.locked);
  });

  it('treats empty starters (0/6, no libero) as no starters, so a set is never wiped', async () => {
    store().setStarters('team1', {
      slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
      liberoId: null,
      liberoReplaces: [],
    });
    addMatch([{ ...emptySetLineup(1), ...fullLineup() }]);
    await renderRouter('./app', { initialUrl: `/match/${store().matches[0].id}?set=1` });
    const button = await screen.findByTestId('use-starters');
    expect(button.props.accessibilityState?.disabled).toBe(true);
    expect(button.props.accessibilityHint).toBe(s.noStarters);
    await fireEvent.press(button);
    expect(set(1)?.slots).toEqual(fullLineup().slots);
  });

  it('allows starters that only have a libero', async () => {
    store().setStarters('team1', {
      slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
      liberoId: 'p7',
      liberoReplaces: [],
    });
    addMatch();
    await renderRouter('./app', { initialUrl: `/match/${store().matches[0].id}?set=1` });
    await fireEvent.press(await screen.findByTestId('use-starters'));
    expect(set(1)?.liberoId).toBe('p7');
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
