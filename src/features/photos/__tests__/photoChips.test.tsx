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

const player = (n: number, last: string, photoId?: string): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: 'P',
  lastName: last,
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

  it('court chips keep the number (or the name with chipLabel "name")', async () => {
    await render(<PlayerChip player={ana} testID="chip" />);
    expect(screen.queryByTestId('photo', hidden)).toBeNull();
    expect(screen.getByTestId('chip')).toHaveTextContent(/^7/);

    useAppStore.setState({ chipLabel: 'name' });
    await render(<PlayerChip player={ana} testID="chip" />);
    expect(screen.queryByTestId('photo', hidden)).toBeNull();
    expect(screen.getByTestId('chip-name')).toHaveTextContent('Ace');
  });

  it('falls back to the number without a photo or without a name line', async () => {
    await render(<PlayerChip player={ben} showPhoto testID="chip" />);
    expect(screen.queryByTestId('photo', hidden)).toBeNull();
    expect(screen.getByTestId('chip')).toHaveTextContent(/^8/);

    await render(<PlayerChip player={ana} showPhoto showName={false} testID="chip" />);
    expect(screen.queryByTestId('photo', hidden)).toBeNull();
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

  it('the lineup bench shows photos; court chips do not', async () => {
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
    // #1 (same photo) is on court: number only.
    expect(screen.getAllByTestId('photo', hidden)).toHaveLength(1);
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
