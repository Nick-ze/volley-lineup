import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import type { PointEvent, Player, SetLineup, Side } from '@/domain/types';
import { printHtml } from '@/lib/print';
import { useAppStore } from '@/store';

jest.mock('@/lib/print', () => ({ printHtml: jest.fn(() => Promise.resolve()) }));
const mockPrint = printHtml as jest.Mock;

const player = (n: number, first: string, last: string): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: first,
  lastName: last,
  number: n,
  positions: ['OH'],
  active: true,
});

const players = [1, 2, 3, 4, 5, 6, 7].map((n) => player(n, `First${n}`, `Last${n}`));

const set = (setNumber: SetLineup['setNumber'], weServeFirst: boolean): SetLineup => ({
  ...emptySetLineup(setNumber),
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  weServeFirst,
});

const points = (winner: Side, n: number): PointEvent[] =>
  Array.from({ length: n }, () => ({ type: 'point', winner }));

/** Match m1 after a few rallies: set 1 won 25:21, set 2 at 3:5. */
function playSome() {
  const [s1, s2, s3] = useAppStore.getState().matches[0].sets;
  useAppStore.setState((st) => ({
    matches: [
      {
        ...st.matches[0],
        sets: [
          { ...s1, events: [...points('them', 21), ...points('us', 25)] },
          { ...s2, events: [...points('us', 3), ...points('them', 5)] },
          s3,
        ],
      },
    ],
  }));
}

function seed() {
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
    teams: [{ id: 'team1', profileId: 'prof', name: 'Herren <1>', createdAt: '' }],
    players,
    matches: [
      {
        id: 'm1',
        teamId: 'team1',
        opponent: 'Rivals',
        date: '2026-11-20',
        home: false,
        sets: [set(1, true), set(2, false), set(3, true)],
      },
    ],
    currentProfileId: 'prof',
  });
}

describe('print lineup sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.getState().resetAll();
    seed();
  });

  it('builds the sheet for every set and sends it to the printer', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1' });
    const button = await screen.findByTestId('print-sheet');
    expect(button.props.accessibilityLabel).toMatch(/print the lineup sheet/i);
    await fireEvent.press(button);

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [html, options] = mockPrint.mock.calls[0] as [string, Record<string, string>];
    expect(options).toEqual({
      title: 'Lineup · Herren <1> vs Rivals',
      dialogTitle: 'Share lineup sheet',
    });
    expect(html).toContain('<h1>Herren &lt;1&gt;</h1>');
    expect(html).toContain('<dd>Away</dd>');
    for (const n of [1, 2, 3]) expect(html).toContain(`data-set="${n}"`);
    expect(html).toContain('First serve:</span> We receive');
    expect(html).toContain('<span class="name">First7 Last7</span>');
    expect(html).not.toContain('class="results"');
    expect(screen.queryByTestId('print-choice')).toBeNull(); // unplayed: no choice to make
    expect(screen.queryByTestId('print-error')).toBeNull();
  });

  it('prints in German with lang="de" when the app is in German', async () => {
    useAppStore.getState().setLanguage('de');
    try {
      await renderRouter('./app', { initialUrl: '/match/m1' });
      await fireEvent.press(await screen.findByTestId('print-sheet'));
      await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
      const [html, options] = mockPrint.mock.calls[0] as [string, Record<string, string>];
      expect(options).toEqual({
        title: 'Aufstellung · Herren <1> gegen Rivals',
        dialogTitle: 'Aufstellungsbogen teilen',
      });
      expect(html).toContain('<html lang="de">');
      expect(html).toContain('<dd>Auswärts</dd>');
      expect(html).toContain('Erster Aufschlag:</span> Gegner');
      expect(html).not.toContain('We receive');
    } finally {
      useAppStore.getState().setLanguage('en');
    }
  });

  it('offers "With results" for a played match and prints the set scores', async () => {
    playSome();
    await renderRouter('./app', { initialUrl: '/match/m1' });
    await fireEvent.press(await screen.findByTestId('print-sheet'));
    expect(await screen.findByText('What do you want to print?')).toBeTruthy();
    expect(screen.getByLabelText('What do you want to print?').props.testID).toBe('print-choice');
    expect(mockPrint).not.toHaveBeenCalled();

    await fireEvent.press(
      screen.getByLabelText('With results: print the lineups with the match result and set scores'),
    );
    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [html] = mockPrint.mock.calls[0] as [string];
    expect(html).toContain('<div class="final">In progress</div>');
    expect(html).toContain('Sets won:</span> 1:0');
    expect(html).toContain('Set 1 25:21');
    expect(html).toContain('Set 2 3:5 (in progress)');
    expect(screen.queryByTestId('print-choice')).toBeNull();
  });

  it('prints "Lineups only" without results, and Cancel prints nothing', async () => {
    playSome();
    await renderRouter('./app', { initialUrl: '/match/m1' });
    await fireEvent.press(await screen.findByTestId('print-sheet'));
    await fireEvent.press(await screen.findByLabelText('Cancel: don’t print'));
    expect(screen.queryByTestId('print-choice')).toBeNull();
    expect(mockPrint).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('print-sheet'));
    await fireEvent.press(
      await screen.findByLabelText('Lineups only: print the lineups without results'),
    );
    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [html] = mockPrint.mock.calls[0] as [string];
    expect(html).not.toContain('class="results"');
    for (const n of [1, 2, 3]) expect(html).toContain(`data-set="${n}"`);
  });

  it('asks and prints the results in German', async () => {
    useAppStore.getState().setLanguage('de');
    try {
      playSome();
      await renderRouter('./app', { initialUrl: '/match/m1' });
      await fireEvent.press(await screen.findByTestId('print-sheet'));
      await screen.findByTestId('print-choice');
      // Label in name (WCAG 2.5.3): every accessibility label starts with the visible text.
      for (const [id, text] of [
        ['print-with-results', 'Mit Ergebnissen'],
        ['print-lineups-only', 'Nur Aufstellungen'],
        ['print-cancel', 'Abbrechen'],
      ]) {
        expect(screen.getByTestId(id)).toHaveTextContent(text);
        expect(screen.getByTestId(id).props.accessibilityLabel.startsWith(text)).toBe(true);
      }
      expect(screen.getByLabelText('Was möchtest du drucken?').props.testID).toBe('print-choice');
      await fireEvent.press(screen.getByText('Mit Ergebnissen'));
      await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
      const [html] = mockPrint.mock.calls[0] as [string];
      expect(html).toContain('<h2>Ergebnis</h2>');
      expect(html).toContain('<div class="final">Läuft noch</div>');
      expect(html).toContain('Gewonnene Sätze:</span> 1:0');
      expect(html).toContain('Satz 2 3:5 (läuft noch)');
    } finally {
      useAppStore.getState().setLanguage('en');
    }
  });

  it('shows an error when printing fails', async () => {
    mockPrint.mockRejectedValueOnce(new Error('no printer'));
    await renderRouter('./app', { initialUrl: '/match/m1' });
    await fireEvent.press(await screen.findByTestId('print-sheet'));
    expect(await screen.findByText('Printing failed. Please try again.')).toBeTruthy();
  });
});
