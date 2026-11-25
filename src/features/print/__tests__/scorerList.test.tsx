/**
 * v9.2: the player list for the scorer, from the team's Roster tab and from the match's
 * Print / PDF choice. Golden data: team t1 (captain p3 = #12, libero p7 = #1, p8 #10 injured),
 * match m1 (played, vs Rivals, 01.11.26, season 2026/27, home).
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { printHtml } from '@/lib/print';
import { renderApp, seedApp, seedGolden } from '@/test-utils';

jest.mock('@/lib/print', () => ({ printHtml: jest.fn(() => Promise.resolve()) }));
const mockPrint = printHtml as jest.Mock;

// Expo Router warns about modal routes rendered as the first screen; not what this tests.
beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

/** The table rows as "number|last|first|marks". */
function rows(html: string): string[] {
  const re =
    /<tr><td class="n">(\d+)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><td class="marks">(.*?)<\/td><\/tr>/g;
  return [...html.matchAll(re)].map((m) => m.slice(1).join('|'));
}

const GOLDEN_ROWS = [
  '1|Graf|Lia|L',
  '3|Müller|Anna|',
  '5|Frei|Zoë|',
  '7|Meier|Anna|',
  '9|Keller|Mia|',
  '12|Schmid|Lea|C',
  '14|Weber|Nora|',
];

function lastPrint(): [string, Record<string, string>] {
  return mockPrint.mock.calls.at(-1) as [string, Record<string, string>];
}

describe('player list for the scorer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prints from the Roster tab without a match line', async () => {
    seedGolden();
    await renderApp('/team/t1?tab=roster');
    const button = await screen.findByTestId('print-scorer-list');
    expect(button).toHaveTextContent('Player list (PDF)');
    expect(button.props.accessibilityLabel.startsWith('Player list (PDF)')).toBe(true);
    await fireEvent.press(button);

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [html, options] = lastPrint();
    expect(options).toEqual({
      title: 'Player list · Herren 1 – Süd',
      dialogTitle: 'Share player list',
    });
    expect(rows(html)).toEqual(GOLDEN_ROWS);
    expect(html).not.toContain('Bühler');
    expect(html).toContain('1 injured player not listed');
    expect(html).not.toContain('class="match"');
  });

  it('prints from the match’s Print / PDF choice with the match line', async () => {
    seedGolden();
    await renderApp('/match/m1');
    await fireEvent.press(await screen.findByTestId('print-sheet'));
    // m1 has results: both lineup choices and the scorer's list are offered.
    expect(await screen.findByTestId('print-with-results')).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText('Player list for the scorer: print the players and their numbers'),
    );

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [html, options] = lastPrint();
    expect(options.title).toBe('Player list · Herren 1 – Süd');
    expect(rows(html)).toEqual(GOLDEN_ROWS);
    expect(html).toContain('<p class="match">vs Rivals · 01.11.26 · 2026/27 · Home</p>');
    expect(screen.queryByTestId('print-choice')).toBeNull();
  });

  it('prints in German from both places', async () => {
    seedGolden('de');
    await renderApp('/team/t1?tab=roster');
    const button = await screen.findByTestId('print-scorer-list');
    expect(button).toHaveTextContent('Spielerliste (PDF)');
    expect(button.props.accessibilityLabel.startsWith('Spielerliste (PDF)')).toBe(true);
    await fireEvent.press(button);
    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [html, options] = lastPrint();
    expect(options).toEqual({
      title: 'Spielerliste · Herren 1 – Süd',
      dialogTitle: 'Spielerliste teilen',
    });
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<th class="n">Nr.</th><th>Name</th><th>Vorname</th>');
    expect(html).toContain('C = Kapitän · L = Libero');
  });

  it('prints in German from the match', async () => {
    seedGolden('de');
    await renderApp('/match/m1');
    await fireEvent.press(await screen.findByTestId('print-sheet'));
    const option = await screen.findByTestId('print-scorer');
    expect(option).toHaveTextContent('Spielerliste für den Schreiber');
    expect(option.props.accessibilityLabel.startsWith('Spielerliste für den Schreiber')).toBe(true);
    await fireEvent.press(option);
    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    expect(lastPrint()[0]).toContain(
      '<p class="match">gegen Rivals · 01.11.26 · 2026/27 · Heim</p>',
    );
  });

  it('shows an error when printing fails', async () => {
    seedGolden();
    mockPrint.mockRejectedValueOnce(new Error('no printer'));
    await renderApp('/team/t1?tab=roster');
    await fireEvent.press(await screen.findByTestId('print-scorer-list'));
    expect(await screen.findByTestId('print-scorer-error')).toHaveTextContent(
      'Printing failed. Please try again.',
    );
  });

  it('has no player list button on an empty roster', async () => {
    seedApp();
    await renderApp('/team/team1?tab=roster');
    await screen.findByText('Add player');
    expect(screen.queryByTestId('print-scorer-list')).toBeNull();
  });
});
