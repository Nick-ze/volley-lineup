import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { PlayerChip } from '@/components';
import { emptySetLineup } from '@/domain/lineup';
import type { Player } from '@/domain/types';
import { SubPanel } from '@/features/live/SubPanel';
import { DeleteAllSection } from '@/features/settings/DeleteAllSection';
import { t } from '@/i18n/en';
import { useAppStore, usePhotoStore } from '@/store';

const URI = 'data:image/jpeg;base64,AAAA';
const hidden = { includeHiddenElements: true };

// v8: chips show the first name, so the distinct word is the first name.
const player = (n: number, first: string, photoId?: string): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: first,
  lastName: 'P',
  number: n,
  positions: ['OH'],
  active: true,
  ...(photoId ? { photoId } : {}),
});

const ana = player(7, 'Ace', 'ph7');
const ben = player(8, 'Block');

beforeEach(() => {
  useAppStore.getState().resetAll();
  useAppStore.setState({ hydrated: true, chipLabel: 'number' });
  usePhotoStore.setState({ photos: { ph7: URI }, hydrated: true });
});

describe('PlayerChip photos', () => {
  it('shows the photo with "#7 Name" only where asked (bench / pickers)', async () => {
    await render(<PlayerChip player={ana} showPhoto testID="chip" />);
    expect(screen.getByTestId('photo', hidden)).toBeTruthy();
    expect(screen.getByTestId('chip')).toHaveTextContent('#7 Ace', { exact: false });
  });

  it('court chips keep the number (or the name with chipLabel "name") over the faded photo', async () => {
    // v8.4: the photo sits behind the number at low opacity instead of replacing it.
    await render(<PlayerChip player={ana} testID="chip" />);
    const backdrop = screen.getByTestId('chip-backdrop', hidden);
    expect(within(backdrop).getByTestId('photo', hidden)).toBeTruthy();
    expect(backdrop).toHaveStyle({ opacity: 0.3 });
    expect(screen.getAllByTestId('photo', hidden)).toHaveLength(1);
    expect(screen.getByTestId('chip')).toHaveTextContent(/^7/);

    useAppStore.setState({ chipLabel: 'name' });
    await render(<PlayerChip player={ana} testID="chip" />);
    expect(screen.getByTestId('chip-backdrop', hidden)).toBeTruthy();
    expect(screen.getByTestId('chip-name')).toHaveTextContent('Ace');
  });

  it('shows the number without a backdrop when the player has no photo', async () => {
    await render(<PlayerChip player={ben} showPhoto testID="chip" />);
    expect(screen.queryByTestId('photo', hidden)).toBeNull();
    expect(screen.queryByTestId('chip-backdrop', hidden)).toBeNull();
    expect(screen.getByTestId('chip')).toHaveTextContent(/^8/);
  });

  it('without a name line, a photo chip shows the number over the faded photo', async () => {
    await render(<PlayerChip player={ana} showPhoto showName={false} testID="chip" />);
    expect(screen.getByTestId('chip-backdrop', hidden)).toBeTruthy();
    expect(screen.getByTestId('chip')).toHaveTextContent(/^7/);
  });

  it('the full photo on the bench has no backdrop', async () => {
    await render(<PlayerChip player={ana} showPhoto testID="chip" />);
    expect(screen.queryByTestId('chip-backdrop', hidden)).toBeNull();
  });
});

describe('bench and substitution picker', () => {
  it('the live substitution bench shows photos and still picks by tap', async () => {
    const onPickIn = jest.fn();
    await render(
      <SubPanel
        subsUsed={0}
        active
        outRef="#1 Out"
        bench={[ana, ben]}
        liberoRef={null}
        onStart={jest.fn()}
        onCancel={jest.fn()}
        onPickIn={onPickIn}
        warningsFor={() => []}
      />,
    );
    expect(within(screen.getByTestId('live-bench-7')).getByTestId('photo', hidden)).toBeTruthy();
    expect(within(screen.getByTestId('live-bench-8')).queryByTestId('photo', hidden)).toBeNull();
    await fireEvent.press(screen.getByTestId('live-bench-7'));
    expect(onPickIn).toHaveBeenCalledWith('p7');
  });

  it('the lineup bench shows photos; court chips show the number over the faded photo', async () => {
    const set1 = emptySetLineup(1);
    useAppStore.setState({
      profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
      teams: [{ id: 'team1', profileId: 'prof', name: 'Herren 1', createdAt: '' }],
      players: [ana, ben, player(1, 'One', 'ph7')],
      matches: [
        {
          id: 'm1',
          teamId: 'team1',
          seasonId: 's1',
          opponentId: 'o1',
          opponent: 'Rivals',
          date: '2026-11-20',
          home: true,
          sets: [{ ...set1, slots: { ...set1.slots, 1: 'p1' } }],
        },
      ],
      currentProfileId: 'prof',
    });
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    const bench = await screen.findByTestId('bench');
    expect(within(bench).getAllByTestId('photo', hidden)).toHaveLength(1);
    expect(within(bench).getByTestId('bench-player-7')).toHaveTextContent('#7 Ace', {
      exact: false,
    });
    // #1 (same photo) is on court: the number over the faded photo (v8.4).
    expect(screen.getAllByTestId('photo', hidden)).toHaveLength(2);
    expect(screen.getAllByTestId(/-backdrop$/, hidden).length).toBeGreaterThanOrEqual(1);
  });
});

describe('Delete all data', () => {
  it('mentions photos and deletes them', async () => {
    const profile = useAppStore.getState().addProfile({ name: 'Coach', color: '#FF6B00' });
    useAppStore.getState().updateProfile(profile.id, { photoId: 'ph7' });
    await render(<DeleteAllSection />);
    expect(screen.getByText(t.transfer.danger.hint)).toHaveTextContent(/photo/);
    await fireEvent.press(screen.getByRole('button', { name: t.transfer.danger.button }));
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(/photos/);
    await fireEvent.press(screen.getByRole('button', { name: t.transfer.danger.confirm }));
    expect(useAppStore.getState().profiles).toEqual([]);
    expect(usePhotoStore.getState().photos).toEqual({});
  });
});
