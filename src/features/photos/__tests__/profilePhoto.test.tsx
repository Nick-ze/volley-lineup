import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { t } from '@/i18n/en';
import { pickPhoto } from '@/lib/pickPhoto';
import { useAppStore, usePhotoStore } from '@/store';

jest.mock('@/lib/pickPhoto', () => ({
  canTakePhoto: jest.fn(() => false),
  pickPhoto: jest.fn(),
}));

const pick = jest.mocked(pickPhoto);
const store = () => useAppStore.getState();
const photos = () => usePhotoStore.getState().photos;
const s = t.photos;
const URI_A = 'data:image/jpeg;base64,AAAA';
const URI_B = 'data:image/jpeg;base64,BBBB';
const hidden = { includeHiddenElements: true };

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const photoCount = () => screen.queryAllByTestId('photo', hidden).length;
/** v8.1.1: photos in the Profile tab only (the Teams tab is mounted beside it, hidden). */
const profileTabPhotoCount = () =>
  within(screen.getByTestId('app-tab-swipe-profile-pager', hidden)).queryAllByTestId(
    'photo',
    hidden,
  ).length;

beforeEach(() => {
  store().resetAll();
  store().setLanguage('en');
  useAppStore.setState({ hydrated: true });
  usePhotoStore.setState({ photos: {}, hydrated: true });
  resetStartupRedirect();
  pick.mockReset();
});

describe('profile photos', () => {
  it('creates a profile with a photo; the teams header shows it', async () => {
    pick.mockResolvedValue({ status: 'picked', dataUri: URI_A });
    await renderRouter('./app', { initialUrl: '/' });

    await fireEvent.changeText(screen.getByLabelText(t.roster.profiles.name), 'Coach');
    // The letter avatar until a photo is picked.
    expect(photoCount()).toBe(0);
    await press(s.add);
    await screen.findByText(s.unsaved);
    expect(photoCount()).toBe(1);
    expect(photos()).toEqual({});
    await press(t.roster.profiles.create);

    expect(screen).toHavePathname('/teams');
    const profile = store().profiles[0];
    expect(photos()).toEqual({ [profile.photoId as string]: URI_A });
    // The teams header (and the profile list underneath it in the stack) show the photo, as does
    // the Profile tab: v8.1.1 mounts all three app tabs up front (hidden until shown).
    expect(screen.getByTestId('teams-screen')).toBeTruthy();
    expect(photoCount()).toBe(3);
  });

  it('disables Create profile while a picked picture is being prepared', async () => {
    pick.mockReturnValue(new Promise(() => undefined));
    await renderRouter('./app', { initialUrl: '/' });
    await fireEvent.changeText(screen.getByLabelText(t.roster.profiles.name), 'Coach');
    await press(s.add);
    expect(screen.getByText(s.processing)).toBeTruthy();
    const create = screen.getByRole('button', { name: t.roster.profiles.create });
    expect(create).toBeDisabled();
    await fireEvent(screen.getByLabelText(t.roster.profiles.name), 'submitEditing');
    expect(store().profiles).toEqual([]);
  });

  it('changes and removes the photo in the Profile tab', async () => {
    const coach = store().addProfile({ name: 'Coach', color: '#FF6B00' });
    usePhotoStore.setState({ photos: { old: URI_A } }); // the photo exists before it's referenced
    store().updateProfile(coach.id, { photoId: 'old' });
    store().selectProfile(coach.id);
    await renderRouter('./app', { initialUrl: '/profile' });
    await screen.findByTestId('profile-card');
    expect(profileTabPhotoCount()).toBe(1);

    pick.mockResolvedValue({ status: 'picked', dataUri: URI_B });
    await fireEvent.press(screen.getByLabelText(t.profile.editLabel('Coach')));
    await press(s.change);
    await screen.findByText(s.unsaved);
    await press(t.common.save);
    const changed = store().profiles[0].photoId as string;
    expect(changed).not.toBe('old');
    expect(photos()).toEqual({ [changed]: URI_B });
    expect(profileTabPhotoCount()).toBe(1);

    await fireEvent.press(screen.getByLabelText(t.profile.editLabel('Coach')));
    await press(s.remove);
    // Unsaved: the Teams tab beside it still shows the stored photo, so only the Profile tab counts.
    expect(profileTabPhotoCount()).toBe(0);
    await press(t.common.save);
    expect(store().profiles[0].photoId).toBeUndefined();
    expect(photos()).toEqual({});
    expect(screen.getByTestId('profile-card')).toHaveTextContent(/C/);
    expect(photoCount()).toBe(0);
  });

  it('the profile list shows photos and edits them', async () => {
    const coach = store().addProfile({ name: 'Coach', color: '#FF6B00' });
    store().addProfile({ name: 'Other', color: '#3D8BFF' });
    usePhotoStore.setState({ photos: { p1: URI_A } }); // the photo exists before it's referenced
    store().updateProfile(coach.id, { photoId: 'p1' });
    await renderRouter('./app', { initialUrl: '/' });
    await screen.findByText(t.roster.profiles.heading);
    expect(photoCount()).toBe(1);

    pick.mockResolvedValue({ status: 'picked', dataUri: URI_B });
    await press(t.roster.profiles.rename('Other'));
    await press(s.add);
    await screen.findByText(s.unsaved);
    await press(t.common.save);
    const other = store().profiles[1];
    expect(other.photoId).toEqual(expect.any(String));
    expect(photos()).toEqual({ p1: URI_A, [other.photoId as string]: URI_B });
    expect(photoCount()).toBe(2);
  });
});
