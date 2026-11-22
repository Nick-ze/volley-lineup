import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { t } from '@/i18n/en';
import { pickPhoto } from '@/lib/pickPhoto';
import { useAppStore, usePhotoStore } from '@/store';
import { seasonRefs } from '@/store/testSeason';

jest.mock('@/lib/pickPhoto', () => ({
  canTakePhoto: jest.fn(() => false),
  pickPhoto: jest.fn(),
}));

const pick = jest.mocked(pickPhoto);
const store = () => useAppStore.getState();
const photos = () => usePhotoStore.getState().photos;
const s = t.teamPhoto;
const URI_A = 'data:image/jpeg;base64,AAAA';
const URI_B = 'data:image/jpeg;base64,BBBB';
const hidden = { includeHiddenElements: true };

const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const photosIn = (testID: string) =>
  within(screen.getByTestId(testID)).queryAllByTestId('photo', hidden).length;
const initialIn = (testID: string) =>
  within(screen.getByTestId(testID)).queryByTestId('team-initial', hidden);

function seedProfile() {
  const coach = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(coach.id);
  return coach;
}

beforeEach(() => {
  store().resetAll();
  store().setLanguage('en');
  useAppStore.setState({ hydrated: true });
  usePhotoStore.setState({ photos: {}, hydrated: true });
  resetStartupRedirect();
  pick.mockReset();
});

describe('team pictures (v8)', () => {
  it('creates a team with a picture; the team list shows it', async () => {
    seedProfile();
    pick.mockResolvedValue({ status: 'picked', dataUri: URI_A });
    await renderRouter('./app', { initialUrl: '/teams' });

    await press(t.roster.teams.new);
    await fireEvent.changeText(screen.getByLabelText(t.roster.teams.name), 'élan Bern');
    // The initial until a picture is picked.
    expect(screen.getByLabelText(s.initialOf('élan Bern'))).toHaveTextContent('É');
    await press(s.add);
    await screen.findByText(s.unsaved);
    expect(photos()).toEqual({});
    await press(t.roster.teams.create);

    const team = store().teams[0];
    expect(team.photoId).toEqual(expect.any(String));
    expect(photos()).toEqual({ [team.photoId as string]: URI_A });
    expect(photosIn(`team-${team.id}`)).toBe(1);
    expect(initialIn(`team-${team.id}`)).toBeNull();
  });

  it('changes and removes the picture; without one the list shows the initial', async () => {
    const coach = seedProfile();
    const team = store().addTeam({ profileId: coach.id, name: 'Herren 1' });
    usePhotoStore.setState({ photos: { old: URI_A } }); // the photo exists before it's referenced
    store().updateTeam(team.id, { photoId: 'old' });
    await renderRouter('./app', { initialUrl: '/teams' });
    await screen.findByTestId(`team-${team.id}`);
    expect(photosIn(`team-${team.id}`)).toBe(1);

    pick.mockResolvedValue({ status: 'picked', dataUri: URI_B });
    await press(t.roster.teams.rename('Herren 1'));
    await press(s.change);
    await screen.findByText(s.unsaved);
    await press(t.common.save);
    const changed = store().teams[0].photoId as string;
    expect(changed).not.toBe('old');
    expect(photos()).toEqual({ [changed]: URI_B });

    await press(t.roster.teams.rename('Herren 1'));
    await press(s.remove);
    expect(screen.getByText(s.removed)).toBeTruthy();
    expect(screen.getByRole('button', { name: s.add })).toBeTruthy();
    await press(t.common.save);
    expect(store().teams[0].photoId).toBeUndefined();
    expect(photos()).toEqual({}); // pruned
    expect(photosIn(`team-${team.id}`)).toBe(0);
    expect(initialIn(`team-${team.id}`)).toHaveTextContent('H');
  });

  it('shows the picture in the team header and on the season boxes', async () => {
    const coach = seedProfile();
    const team = store().addTeam({ profileId: coach.id, name: 'Damen 2' });
    const { seasonId } = seasonRefs(team.id, 'Rivals');
    usePhotoStore.setState({ photos: { tp: URI_A } });
    store().updateTeam(team.id, { photoId: 'tp' });
    await renderRouter('./app', { initialUrl: `/team/${team.id}?tab=matches` });
    await screen.findByTestId(`season-${seasonId}`);
    expect(photosIn(`season-${seasonId}`)).toBe(1);
    // The header: the picture next to the team name.
    expect(screen.getByRole('header', { name: 'Damen 2' })).toBeTruthy();
    expect(screen.getAllByTestId('photo', hidden)).toHaveLength(2);

    // Without a picture: the initial in both places.
    await act(async () => store().updateTeam(team.id, { photoId: undefined }));
    expect(await screen.findAllByTestId('team-initial', hidden)).toHaveLength(2);
    expect(initialIn(`season-${seasonId}`)).toHaveTextContent('D');
  });
});
