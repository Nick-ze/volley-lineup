import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

import { fullLineup, seedTeam } from '../__fixtures__/team';

const store = () => useAppStore.getState();
const s = t.presets;

async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

async function typeName(text: string) {
  await fireEvent.changeText(screen.getByTestId('preset-name-input'), text);
}

beforeEach(seedTeam);

describe('presets tab', () => {
  it('creates a preset (name required and unique), opens it and edits its lineup', async () => {
    store().addPreset({ teamId: 'team1', name: 'Taken' });
    await renderRouter('./app', { initialUrl: '/team/team1?tab=presets' });
    await fireEvent.press(await screen.findByTestId('new-preset'));
    expect(screen.getByTestId('preset-name-input').props.value).toBe('Preset 1');

    await typeName('   ');
    await fireEvent.press(screen.getByTestId('preset-name-save'));
    expect(screen.getByText(s.nameDialog.errors.required)).toBeTruthy();
    await typeName('taken');
    await fireEvent.press(screen.getByTestId('preset-name-save'));
    expect(screen.getByText(s.nameDialog.errors.taken)).toBeTruthy();
    await typeName('x'.repeat(41));
    await fireEvent.press(screen.getByTestId('preset-name-save'));
    expect(screen.getByText(s.nameDialog.errors.tooLong)).toBeTruthy();

    await typeName('  5-1 strong serve ');
    await fireEvent.press(screen.getByTestId('preset-name-save'));
    const created = store().presets.find((p) => p.name === '5-1 strong serve')!;
    expect(created.kind).toBe('preset');
    expect(screen).toHavePathname(`/team/team1/preset/${created.id}`);

    // The lineup builder without serve toggle / copy previous; edits are saved to the preset.
    expect(await screen.findByTestId('lineup-court')).toBeTruthy();
    expect(screen.queryByTestId('serve-us')).toBeNull();
    expect(screen.queryByTestId('copy-previous')).toBeNull();
    expect(screen.queryByTestId('use-starters')).toBeNull();
    await fireEvent.press(within(screen.getByTestId('bench')).getByTestId('bench-player-8'));
    await fireEvent.press(screen.getByTestId('slot-empty-1'));
    expect(store().presets.find((p) => p.id === created.id)?.slots[1]).toBe('p8');

    await fireEvent.press(screen.getByTestId('template-open'));
    await fireEvent.press(screen.getByTestId('template-5-1'));
    const filled = store().presets.find((p) => p.id === created.id)!;
    expect(Object.values(filled.slots).every((id) => id !== null)).toBe(true);

    // Rename from the editor.
    await fireEvent.press(screen.getByTestId('rename-preset'));
    await typeName('Rotation A');
    await fireEvent.press(screen.getByTestId('preset-name-save'));
    expect(store().presets.find((p) => p.id === created.id)?.name).toBe('Rotation A');
  });

  it('lists presets with a summary; rename, copy and delete (with confirmation)', async () => {
    store().addPreset({ teamId: 'team1', name: 'Alpha', ...fullLineup() });
    store().setStarters('team1', fullLineup()); // starters are not listed here
    await renderRouter('./app', { initialUrl: '/team/team1?tab=presets' });
    expect(await screen.findByText(s.list.count(1))).toBeTruthy();
    expect(screen.getByText('6/6 + L')).toBeTruthy();

    await press(s.list.renameLabel('Alpha'));
    await typeName('Beta');
    await fireEvent.press(screen.getByTestId('preset-name-save'));
    expect(screen.getByText('Beta')).toBeTruthy();

    await press(s.list.duplicateLabel('Beta'));
    await press(s.list.duplicateLabel('Beta'));
    const names = store()
      .presets.filter((p) => p.kind === 'preset')
      .map((p) => p.name);
    expect(names).toEqual(['Beta', 'Beta (copy)', 'Preset 1']);
    expect(store().presets.find((p) => p.name === 'Beta (copy)')?.slots).toEqual(
      fullLineup().slots,
    );

    await press(s.list.deleteLabel('Beta'));
    await press(t.common.cancel);
    expect(store().presets).toHaveLength(4);
    await press(s.list.deleteLabel('Beta'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().presets.some((p) => p.name === 'Beta')).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: /Edit preset Preset 1/ }));
    const copyId = store().presets.find((p) => p.name === 'Preset 1')!.id;
    expect(screen).toHavePathname(`/team/team1/preset/${copyId}`);
  });

  it('shows "not found" for a preset of another team', async () => {
    const p = store().addPreset({ teamId: 'other', name: 'Ghost' });
    await renderRouter('./app', { initialUrl: `/team/team1/preset/${p.id}` });
    expect(await screen.findByText(s.editor.notFound)).toBeTruthy();
  });
});

describe('starters tab', () => {
  it('sets the starters from the empty state, then shows them on a court', async () => {
    await renderRouter('./app', { initialUrl: '/team/team1?tab=starters' });
    expect(await screen.findByText(s.starters.empty)).toBeTruthy();
    await press(s.starters.setLabel);
    expect(screen).toHavePathname('/team/team1/starters');
    expect(store().presets).toEqual([]); // stored on the first edit

    await fireEvent.press(await screen.findByTestId('template-open'));
    await fireEvent.press(screen.getByTestId('template-5-1'));
    await fireEvent.press(within(screen.getByTestId('bench')).getByTestId('bench-player-7'));
    await fireEvent.press(screen.getByTestId('libero-empty'));
    const starters = store().presets.find((p) => p.kind === 'starters')!;
    expect(starters.slots).toEqual({ 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' });
    expect(starters.liberoId).toBe('p7');
    expect(store().presets).toHaveLength(1);

    // Back on the team's Starters tab.
    await fireEvent.press(screen.getByLabelText(t.common.back));
    expect(screen).toHaveSearchParams({ teamId: 'team1', tab: 'starters' });
    expect(await screen.findByTestId('starters-court')).toBeTruthy();
    expect(screen.getByText(s.starters.libero('#7 Lea Test'))).toBeTruthy();
    expect(screen.getByText(s.starters.complete)).toBeTruthy();
    expect(screen.getByRole('button', { name: s.starters.editLabel })).toBeTruthy();
  });

  it('says injured starters will be left out of new matches', async () => {
    store().setStarters('team1', fullLineup());
    store().updatePlayer('p2', { active: false });
    store().updatePlayer('p7', { active: false });
    await renderRouter('./app', { initialUrl: '/team/team1?tab=starters' });
    expect(await screen.findByTestId('starters-status')).toHaveTextContent(s.starters.leftOut(2));
    expect(screen.queryByText(s.starters.complete)).toBeNull();
  });

  it('warns when the starters are incomplete', async () => {
    store().setStarters('team1', { ...fullLineup(), slots: { ...fullLineup().slots, 6: null } });
    await renderRouter('./app', { initialUrl: '/team/team1?tab=starters' });
    expect(await screen.findByText(s.starters.incomplete(5))).toBeTruthy();
  });
});
