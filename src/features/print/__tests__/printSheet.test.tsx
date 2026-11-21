import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import type { Player, SetLineup } from '@/domain/types';
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
    expect(screen.queryByTestId('print-error')).toBeNull();
  });

  it('shows an error when printing fails', async () => {
    mockPrint.mockRejectedValueOnce(new Error('no printer'));
    await renderRouter('./app', { initialUrl: '/match/m1' });
    await fireEvent.press(await screen.findByTestId('print-sheet'));
    expect(await screen.findByText('Printing failed. Please try again.')).toBeTruthy();
  });
});
