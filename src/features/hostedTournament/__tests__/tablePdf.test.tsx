/**
 * v12.3: "Table (PDF)" on the Table tab prints the table and the results.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { printHtml } from '@/lib/print';
import { useAppStore } from '@/store';
import { renderApp, resetStores } from '@/test-utils';

jest.mock('@/lib/print', () => ({ printHtml: jest.fn(() => Promise.resolve()) }));
const mockPrint = printHtml as jest.Mock;

const s = t.tournament;
const store = () => useAppStore.getState();

beforeEach(() => {
  resetStores();
  useAppStore.setState({ language: 'en' });
  resetStartupRedirect();
  mockPrint.mockClear();
  mockPrint.mockImplementation(() => Promise.resolve());
});

function seedCup(names: string[], plan: 'roundRobin' | 'manual' = 'roundRobin') {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const cup = store().addHostedTournament({
    profileId: profile.id,
    name: 'Winter Cup',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
    plan,
  });
  const teams = names.map((name) => store().addHostedTeam(cup.id, name));
  return { cup, teams };
}

const twoSets = [
  { a: 25, b: 20 },
  { a: 25, b: 22 },
];

describe('Table (PDF)', () => {
  it('is not offered while the table is empty', async () => {
    const { cup } = seedCup(['TV Nord']);
    await renderApp(`/tournament/${cup.id}?tab=table`);
    expect(screen.getByTestId('table-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('table-pdf')).toBeNull();
  });

  it('prints the table and the results under the tournament’s name', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals', 'Smash']);
    store().setHostedResult(cup.id, teams[1].id, teams[2].id, twoSets);
    await renderApp(`/tournament/${cup.id}?tab=table`);

    const button = screen.getByTestId('table-pdf');
    expect(button).toHaveTextContent(s.sheet.button);
    expect(button.props.accessibilityLabel).toBe(s.sheet.buttonLabel);
    await fireEvent.press(button);

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [html, options] = mockPrint.mock.calls[0] as [string, Record<string, string>];
    expect(options).toEqual({ title: 'Table · Winter Cup', dialogTitle: s.sheet.dialogTitle });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<p class="kicker">Table</p>');
    expect(html).toContain('best of 3 · 1 of 3 matches played');
    // Rivals lead with their win; the points are the last cell of the row.
    expect(html).toContain(
      '<td class="rank">1</td><td class="team">Rivals</td><td>1</td><td>1–0</td>' +
        '<td>2:0</td><td>+8</td><td class="points">2</td>',
    );
    expect(html).toContain('<td class="pair"><b>Rivals</b> – Smash</td>');
    expect(html).toContain(s.matches.resting('TV Nord'));
    expect(html).toContain(s.table.explain.matches);
    expect(screen.queryByTestId('table-pdf-error')).toBeNull();
  });

  it('prints the final table of a tournament with own matches', async () => {
    const { cup, teams } = seedCup(['Hosts', 'Guests'], 'manual');
    const match = store().addHostedMatch(cup.id, teams[0].id, teams[1].id);
    store().setHostedMatchSets((match as { id: string }).id, twoSets);
    await renderApp(`/tournament/${cup.id}?tab=table`);
    await fireEvent.press(screen.getByTestId('table-pdf'));

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const html = mockPrint.mock.calls[0][0] as string;
    expect(html).toContain(`<p class="kicker">${s.sheet.finalTitle}</p>`);
    expect(html).not.toContain('class="round"');
    expect(html).toContain('<td class="n">1</td><td class="pair"><b>Hosts</b> – Guests</td>');
  });

  it('is in German when the app is', async () => {
    const { cup } = seedCup(['TV Nord', 'Rivals']);
    useAppStore.setState({ language: 'de' });
    await renderApp(`/tournament/${cup.id}?tab=table`);
    expect(screen.getByTestId('table-pdf')).toHaveTextContent(de.tournament.sheet.button);
    await fireEvent.press(screen.getByTestId('table-pdf'));

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [html, options] = mockPrint.mock.calls[0] as [string, Record<string, string>];
    expect(options.title).toBe('Tabelle · Winter Cup');
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<th>Punkte</th>');
  });

  it('says so when printing fails, and can be tried again', async () => {
    const { cup } = seedCup(['TV Nord', 'Rivals']);
    mockPrint.mockImplementationOnce(() => Promise.reject(new Error('no printer')));
    await renderApp(`/tournament/${cup.id}?tab=table`);
    await fireEvent.press(screen.getByTestId('table-pdf'));
    expect(await screen.findByTestId('table-pdf-error')).toHaveTextContent(t.print.failed);

    await fireEvent.press(screen.getByTestId('table-pdf'));
    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('table-pdf-error')).toBeNull());
  });
});
