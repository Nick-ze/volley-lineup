import { mergeData, replaceData, type TransferData } from './exportSchema';
import {
  importChangesMatches,
  importWithSharedTeams,
  sharedTeamsInFile,
  sharedTeamsOf,
  type SharedTeam,
} from './syncImport';
import type { SyncedTeam } from './types';
import { rekeyTeam } from './syncUpload';
import { goldenData } from '@/test-utils';

const VIEWER: SharedTeam[] = [{ teamId: 't1', canEdit: false }];
const MANAGER: SharedTeam[] = [{ teamId: 't1', canEdit: true }];

const ofTeam = (data: TransferData, teamId: string) => {
  const seasons = data.seasons.filter((x) => x.teamId === teamId);
  const seasonIds = new Set(seasons.map((x) => x.id));
  return {
    team: data.teams.find((t) => t.id === teamId),
    players: data.players.filter((p) => p.teamId === teamId),
    matches: data.matches.filter((m) => m.teamId === teamId),
    presets: data.presets.filter((p) => p.teamId === teamId),
    seasons,
    opponents: data.opponents.filter((o) => seasonIds.has(o.seasonId)),
  };
};

/** A file from "another device": t1 renamed, p1 changed and p2 gone; t2 renamed; a new team t3. */
function changedFile(): TransferData {
  const file = goldenData();
  return {
    ...file,
    teams: [
      ...file.teams.map((t) => ({ ...t, name: `${t.name} (file)` })),
      { id: 't3', profileId: 'pr2', name: 'New', createdAt: '2026-03-01T00:00:00.000Z' },
    ],
    players: file.players
      .filter((p) => p.id !== 'p2')
      .map((p) => (p.id === 'p1' ? { ...p, firstName: 'Anja' } : p)),
  };
}

const unwrap = (result: ReturnType<typeof importWithSharedTeams>) => {
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe('sharedTeamsOf', () => {
  it('lists the linked teams; managers may edit, players only view', () => {
    const linked = (role: SyncedTeam['role']): SyncedTeam => ({
      userId: 'u1',
      role,
      cursor: 0,
      base: {},
      edits: {},
      photos: [],
    });
    const links = { a: linked('manager'), b: linked('player') };
    expect(sharedTeamsOf(links, [{ id: 'a' }, { id: 'b' }, { id: 'local' }])).toEqual([
      { teamId: 'a', canEdit: true },
      { teamId: 'b', canEdit: false },
    ]);
    expect(sharedTeamsOf({}, [{ id: 'a' }])).toEqual([]);
    // A link whose team isn't on the device protects nothing (audit C1).
    expect(sharedTeamsOf(links, [{ id: 'b' }])).toEqual([{ teamId: 'b', canEdit: false }]);
    expect(sharedTeamsOf(links, [])).toEqual([]);
  });
});

describe('sharedTeamsInFile', () => {
  it('splits the file’s shared teams into merged (manager) and skipped (viewer)', () => {
    const file = goldenData();
    const shared = [
      { teamId: 't1', canEdit: true },
      { teamId: 't2', canEdit: false },
      { teamId: 'elsewhere', canEdit: true },
    ];
    const { merged, skipped } = sharedTeamsInFile(file, shared);
    expect(merged.map((t) => t.id)).toEqual(['t1']);
    expect(skipped.map((t) => t.id)).toEqual(['t2']);
    expect(sharedTeamsInFile(file, [])).toEqual({ merged: [], skipped: [] });
  });
});

describe('importWithSharedTeams without shared teams', () => {
  it('Replace is exactly replaceData', () => {
    const file = changedFile();
    const result = unwrap(importWithSharedTeams(goldenData(), file, 'replace', []));
    expect(result.data).toEqual(replaceData(file));
    expect(result.skippedTeams).toEqual([]);
  });

  it('Merge is exactly mergeData, conflicts included', () => {
    const file = changedFile();
    const merged = mergeData(goldenData(), file);
    expect(importWithSharedTeams(goldenData(), file, 'merge', [])).toEqual({
      ...merged,
      skippedTeams: [],
    });
    // Another player with p3's number in t1 → the merge is refused, as before.
    const clash = { ...file, players: [...file.players, { ...file.players[0]!, id: 'px' }] };
    expect(importWithSharedTeams(goldenData(), clash, 'merge', [])).toEqual({
      ok: false,
      error: 'MERGE_CONFLICT',
    });
  });
});

describe('importWithSharedTeams: Replace', () => {
  it('keeps a viewer team exactly and skips the file’s copy', () => {
    const current = goldenData();
    const result = unwrap(importWithSharedTeams(current, changedFile(), 'replace', VIEWER));
    expect(result.skippedTeams).toEqual(['t1']);
    expect(ofTeam(result.data, 't1')).toEqual(ofTeam(current, 't1'));
    // Everything else is the file's.
    expect(result.data.teams.find((t) => t.id === 't2')?.name).toBe('Damen (file)');
    expect(result.data.teams.map((t) => t.id).sort()).toEqual(['t1', 't2', 't3']);
    // The team's pictures stay.
    expect(result.data.photos.map((p) => p.id).sort()).toEqual(['ph1', 'ph2', 'ph3']);
  });

  it('merges a manager team: the file wins per id, nothing is deleted', () => {
    const result = unwrap(importWithSharedTeams(goldenData(), changedFile(), 'replace', MANAGER));
    expect(result.skippedTeams).toEqual([]);
    const t1 = ofTeam(result.data, 't1');
    expect(t1.team?.name).toBe('Herren 1 – Süd (file)');
    expect(t1.players.find((p) => p.id === 'p1')?.firstName).toBe('Anja');
    // p2 is not in the file, but a shared team never loses records to an import.
    expect(t1.players.map((p) => p.id)).toContain('p2');
  });

  it('keeps a shared team whose profile is not in the file, with that profile', () => {
    const current = goldenData();
    const file: TransferData = {
      ...current,
      profiles: current.profiles.filter((p) => p.id === 'pr2'),
      teams: current.teams.filter((t) => t.id === 't2'),
      players: current.players.filter((p) => p.teamId === 't2'),
      matches: current.matches.filter((m) => m.teamId === 't2'),
      presets: [],
      seasons: current.seasons.filter((x) => x.teamId === 't2'),
      opponents: current.opponents.filter((o) => o.seasonId === 's3'),
      photos: [],
    };
    const result = unwrap(importWithSharedTeams(current, file, 'replace', VIEWER));
    expect(result.skippedTeams).toEqual([]);
    expect(result.data.profiles.map((p) => p.id).sort()).toEqual(['pr1', 'pr2']);
    expect(ofTeam(result.data, 't1')).toEqual(ofTeam(current, 't1'));
    expect(result.data.photos.map((p) => p.id).sort()).toEqual(['ph1', 'ph2', 'ph3']);
  });

  it('a shared team keeps its owning profile when the file moves it to another one', () => {
    const file = changedFile();
    const moved = { ...file, teams: file.teams.map((t) => ({ ...t, profileId: 'pr2' })) };
    const result = unwrap(importWithSharedTeams(goldenData(), moved, 'replace', MANAGER));
    expect(result.data.teams.find((t) => t.id === 't1')?.profileId).toBe('pr1');
    // Teams that aren't shared follow the file.
    expect(result.data.teams.find((t) => t.id === 't3')?.profileId).toBe('pr2');
  });

  it('refuses when the kept team clashes with the file (no data is dropped)', () => {
    const file = goldenData();
    // The file's t2 season gets the id of t1's season s1, which the shared team keeps.
    const clash: TransferData = {
      ...file,
      seasons: file.seasons.map((x) => (x.id === 's3' ? { ...x, id: 's1' } : x)),
      opponents: file.opponents.map((o) => (o.seasonId === 's3' ? { ...o, seasonId: 's1' } : o)),
      matches: file.matches.map((m) => (m.seasonId === 's3' ? { ...m, seasonId: 's1' } : m)),
    };
    expect(importWithSharedTeams(goldenData(), clash, 'replace', VIEWER)).toEqual({
      ok: false,
      error: 'MERGE_CONFLICT',
    });
  });

  it('refuses when the manager’s file copy clashes with the kept team', () => {
    const file = changedFile();
    // A new player with p2's number: p2 is kept (nothing is deleted), so the numbers clash.
    const clash = {
      ...file,
      players: [...file.players, { ...goldenData().players[1]!, id: 'p-new' }],
    };
    expect(importWithSharedTeams(goldenData(), clash, 'replace', MANAGER)).toEqual({
      ok: false,
      error: 'MERGE_CONFLICT',
    });
  });

  it('refuses an older backup where a jersey number was given to a new player since', () => {
    // Backup: "Old" wore #99. Since then Old left and "New" got #99 on this device.
    const backup = goldenData();
    const old = { ...backup.players[1]!, id: 'p-old', firstName: 'Old', number: 99 };
    const file = { ...backup, players: [...backup.players, old] };
    const current = goldenData();
    const fresh = { ...current.players[1]!, id: 'p-new', firstName: 'New', number: 99 };
    const now = { ...current, players: [...current.players, fresh] };
    // Managers: the backup's players are merged into the kept team (nothing is deleted).
    expect(importWithSharedTeams(now, file, 'replace', MANAGER)).toEqual({
      ok: false,
      error: 'MERGE_CONFLICT',
    });
    // Viewers: the backup's copy is skipped, so there is nothing to clash with.
    expect(importWithSharedTeams(now, file, 'replace', VIEWER).ok).toBe(true);
    // Without shared teams Replace never clashes.
    expect(importWithSharedTeams(now, file, 'replace', []).ok).toBe(true);
  });
});

describe('importWithSharedTeams: Merge', () => {
  it('skips a viewer team’s copy and merges the rest', () => {
    const current = goldenData();
    const result = unwrap(importWithSharedTeams(current, changedFile(), 'merge', VIEWER));
    expect(result.skippedTeams).toEqual(['t1']);
    expect(ofTeam(result.data, 't1')).toEqual(ofTeam(current, 't1'));
    expect(result.data.teams.find((t) => t.id === 't2')?.name).toBe('Damen (file)');
    expect(result.data.teams.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('merges a manager team and keeps its owning profile', () => {
    const file = changedFile();
    const moved = { ...file, teams: file.teams.map((t) => ({ ...t, profileId: 'pr2' })) };
    const result = unwrap(importWithSharedTeams(goldenData(), moved, 'merge', MANAGER));
    const t1 = ofTeam(result.data, 't1');
    expect(t1.team).toMatchObject({ name: 'Herren 1 – Süd (file)', profileId: 'pr1' });
    expect(t1.players.map((p) => p.id)).toContain('p2');
    expect(result.data.teams.find((t) => t.id === 't2')?.profileId).toBe('pr2');
  });

  it('passes a merge conflict on', () => {
    const file = changedFile();
    const clash = { ...file, players: [...file.players, { ...file.players[0]!, id: 'px' }] };
    expect(importWithSharedTeams(goldenData(), clash, 'merge', MANAGER)).toEqual({
      ok: false,
      error: 'MERGE_CONFLICT',
    });
  });
});

describe('importWithSharedTeams: a file with a shared team’s records under another team id (audit H9)', () => {
  /** The device: golden t1 was uploaded under a new id (`y1`); its record ids are the same. */
  const device = (): TransferData => rekeyTeam(goldenData(), 't1', 'y1');
  const SHARED_Y1: SharedTeam[] = [{ teamId: 'y1', canEdit: true }];
  const count = (data: TransferData, teamId: string) => ofTeam(data, teamId).players.length;

  it('Merge refuses a backup from before the new id: nothing would be left in the shared team', () => {
    const current = device();
    expect(count(current, 'y1')).toBeGreaterThan(0);
    // Without the check the merge "works" and moves every record to t1.
    const plain = mergeData(current, goldenData());
    expect(plain.ok && count(plain.data, 'y1')).toBe(0);
    expect(importWithSharedTeams(current, goldenData(), 'merge', SHARED_Y1)).toEqual({
      ok: false,
      error: 'SHARED_CONFLICT',
    });
    // A view-only team is protected the same way.
    expect(
      importWithSharedTeams(current, goldenData(), 'merge', [{ teamId: 'y1', canEdit: false }]),
    ).toEqual({ ok: false, error: 'SHARED_CONFLICT' });
  });

  it.each(['players', 'seasons', 'opponents', 'matches', 'presets'] as const)(
    'one moved record is enough: %s',
    (kind) => {
      const current = device();
      const golden = goldenData();
      // A file with another team (t9) that holds exactly one of the shared team's records.
      const empty: TransferData = {
        ...golden,
        teams: [],
        players: [],
        seasons: [],
        opponents: [],
        matches: [],
        presets: [],
        photos: [],
      };
      const team = { ...golden.teams[0]!, id: 't9', photoId: undefined, captainId: undefined };
      const season = { ...golden.seasons.find((x) => x.teamId === 't1')!, id: 'se9', teamId: 't9' };
      const mine = ofTeam(golden, 't1');
      const file: TransferData = { ...empty, teams: [team], seasons: [season] };
      if (kind === 'players')
        file.players = [{ ...mine.players[0]!, teamId: 't9', photoId: undefined }];
      if (kind === 'seasons') file.seasons = [{ ...mine.seasons[0]!, teamId: 't9' }];
      if (kind === 'opponents') file.opponents = [{ ...mine.opponents[0]!, seasonId: 'se9' }];
      if (kind === 'matches') file.matches = [{ ...mine.matches[0]!, teamId: 't9' }];
      if (kind === 'presets') file.presets = [{ ...mine.presets[0]!, teamId: 't9' }];
      expect(importWithSharedTeams(current, file, 'merge', SHARED_Y1)).toEqual({
        ok: false,
        error: 'SHARED_CONFLICT',
      });
    },
  );

  it('an opponent of the shared team under a season the file doesn’t have counts as moved', () => {
    const golden = goldenData();
    const opponent = { ...ofTeam(golden, 't1').opponents[0]!, seasonId: 'unknown' };
    const file: TransferData = {
      ...golden,
      teams: [],
      players: [],
      seasons: [],
      matches: [],
      presets: [],
      photos: [],
      opponents: [opponent],
    };
    expect(importWithSharedTeams(device(), file, 'merge', SHARED_Y1).ok).toBe(false);
  });

  it('the same records under the shared team’s own id merge as before', () => {
    const current = device();
    const file = rekeyTeam(changedFile(), 't1', 'y1');
    const result = unwrap(importWithSharedTeams(current, file, 'merge', SHARED_Y1));
    expect(ofTeam(result.data, 'y1').team?.name).toBe('Herren 1 – Süd (file)');
    expect(count(result.data, 'y1')).toBe(count(current, 'y1'));
  });

  it('records of teams that aren’t shared may move as before', () => {
    // t2 isn't shared: a file that holds one of its players under another team just merges.
    const current = device();
    const golden = goldenData();
    const p = golden.players.find((x) => x.teamId === 't2');
    if (!p) throw new Error('t2 has no player');
    const file: TransferData = {
      ...golden,
      teams: golden.teams.filter((x) => x.id === 't2'),
      players: [p],
      seasons: golden.seasons.filter((x) => x.teamId === 't2'),
      opponents: [],
      matches: [],
      presets: [],
      photos: [],
    };
    expect(importWithSharedTeams(current, file, 'merge', SHARED_Y1).ok).toBe(true);
  });

  it('Replace is not affected: the shared team keeps its records', () => {
    const current = device();
    const result = unwrap(importWithSharedTeams(current, goldenData(), 'replace', SHARED_Y1));
    expect(count(result.data, 'y1')).toBe(count(current, 'y1'));
  });
});

describe('importWithSharedTeams: a shared team’s picture that isn’t downloaded yet (audit L31)', () => {
  /** The device: t1 is shared and p1's cloud picture (ph2) hasn't arrived; so hasn't t1's own. */
  function waitingForPhotos(): TransferData {
    const data = goldenData();
    return { ...data, photos: data.photos.filter((p) => p.id !== 'ph2' && p.id !== 'ph3') };
  }
  /** A file that has nothing to do with the shared team. */
  function otherFile(): TransferData {
    const file = goldenData();
    const t2 = ofTeam(file, 't2');
    return {
      profiles: file.profiles.filter((p) => p.id === t2.team?.profileId),
      teams: t2.team ? [{ ...t2.team, name: 'From the file' }] : [],
      players: t2.players,
      matches: t2.matches,
      presets: t2.presets,
      seasons: t2.seasons,
      opponents: t2.opponents,
      photos: [],
    };
  }
  const photoIds = (data: TransferData) => data.photos.map((p) => p.id).sort();

  it('the device’s own data would fail the plain check (the reason every import was refused)', () => {
    expect(mergeData(waitingForPhotos(), otherFile())).toEqual({
      ok: false,
      error: 'MERGE_CONFLICT',
    });
  });

  it.each([MANAGER, VIEWER])('Merge works; the waiting pictures keep their ids', (...shared) => {
    const current = waitingForPhotos();
    const { data } = unwrap(importWithSharedTeams(current, otherFile(), 'merge', shared));
    expect(data.teams.find((t) => t.id === 't2')?.name).toBe('From the file');
    expect(data.teams.find((t) => t.id === 't1')?.photoId).toBe('ph3');
    expect(data.players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
    // No stand-in is written: only real photos, and none for the waiting ids.
    expect(data.photos.some((p) => p.id === 'ph2' || p.id === 'ph3')).toBe(false);
    expect(data.photos.every((p) => p.dataUri !== '')).toBe(true);
    expect(data.photos.every((p) => current.photos.includes(p))).toBe(true);
  });

  it.each([MANAGER, VIEWER])('Replace works too', (...shared) => {
    const current = waitingForPhotos();
    const { data } = unwrap(importWithSharedTeams(current, otherFile(), 'replace', shared));
    expect(data.teams.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(data.players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
    expect(data.photos.some((p) => p.id === 'ph2' || p.id === 'ph3')).toBe(false);
    expect(data.photos.every((p) => p.dataUri !== '')).toBe(true);
  });

  it('a file that has the picture brings it back (manager: the file wins per id)', () => {
    const current = waitingForPhotos();
    const file = goldenData();
    const { data } = unwrap(importWithSharedTeams(current, file, 'merge', MANAGER));
    const ph2 = file.photos.find((p) => p.id === 'ph2');
    expect(ph2?.dataUri).not.toBe('');
    expect(data.photos.find((p) => p.id === 'ph2')).toEqual(ph2);
    expect(data.photos.find((p) => p.id === 'ph3')).toEqual(
      file.photos.find((p) => p.id === 'ph3'),
    );
    expect(data.photos.every((p) => p.dataUri !== '')).toBe(true);
  });

  it.each([
    ['merge', MANAGER],
    ['replace', MANAGER],
    ['merge', VIEWER],
    ['replace', VIEWER],
  ] as const)(
    '%s: a backup that has the picture brings it back, whatever the role',
    (mode, shared) => {
      // Found by the review: on a view-only device Replace kept the stand-in and lost the picture.
      const file = goldenData();
      const { data } = unwrap(importWithSharedTeams(waitingForPhotos(), file, mode, [...shared]));
      expect(data.photos.find((p) => p.id === 'ph2')).toEqual(
        file.photos.find((p) => p.id === 'ph2'),
      );
      expect(data.photos.every((p) => p.dataUri !== '')).toBe(true);
      expect(data.players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
    },
  );

  it('a missing picture of a team that isn’t shared is still refused', () => {
    const data = goldenData();
    const t2Player = data.players.find((p) => p.teamId === 't2');
    if (!t2Player) throw new Error('no t2 player');
    const current = {
      ...data,
      players: data.players.map((p) => (p.id === t2Player.id ? { ...p, photoId: 'gone' } : p)),
    };
    expect(importWithSharedTeams(current, otherFile(), 'merge', MANAGER)).toEqual({
      ok: false,
      error: 'MERGE_CONFLICT',
    });
  });

  it('with every picture on the device nothing changes (same result as before)', () => {
    const current = goldenData();
    const merged = unwrap(importWithSharedTeams(current, changedFile(), 'merge', MANAGER));
    const plain = mergeData(current, changedFile());
    if (!plain.ok) throw new Error(plain.error);
    expect(merged.data.photos).toEqual(plain.data.photos);
    expect(photoIds(merged.data)).toEqual(photoIds(plain.data));
  });
});

describe('importChangesMatches (audit M15, review)', () => {
  const current = goldenData().matches;
  const edited = current.map((m) =>
    m.id === 'm2' ? { ...m, sets: m.sets.map((x) => ({ ...x, events: [] })), opponent: 'X' } : m,
  );

  it('is false when no match is being scored live', () => {
    expect(importChangesMatches(current, [], [])).toBe(false);
  });

  it('is true when the result changes or drops such a match', () => {
    expect(importChangesMatches(current, edited, ['m2'])).toBe(true);
    expect(
      importChangesMatches(
        current,
        current.filter((m) => m.id !== 'm2'),
        ['m2'],
      ),
    ).toBe(true);
  });

  it('is false when the result leaves it as it is — the same object or the same content', () => {
    expect(importChangesMatches(current, current, ['m2'])).toBe(false);
    const copy = JSON.parse(JSON.stringify(current)) as typeof current;
    expect(importChangesMatches(current, copy, ['m2'])).toBe(false);
    // Another match changes: that one isn't being scored.
    expect(importChangesMatches(current, edited, ['m1'])).toBe(false);
    // A held match neither the device nor the file has can't be changed by the import.
    expect(importChangesMatches(current, edited, ['unknown'])).toBe(false);
  });

  it('is true when the file brings a scored match the device hasn’t pulled yet', () => {
    const m2 = current.find((m) => m.id === 'm2');
    if (!m2) throw new Error('no m2');
    const without = current.filter((m) => m.id !== 'm2');
    expect(importChangesMatches(without, [...without, m2], ['m2'])).toBe(true);
  });
});
