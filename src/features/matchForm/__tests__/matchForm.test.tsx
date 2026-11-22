import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Season } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

import { seedTeam } from '../../presets/__fixtures__/team';

const s = t.roster.matchForm;
const store = () => useAppStore.getState();

afterEach(() => store().setLanguage('en'));

const season = (id: string, name: string, startDate: string, over: Partial<Season> = {}) => ({
  id,
  teamId: 'team1',
  name,
  kind: 'season' as const,
  startDate,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});
const opp = (id: string, seasonId: string, name: string) => ({
  id,
  seasonId,
  name,
  createdAt: '2026-01-01T00:00:00Z',
});

/** Two seasons (2026/27 newest) and a tournament; opponents per season. */
function seedSeasons() {
  seedTeam();
  useAppStore.setState({
    seasons: [
      season('old', '2025/26', '2025-09-01'),
      season('new', '2026/27', '2026-09-01'),
      season('cup', 'Cup', '2026-05-01', { kind: 'tournament' }),
    ],
    opponents: [
      opp('o-munich', 'new', 'TSV München'),
      opp('o-lions', 'new', 'Lions'),
      opp('o-old', 'old', 'Old Rivals'),
    ],
  });
}

const radio = (name: string) => screen.getByRole('radio', { name });
const create = () => fireEvent.press(screen.getByRole('button', { name: s.create }));
const typeName = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);
const open = (query = '') => renderRouter('./app', { initialUrl: `/team/team1/match-new${query}` });

describe('new match form (v7.0)', () => {
  it('defaults to the newest season and creates the match against an opponent chip', async () => {
    seedSeasons();
    await open();
    expect(await screen.findByText(s.opponentChips('2026/27'))).toBeTruthy();
    expect(radio(t.roster.seasonLabel('2026/27', 'Season'))).toBeChecked();
    // The season's opponents only, by name.
    expect(screen.queryByText('Old Rivals')).toBeNull();
    await fireEvent.press(radio('Lions'));
    expect(radio('Lions')).toBeChecked();
    await create();
    expect(store().matches).toHaveLength(1);
    expect(store().matches[0]).toMatchObject({
      seasonId: 'new',
      opponentId: 'o-lions',
      opponent: 'Lions',
    });
    expect(store().opponents).toHaveLength(3);
    expect(screen).toHavePathname(`/match/${store().matches[0].id}`);
  });

  it('adds a typed new name to the season and links the match to it', async () => {
    seedSeasons();
    await open();
    await fireEvent.press(await screen.findByTestId('match-new-season-old'));
    expect(screen.getByText('Old Rivals')).toBeTruthy();
    await typeName(s.newOpponent, '  Eagles ');
    expect(screen.getByText(s.willAdd('Eagles', '2025/26'))).toBeTruthy();
    await create();
    const added = store().opponents.find((o) => o.name === 'Eagles');
    expect(added).toMatchObject({ seasonId: 'old' });
    expect(store().matches[0]).toMatchObject({
      seasonId: 'old',
      opponentId: added?.id,
      opponent: 'Eagles',
    });
  });

  it('uses the existing opponent for a name in other case or without accents', async () => {
    seedSeasons();
    await open();
    await typeName(s.newOpponent, 'tsv munchen');
    expect(radio('TSV München')).toBeChecked();
    expect(screen.getByText(s.existing('TSV München'))).toBeTruthy();
    await create();
    expect(store().opponents).toHaveLength(3);
    expect(store().matches[0]).toMatchObject({ opponentId: 'o-munich', opponent: 'TSV München' });
  });

  it('shows the required errors', async () => {
    seedSeasons();
    await open();
    await typeName(s.date, '2026-13-01');
    await create();
    expect(screen.getByText(t.roster.errors.required)).toBeTruthy();
    expect(screen.getByText(t.roster.errors.invalidDate)).toBeTruthy();
    expect(store().matches).toHaveLength(0);
  });

  it('puts the match into ?seasonId and shows that season instead of a choice', async () => {
    seedSeasons();
    await open('?seasonId=cup');
    expect(await screen.findByTestId('match-new-season')).toHaveTextContent('Cup · Tournament');
    expect(screen.queryByTestId('match-new-season-new')).toBeNull();
    await typeName(s.opponent, 'Lions');
    await create();
    // "Lions" of 2026/27 is another season's team, so the cup gets its own.
    expect(store().matches[0]).toMatchObject({ seasonId: 'cup', opponent: 'Lions' });
    expect(store().matches[0].opponentId).not.toBe('o-lions');
  });

  it('creates a season named in the form when the team has none', async () => {
    seedTeam();
    await open();
    const year = String(new Date().getFullYear());
    expect(await screen.findByLabelText(s.seasonName)).toHaveDisplayValue(year);
    expect(screen.getByText(s.seasonNew)).toBeTruthy();
    await typeName(s.seasonName, '');
    await typeName(s.opponent, 'Rivals');
    await create();
    expect(screen.getByText(t.roster.errors.required)).toBeTruthy();
    await typeName(s.seasonName, 'Liga 2026/27');
    await create();
    expect(store().seasons).toEqual([
      expect.objectContaining({ teamId: 'team1', name: 'Liga 2026/27', kind: 'season' }),
    ]);
    const [created] = store().seasons;
    expect(store().opponents).toEqual([
      expect.objectContaining({ seasonId: created.id, name: 'Rivals' }),
    ]);
    expect(store().matches[0]).toMatchObject({ seasonId: created.id, opponent: 'Rivals' });
  });

  it('is translated into German', async () => {
    seedSeasons();
    store().setLanguage('de');
    await open();
    expect(await screen.findByText(de.roster.matchForm.opponentChips('2026/27'))).toBeTruthy();
    expect(screen.getByLabelText(de.roster.matchForm.newOpponent)).toBeTruthy();
    expect(radio('Cup · Turnier')).toBeTruthy();
  });
});

describe('match screen (v7.0)', () => {
  it('shows the season under the result line', async () => {
    seedSeasons();
    const m = store().addMatch({
      teamId: 'team1',
      seasonId: 'cup',
      opponentId: 'o-x',
      opponent: 'X',
      date: '2026-05-02',
      home: true,
    });
    await renderRouter('./app', { initialUrl: `/match/${m.id}` });
    expect(await screen.findByTestId('match-season')).toHaveTextContent('Cup · Tournament');
  });
});
