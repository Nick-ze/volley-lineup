import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { t } from '@/i18n/en';
import { canTakePhoto, pickPhoto } from '@/lib/pickPhoto';
import { PHOTO_KEY_PREFIX, useAppStore, usePhotoStore } from '@/store';

jest.mock('@/lib/pickPhoto', () => ({
  canTakePhoto: jest.fn(() => false),
  pickPhoto: jest.fn(),
}));

const pick = jest.mocked(pickPhoto);
const camera = jest.mocked(canTakePhoto);
const store = () => useAppStore.getState();
const photos = () => usePhotoStore.getState().photos;
const s = t.photos;
const URI_A = 'data:image/jpeg;base64,AAAA';
const URI_B = 'data:image/jpeg;base64,BBBB';
const hidden = { includeHiddenElements: true };

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const type = async (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

/** Roster row → player detail → Edit (the player form). */
async function openForm(number: number, name: string) {
  await fireEvent.press(await screen.findByTestId(`player-${number}`));
  await fireEvent.press(
    await screen.findByRole('button', { name: t.playerDetail.editLabel(name) }),
  );
  await screen.findByLabelText(t.roster.player.firstName);
}

function seedTeam() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  return store().addTeam({ profileId: profile.id, name: 'Herren 1' });
}

function seedPlayer(teamId: string) {
  return store().addPlayer({
    teamId,
    firstName: 'Ana',
    lastName: 'Ace',
    number: 7,
    positions: ['S'],
    active: true,
  });
}

beforeEach(async () => {
  store().resetAll();
  useAppStore.setState({ hydrated: true });
  usePhotoStore.setState({ photos: {}, hydrated: true });
  resetStartupRedirect();
  await AsyncStorage.clear();
  pick.mockReset();
  camera.mockReturnValue(false);
});

describe('player photos', () => {
  it('adds a photo to a new player; the roster row shows it with the number', async () => {
    const team = seedTeam();
    pick.mockResolvedValue({ status: 'picked', dataUri: URI_A });
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await press(t.roster.roster.addPlayer);
    await screen.findByLabelText(t.roster.player.firstName);
    await type(t.roster.player.firstName, 'Ben');
    await type(t.roster.player.lastName, 'Block');
    await type(t.roster.player.number, '9');
    await fireEvent.press(screen.getByTestId('position-MB'));
    // No camera here: "Add photo" goes straight to the gallery / file chooser.
    await press(s.add);
    expect(pick).toHaveBeenCalledWith('library');
    await screen.findByText(s.unsaved);
    // Not stored before Save.
    expect(photos()).toEqual({});

    await press(t.common.save);
    const player = store().players[0];
    expect(player.photoId).toEqual(expect.any(String));
    expect(photos()).toEqual({ [player.photoId as string]: URI_A });

    await screen.findByTestId('player-9');
    expect(screen.getByTestId('player-9-photo-number', hidden)).toHaveTextContent('9');
    expect(screen.getAllByTestId('photo', hidden)).toHaveLength(1);
    // Saved under its own storage key.
    expect(await AsyncStorage.getItem(`${PHOTO_KEY_PREFIX}${player.photoId}`)).toBe(URI_A);
  });

  it('changes a photo (new id, old one deleted) and removes it (number fallback)', async () => {
    const team = seedTeam();
    const ana = seedPlayer(team.id);
    store().updatePlayer(ana.id, { photoId: 'old' });
    usePhotoStore.setState({ photos: { old: URI_A } });
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await screen.findByTestId('player-7');
    expect(screen.getByTestId('player-7-photo-number', hidden)).toBeTruthy();

    // Change, choosing between camera and gallery where the camera exists.
    camera.mockReturnValue(true);
    pick.mockResolvedValue({ status: 'picked', dataUri: URI_B });
    await openForm(7, 'Ana Ace');
    await press(s.change);
    await press(s.takePhoto);
    expect(pick).toHaveBeenCalledWith('camera');
    await screen.findByText(s.unsaved);
    await press(t.common.save);
    const changed = store().players[0].photoId as string;
    expect(changed).not.toBe('old');
    expect(photos()).toEqual({ [changed]: URI_B });

    // Remove (Save went back to the player detail screen).
    await fireEvent.press(
      await screen.findByRole('button', { name: t.playerDetail.editLabel('Ana Ace') }),
    );
    await press(s.remove);
    expect(screen.getByText(s.removed)).toBeTruthy();
    expect(screen.getByRole('button', { name: s.add })).toBeTruthy();
    await press(t.common.save);
    expect(store().players[0].photoId).toBeUndefined();
    expect(photos()).toEqual({});
    await fireEvent.press(await screen.findByTestId('header-back'));
    await screen.findByTestId('player-7');
    expect(screen.queryByTestId('player-7-photo-number', hidden)).toBeNull();
    expect(screen.queryByTestId('photo', hidden)).toBeNull();
    expect(screen.getByTestId('player-7')).toHaveTextContent(/7/);
  });

  it('cancel keeps the photo; Cancel in the form discards a picked one', async () => {
    const team = seedTeam();
    const ana = seedPlayer(team.id);
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });

    camera.mockReturnValue(true);
    await openForm(7, 'Ana Ace');
    await press(s.add);
    await press(s.cancelChoiceLabel); // the camera / gallery choice
    expect(pick).not.toHaveBeenCalled();

    pick.mockResolvedValue({ status: 'cancelled' });
    await press(s.add);
    await press(s.choosePhoto);
    await waitFor(() => expect(screen.getByRole('button', { name: s.add })).toBeEnabled());
    expect(screen.queryByTestId('photo-note')).toBeNull();

    pick.mockResolvedValue({ status: 'picked', dataUri: URI_A });
    await press(s.add);
    await press(s.choosePhoto);
    await screen.findByText(s.unsaved);
    await press(t.common.cancel); // the form
    expect(store().players.find((p) => p.id === ana.id)?.photoId).toBeUndefined();
    expect(photos()).toEqual({});
  });

  it('disables Save while a picked picture is being prepared', async () => {
    const team = seedTeam();
    seedPlayer(team.id);
    let finish: (dataUri: string) => void = () => undefined;
    pick.mockReturnValue(
      new Promise((resolve) => {
        finish = (dataUri) => resolve({ status: 'picked', dataUri });
      }),
    );
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await openForm(7, 'Ana Ace');
    await press(s.add);

    expect(screen.getByText(s.processing)).toBeTruthy();
    const save = screen.getByRole('button', { name: t.common.save });
    expect(save).toBeDisabled();
    await fireEvent.press(save);
    expect(store().players[0].photoId).toBeUndefined();

    await act(async () => finish(URI_A));
    expect(await screen.findByText(s.unsaved)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.common.save })).toBeEnabled();
    await press(t.common.save);
    expect(photos()).toEqual({ [store().players[0].photoId as string]: URI_A });
  });

  it('explains a refused permission and a picture that could not be loaded', async () => {
    const team = seedTeam();
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await press(t.roster.roster.addPlayer);

    pick.mockResolvedValue({ status: 'denied' });
    await press(s.add);
    expect(await screen.findByText(s.denied)).toBeTruthy();

    pick.mockResolvedValue({ status: 'failed' });
    await press(s.add);
    expect(await screen.findByText(s.failed)).toBeTruthy();
    expect(screen.getByRole('button', { name: s.add })).toBeTruthy();
  });
});
