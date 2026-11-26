import {
  accountLink,
  codeInput,
  formatSyncTime,
  isPlausibleEmail,
  resendSecondsLeft,
  setupLists,
} from './syncSetup';

describe('setupLists', () => {
  const local = [
    { id: 'a', name: 'Herren 1' },
    { id: 'b', name: 'Damen 2' },
    { id: 'c', name: 'Old copy' },
  ];
  const cloud = [
    { teamId: 'b', name: 'Damen 2', onDevice: true },
    { teamId: 'c', name: 'Old copy', onDevice: false },
    { teamId: 'x', name: 'U18', onDevice: false },
    { teamId: 'y', name: 'Linked', onDevice: false },
  ];

  it('offers unshared local teams for upload and cloud teams not on the device for download', () => {
    const lists = setupLists(local, ['b', 'y'], cloud);
    expect(lists.upload.map((t) => t.id)).toEqual(['a']);
    expect(lists.download.map((t) => t.teamId)).toEqual(['c', 'x']);
  });

  it('offers a local copy of a cloud team for download only (the cloud wins)', () => {
    const lists = setupLists(local, [], cloud);
    expect(lists.upload.map((t) => t.id)).toEqual(['a']);
    expect(lists.download.map((t) => t.teamId)).toContain('c');
  });

  it('works without cloud teams (offline) and without local teams', () => {
    expect(setupLists(local, ['a'], []).upload.map((t) => t.id)).toEqual(['b', 'c']);
    expect(setupLists([], [], cloud).upload).toEqual([]);
  });
});

describe('accountLink', () => {
  const profiles = [
    { id: 'p1', name: 'Coach' },
    { id: 'p2', name: 'Assistant' },
  ];
  const session = { userId: 'u1', email: 'coach@example.com' };
  const account = { userId: 'u1', email: 'coach@example.com', profileId: 'p1' };

  it('needs a profile', () => {
    expect(accountLink(session, account, null, profiles)).toEqual({ kind: 'noProfile' });
  });

  it('is signed in when the session is the account linked to this profile', () => {
    expect(accountLink(session, account, 'p1', profiles)).toEqual({
      kind: 'signedIn',
      email: 'coach@example.com',
    });
  });

  it('is signed out without a session, without an account or with another user', () => {
    expect(accountLink(null, account, 'p1', profiles)).toEqual({ kind: 'signedOut' });
    expect(accountLink(session, null, 'p1', profiles)).toEqual({ kind: 'signedOut' });
    expect(accountLink(null, null, 'p1', profiles)).toEqual({ kind: 'signedOut' });
    const other = { userId: 'u2', email: 'b@example.com' };
    expect(accountLink(other, account, 'p1', profiles)).toEqual({ kind: 'signedOut' });
  });

  it('is restoring while the stored session of this profile’s account is read (audit M14)', () => {
    expect(accountLink(null, account, 'p1', profiles, true)).toEqual({ kind: 'restoring' });
    // Signed out as before: no account, another profile's, or the session is already there.
    expect(accountLink(null, null, 'p1', profiles, true)).toEqual({ kind: 'signedOut' });
    expect(accountLink(session, account, 'p1', profiles, true)).toEqual({
      kind: 'signedIn',
      email: 'coach@example.com',
    });
    expect(accountLink(null, account, 'p2', profiles, true)).toMatchObject({
      kind: 'otherProfile',
    });
  });

  it('names the other profile the account is linked to', () => {
    expect(accountLink(null, account, 'p2', profiles)).toEqual({
      kind: 'otherProfile',
      email: 'coach@example.com',
      profileName: 'Coach',
    });
  });

  it('ignores a link to a profile that no longer exists', () => {
    expect(accountLink(null, { ...account, profileId: 'gone' }, 'p2', profiles)).toEqual({
      kind: 'signedOut',
    });
  });
});

describe('sign-in form helpers', () => {
  it('checks emails simply', () => {
    expect(isPlausibleEmail(' coach@example.com ')).toBe(true);
    expect(isPlausibleEmail('a@b.ch')).toBe(true);
    for (const bad of ['', 'coach', 'coach@', 'coach@example', '@example.com', 'a b@c.de']) {
      expect(isPlausibleEmail(bad)).toBe(false);
    }
  });

  it('keeps at most 6 digits of the code', () => {
    expect(codeInput('123 456')).toBe('123456');
    expect(codeInput('12a3')).toBe('123');
    expect(codeInput('12345678')).toBe('123456');
  });

  it('counts the resend wait down from 60 s', () => {
    expect(resendSecondsLeft(1000, 1000)).toBe(60);
    expect(resendSecondsLeft(1000, 1500)).toBe(60);
    expect(resendSecondsLeft(1000, 60_500)).toBe(1);
    expect(resendSecondsLeft(1000, 61_000)).toBe(0);
    expect(resendSecondsLeft(1000, 999_999)).toBe(0);
  });
});

describe('formatSyncTime', () => {
  it('shows the local date and time', () => {
    const local = new Date(2026, 10, 25, 9, 5).toISOString();
    expect(formatSyncTime(local)).toBe('25.11.26 09:05');
  });

  it('shows an unparseable value as it is', () => {
    expect(formatSyncTime('soon')).toBe('soon');
  });
});
