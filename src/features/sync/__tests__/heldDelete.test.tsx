/**
 * v10 audit (docs/AUDIT_V10.md M15, L18).
 *
 * M15 — the live hold made a match read-only on the other devices, but not undeletable: Delete
 * match, Delete season, Delete player and "Delete for everyone" only looked at the role. A
 * manager could delete the match another manager was scoring at that moment. Now none of them
 * is offered while another device holds a match they would remove or change.
 *
 * L18 — a confirm or name dialog that was open when this device became view-only (a demotion)
 * still did its work. Now the action asks again at the moment it runs, and the name dialogs
 * close.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';

import type { MatchHold, TeamRole } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { renderApp, seedGolden } from '@/test-utils';

beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

const store = () => useAppStore.getState();

function link(role: TeamRole) {
  useAppStore.setState({
    sync: {
      deviceId: 'dev1',
      account: { userId: 'u1', email: 'coach@example.test', profileId: 'pr1' },
      teams: { t1: { userId: 'u1', role, cursor: 0, base: {}, edits: {}, photos: [] } },
    },
  });
}

const hold = (matchId: string, overrides: Partial<MatchHold> = {}): MatchHold => ({
  matchId,
  teamId: 't1',
  deviceId: 'dev-other',
  userId: 'u2',
  holderName: 'Anna',
  heldUntil: '2099-01-01T00:00:00.000Z',
  ...overrides,
});

const holdBy = (...holds: MatchHold[]) =>
  act(async () => {
    useSyncRuntime.setState({ holds: Object.fromEntries(holds.map((h) => [h.matchId, h])) });
  });

const demote = () => act(async () => link('player'));

/** Takes the player out of every lineup (so that nothing but a hold can block deleting them). */
function stripFromLineups(id: string) {
  useAppStore.setState((s) => ({
    matches: s.matches.map((m) => ({
      ...m,
      sets: m.sets.map((x) => ({
        ...x,
        slots: Object.fromEntries(
          Object.entries(x.slots).map(([pos, pid]) => [pos, pid === id ? null : pid]),
        ) as typeof x.slots,
        liberoId: x.liberoId === id ? null : x.liberoId,
        liberoReplaces: x.liberoReplaces.filter((pid) => pid !== id),
        events: x.events.filter((e) => JSON.stringify(e).includes(`"${id}"`) === false),
      })),
    })),
  }));
}
const opponentOf = (matchId: string) => store().matches.find((m) => m.id === matchId)!.opponent;
const deleteMatchLabel = (matchId: string) => t.roster.matches.delete(opponentOf(matchId));
const NOTE = t.sync.readOnly.heldNoDelete('Anna');

beforeEach(() => {
  jest.clearAllMocks();
  seedGolden();
  link('manager');
});

describe('a match another device is scoring live (audit M15)', () => {
  it('has no Delete in its season’s list; the other matches keep theirs', async () => {
    await holdBy(hold('m1'));
    await renderApp('/team/t1/season/s1?tab=matches');
    expect(await screen.findByText(t.roster.matches.vs(opponentOf('m1')))).toBeTruthy();
    expect(screen.queryByRole('button', { name: deleteMatchLabel('m1') })).toBeNull();
    // Once the other device is done, Delete is back.
    await holdBy();
    expect(screen.getByRole('button', { name: deleteMatchLabel('m1') })).toBeTruthy();
  });

  it('isn’t deleted when the other device starts scoring while the question is open', async () => {
    await renderApp('/team/t1/season/s1?tab=matches');
    await fireEvent.press(await screen.findByRole('button', { name: deleteMatchLabel('m1') }));
    expect(screen.getByText(t.roster.confirm.deleteMatch(opponentOf('m1')))).toBeTruthy();
    await holdBy(hold('m1'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().matches.some((m) => m.id === 'm1')).toBe(true);
  });

  it('this device’s own hold and a hold that has run out don’t stand in the way', async () => {
    await holdBy(
      hold('m1', { deviceId: 'dev1' }),
      hold('m2', { heldUntil: '2020-01-01T00:00:00.000Z' }),
    );
    await renderApp('/team/t1/season/s1?tab=matches');
    await fireEvent.press(await screen.findByRole('button', { name: deleteMatchLabel('m1') }));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().matches.some((m) => m.id === 'm1')).toBe(false);
  });

  it('its season can’t be deleted, and the form says why', async () => {
    await holdBy(hold('m2'));
    await renderApp('/team/t1/season-new?seasonId=s2');
    expect(await screen.findByText(t.seasons.form.editTitle)).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.seasons.form.delete })).toBeNull();
    expect(screen.getByText(NOTE)).toBeTruthy();
    // Another season of the team is not affected.
    await holdBy(hold('m1'));
    expect(screen.getByRole('button', { name: t.seasons.form.delete })).toBeTruthy();
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('its season isn’t deleted when the hold comes while the question is open', async () => {
    await renderApp('/team/t1/season-new?seasonId=s2');
    await fireEvent.press(await screen.findByRole('button', { name: t.seasons.form.delete }));
    await holdBy(hold('m2'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().seasons.some((x) => x.id === 's2')).toBe(true);
    expect(store().matches.some((m) => m.id === 'm2')).toBe(true);
  });

  it('a player in one of its lineups can’t be deleted meanwhile', async () => {
    // p8 only stands in set 1 of a new, unplayed match (nothing else blocks deleting them).
    const m2 = store().matches.find((m) => m.id === 'm2')!;
    const fresh = {
      ...m2,
      id: 'm-new',
      sets: [{ ...m2.sets[0], events: [], slots: { ...m2.sets[0].slots, 1: 'p8' } }],
    };
    useAppStore.setState((s) => ({
      matches: [
        ...s.matches.map((m) => ({
          ...m,
          sets: m.sets.map((x) => ({
            ...x,
            slots: Object.fromEntries(
              Object.entries(x.slots).map(([pos, id]) => [pos, id === 'p8' ? null : id]),
            ) as typeof x.slots,
            liberoId: x.liberoId === 'p8' ? null : x.liberoId,
            liberoReplaces: x.liberoReplaces.filter((id) => id !== 'p8'),
            events: x.events.filter((e) => JSON.stringify(e).includes('"p8"') === false),
          })),
        })),
        fresh,
      ],
    }));
    await holdBy(hold('m-new'));
    await renderApp('/team/t1/player?playerId=p8');
    const button = await screen.findByRole('button', { name: t.roster.player.delete });
    expect(button.props.accessibilityState?.disabled ?? button.props['aria-disabled']).toBe(true);
    expect(screen.getByText(NOTE)).toBeTruthy();
    await holdBy();
    await fireEvent.press(screen.getByRole('button', { name: t.roster.player.delete }));
    // The hold comes back while the question is open: nothing is deleted.
    await holdBy(hold('m-new'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().players.some((p) => p.id === 'p8')).toBe(true);
  });

  it('its team can’t be deleted for everyone; "Remove from this device" still works', async () => {
    await holdBy(hold('m2'));
    await renderApp('/teams');
    const team = store().teams.find((x) => x.id === 't1')!;
    await fireEvent.press(screen.getByRole('button', { name: t.roster.teams.delete(team.name) }));
    expect(await screen.findByTestId('shared-team-delete')).toBeTruthy();
    expect(screen.getByTestId('shared-team-delete-held')).toHaveTextContent(NOTE);
    await fireEvent.press(screen.getByTestId('team-delete-everywhere'));
    expect(sync.deleteTeamEverywhere).not.toHaveBeenCalled();
    // The hold ends: the choice works again.
    await holdBy();
    expect(screen.queryByTestId('shared-team-delete-held')).toBeNull();
    await fireEvent.press(screen.getByTestId('team-delete-everywhere'));
    expect(sync.deleteTeamEverywhere).toHaveBeenCalledWith('t1');
  });

  it('a view-only member’s dialog says nothing about it (they can only leave)', async () => {
    link('player');
    await holdBy(hold('m2'));
    await renderApp('/teams');
    const team = store().teams.find((x) => x.id === 't1')!;
    await fireEvent.press(screen.getByRole('button', { name: t.roster.teams.delete(team.name) }));
    expect(await screen.findByTestId('shared-team-delete')).toBeTruthy();
    expect(screen.queryByTestId('shared-team-delete-held')).toBeNull();
    expect(screen.getByTestId('team-leave')).toBeTruthy();
  });

  it('"Delete for everyone" is shown as not available while the hold lasts', async () => {
    await holdBy(hold('m2'));
    await renderApp('/teams');
    const team = store().teams.find((x) => x.id === 't1')!;
    await fireEvent.press(screen.getByRole('button', { name: t.roster.teams.delete(team.name) }));
    const disabled = () => {
      const button = screen.getByTestId('team-delete-everywhere');
      return button.props.accessibilityState?.disabled ?? button.props['aria-disabled'];
    };
    expect(disabled()).toBe(true);
    await holdBy();
    expect(disabled()).toBeFalsy();
  });

  it('a player who isn’t in the scored match’s lineups can still be deleted', async () => {
    // p8 stands only in an unplayed copy of m2; another device scores m1, where p8 is not.
    stripFromLineups('p8');
    await holdBy(hold('m1'));
    await renderApp('/team/t1/player?playerId=p8');
    const button = await screen.findByRole('button', { name: t.roster.player.delete });
    expect(button.props.accessibilityState?.disabled ?? button.props['aria-disabled']).toBeFalsy();
    expect(screen.queryByText(NOTE)).toBeNull();
    await fireEvent.press(button);
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().players.some((p) => p.id === 'p8')).toBe(false);
  });

  // Found by the review: the re-check used the matches / lineups from when the question was asked.
  it('its season isn’t deleted when the scored match arrived while the question was open', async () => {
    await renderApp('/team/t1/season-new?seasonId=s2');
    await fireEvent.press(await screen.findByRole('button', { name: t.seasons.form.delete }));
    const m2 = store().matches.find((m) => m.id === 'm2')!;
    // Another device added a match to the season and scores it: both arrive by sync.
    await act(async () => {
      useAppStore.setState((s) => ({
        matches: [...s.matches, { ...m2, id: 'm-live', sets: [{ ...m2.sets[0], events: [] }] }],
      }));
    });
    await holdBy(hold('m-live'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().seasons.some((x) => x.id === 's2')).toBe(true);
    expect(store().matches.some((m) => m.id === 'm-live')).toBe(true);
  });

  it('a player the scorer put into the lineup while the question was open isn’t deleted', async () => {
    stripFromLineups('p8');
    const m2 = store().matches.find((m) => m.id === 'm2')!;
    const fresh = { ...m2, id: 'm-new', sets: [{ ...m2.sets[0], events: [] }] };
    useAppStore.setState((s) => ({ matches: [...s.matches, fresh] }));
    await holdBy(hold('m-new'));
    await renderApp('/team/t1/player?playerId=p8');
    await fireEvent.press(await screen.findByRole('button', { name: t.roster.player.delete }));
    // The scorer's lineup with p8 arrives by sync while the question is open.
    await act(async () => {
      useAppStore.setState((s) => ({
        matches: s.matches.map((m) =>
          m.id === 'm-new'
            ? { ...m, sets: [{ ...m.sets[0], slots: { ...m.sets[0].slots, 1: 'p8' } }] }
            : m,
        ),
      }));
    });
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().players.some((p) => p.id === 'p8')).toBe(true);
    expect(store().matches.find((m) => m.id === 'm-new')?.sets[0].slots[1]).toBe('p8');
  });

  it('words the reason with and without the other device’s name, in German too', () => {
    expect(t.sync.readOnly.heldNoDelete('')).toBe(
      'Deleting isn’t possible while a match is being scored live on another device.',
    );
    expect(NOTE).toBe(
      'Deleting isn’t possible while a match is being scored live on Anna’s device.',
    );
    expect(de.sync.readOnly.heldNoDelete('Anna')).toBe(
      'Löschen ist nicht möglich, solange auf dem Gerät von Anna ein Spiel live gezählt wird.',
    );
    expect(de.sync.readOnly.heldNoDelete('')).toMatch(/auf einem anderen Gerät/);
  });
});

describe('a dialog that was open when this device became view-only (audit L18)', () => {
  it('Delete match: confirming deletes nothing', async () => {
    await renderApp('/team/t1/season/s1?tab=matches');
    await fireEvent.press(await screen.findByRole('button', { name: deleteMatchLabel('m1') }));
    await demote();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().matches.some((m) => m.id === 'm1')).toBe(true);
  });

  it('Delete opponent: confirming deletes nothing', async () => {
    // o2 has no matches, so it can be deleted.
    await renderApp('/team/t1/season/s1?tab=opponents');
    const o2 = store().opponents.find((o) => o.id === 'o2')!;
    await fireEvent.press(
      await screen.findByRole('button', { name: t.seasons.opponents.deleteLabel(o2.name) }),
    );
    await demote();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().opponents.some((o) => o.id === 'o2')).toBe(true);
  });

  it('Delete preset: confirming deletes nothing', async () => {
    await renderApp('/team/t1?tab=presets');
    const preset = store().presets.find((p) => p.kind === 'preset')!;
    await fireEvent.press(
      await screen.findByRole('button', { name: t.presets.list.deleteLabel(preset.name) }),
    );
    await demote();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().presets.some((p) => p.id === preset.id)).toBe(true);
  });

  it('the preset name dialogs close, and nothing is added or renamed', async () => {
    await renderApp('/team/t1?tab=presets');
    const preset = store().presets.find((p) => p.kind === 'preset')!;
    const count = store().presets.length;
    await fireEvent.press(await screen.findByTestId('new-preset'));
    expect(screen.getByTestId('preset-name-dialog')).toBeTruthy();
    await demote();
    expect(screen.queryByTestId('preset-name-dialog')).toBeNull();
    expect(store().presets).toHaveLength(count);

    await act(async () => link('manager'));
    await fireEvent.press(
      screen.getByRole('button', { name: t.presets.list.renameLabel(preset.name) }),
    );
    expect(screen.getByTestId('preset-name-input').props.value).toBe(preset.name);
    await demote();
    expect(screen.queryByTestId('preset-name-dialog')).toBeNull();
    expect(store().presets.find((p) => p.id === preset.id)?.name).toBe(preset.name);
  });

  it('a name dialog that was closed that way stays closed when the device may edit again', async () => {
    await renderApp('/team/t1?tab=presets');
    await fireEvent.press(await screen.findByTestId('new-preset'));
    expect(screen.getByTestId('preset-name-dialog')).toBeTruthy();
    await demote();
    expect(screen.queryByTestId('preset-name-dialog')).toBeNull();
    await act(async () => link('manager'));
    expect(screen.queryByTestId('preset-name-dialog')).toBeNull();
    expect(screen.getByTestId('new-preset')).toBeTruthy();
  });

  it('as a manager the same dialogs still do their work', async () => {
    await renderApp('/team/t1/season/s1?tab=matches');
    await fireEvent.press(await screen.findByRole('button', { name: deleteMatchLabel('m1') }));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().matches.some((m) => m.id === 'm1')).toBe(false);
  });
});
