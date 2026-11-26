import {
  activeInvites,
  DEFAULT_INVITE_DAYS,
  DEFAULT_INVITE_ROLE,
  formatInviteCode,
  INVITE_ALPHABET,
  INVITE_DAYS,
  inviteDayOptions,
  inviteDaysFor,
  inviteExpired,
  inviteUsedUp,
  joinLink,
  normalizeInviteCode,
  sortMembers,
} from './invites';

describe('normalizeInviteCode', () => {
  it('accepts a code as shown, typed in lower case or with spaces', () => {
    expect(normalizeInviteCode('ABCDE-FGHJK')).toBe('ABCDEFGHJK');
    expect(normalizeInviteCode('abcde fghjk')).toBe('ABCDEFGHJK');
    expect(normalizeInviteCode('  abcdefghjk \n')).toBe('ABCDEFGHJK');
    expect(normalizeInviteCode('AB-CD--EF GH JK')).toBe('ABCDEFGHJK');
  });

  it('extracts the code from an app or web join link', () => {
    expect(normalizeInviteCode('volleylineup://join?code=ABCDEFGHJK')).toBe('ABCDEFGHJK');
    expect(
      normalizeInviteCode('https://nick-ze.github.io/volley-lineup/join?code=abcde-fghjk'),
    ).toBe('ABCDEFGHJK');
    expect(normalizeInviteCode('Join us: https://x.test/join?lang=de&code=ABCDE%2DFGHJK#top')).toBe(
      'ABCDEFGHJK',
    );
    expect(normalizeInviteCode('https://x.test/join?CODE=ABCDEFGHJK&x=1')).toBe('ABCDEFGHJK');
  });

  it('rejects wrong lengths, look-alike characters and other symbols', () => {
    expect(normalizeInviteCode('')).toBeNull();
    expect(normalizeInviteCode('ABCDEFGHJ')).toBeNull();
    expect(normalizeInviteCode('ABCDEFGHJKL')).toBeNull();
    expect(normalizeInviteCode('ABCDEFGHJI')).toBeNull(); // I
    expect(normalizeInviteCode('ABCDEFGHJO')).toBeNull(); // O
    expect(normalizeInviteCode('ABCDEFGHJ0')).toBeNull(); // 0
    expect(normalizeInviteCode('ABCDEFGHJ1')).toBeNull(); // 1
    expect(normalizeInviteCode('ABCDE_FGHJK')).toBeNull();
    expect(normalizeInviteCode('https://x.test/join?code=')).toBeNull();
    expect(normalizeInviteCode('https://x.test/join?code=%E0%A4%A')).toBeNull(); // bad escape
  });

  it('accepts every character of the alphabet', () => {
    expect(INVITE_ALPHABET).toHaveLength(32);
    expect(normalizeInviteCode(INVITE_ALPHABET.slice(0, 10))).toBe('ABCDEFGHJK');
    expect(normalizeInviteCode(INVITE_ALPHABET.slice(22))).toBe('YZ23456789');
  });
});

describe('formatInviteCode', () => {
  it('splits a code into two groups of five', () => {
    expect(formatInviteCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
  });

  it('leaves anything else unchanged', () => {
    expect(formatInviteCode('ABC')).toBe('ABC');
    expect(formatInviteCode('')).toBe('');
  });
});

describe('joinLink', () => {
  it('opens the app by its scheme', () => {
    expect(joinLink('ABCDEFGHJK')).toBe('volleylineup://join?code=ABCDEFGHJK');
  });

  it('opens the web app at the given address', () => {
    expect(joinLink('ABCDEFGHJK', 'https://nick-ze.github.io/volley-lineup')).toBe(
      'https://nick-ze.github.io/volley-lineup/join?code=ABCDEFGHJK',
    );
    expect(joinLink('ABCDEFGHJK', 'http://localhost:8081/')).toBe(
      'http://localhost:8081/join?code=ABCDEFGHJK',
    );
  });

  it('round-trips through normalizeInviteCode', () => {
    expect(normalizeInviteCode(joinLink('YZ23456789', 'https://x.test'))).toBe('YZ23456789');
    expect(normalizeInviteCode(joinLink('YZ23456789'))).toBe('YZ23456789');
  });
});

describe('invite expiry', () => {
  const now = Date.parse('2026-11-25T12:00:00.000Z');
  const invite = (id: string, expiresAt: string, revokedAt: string | null = null) => ({
    id,
    expiresAt,
    revokedAt,
  });

  it('is expired at or after its expiry time, or when the time is unreadable', () => {
    expect(inviteExpired(invite('a', '2026-11-25T12:00:01.000Z'), now)).toBe(false);
    expect(inviteExpired(invite('a', '2026-11-25T12:00:00.000Z'), now)).toBe(true);
    expect(inviteExpired(invite('a', '2026-11-24T00:00:00.000Z'), now)).toBe(true);
    expect(inviteExpired(invite('a', 'soon'), now)).toBe(true);
  });

  it('keeps only working invites, soonest expiry first', () => {
    const list = [
      invite('late', '2026-12-20T00:00:00.000Z'),
      invite('revoked', '2026-12-01T00:00:00.000Z', '2026-11-24T00:00:00.000Z'),
      invite('expired', '2026-11-20T00:00:00.000Z'),
      invite('soon', '2026-11-26T00:00:00.000Z'),
      { id: 'noRevokedField', expiresAt: '2026-12-02T00:00:00.000Z' },
    ];
    expect(activeInvites(list, now).map((i) => i.id)).toEqual(['soon', 'noRevokedField', 'late']);
    expect(list).toHaveLength(5); // not changed
  });

  it('is used up once it was used as often as it works (manager codes work once)', () => {
    const base = invite('m', '2026-12-01T00:00:00.000Z');
    expect(inviteUsedUp({ ...base, uses: 0, maxUses: 1 })).toBe(false);
    expect(inviteUsedUp({ ...base, uses: 1, maxUses: 1 })).toBe(true);
    expect(inviteUsedUp({ ...base, uses: 3, maxUses: 2 })).toBe(true);
    // No limit (player codes), also when the fields are missing.
    expect(inviteUsedUp({ ...base, uses: 40, maxUses: null })).toBe(false);
    expect(inviteUsedUp({ ...base, uses: 40 })).toBe(false);
    expect(inviteUsedUp({ ...base, maxUses: 1 })).toBe(false);
    expect(inviteUsedUp(base)).toBe(false);
  });

  it('leaves out a used-up code (audit H2: a manager code the invited manager already used)', () => {
    const list = [
      { ...invite('usedManager', '2026-11-27T00:00:00.000Z'), uses: 1, maxUses: 1 },
      { ...invite('freshManager', '2026-11-28T00:00:00.000Z'), uses: 0, maxUses: 1 },
      { ...invite('player', '2026-11-29T00:00:00.000Z'), uses: 12, maxUses: null },
    ];
    expect(activeInvites(list, now).map((i) => i.id)).toEqual(['freshManager', 'player']);
  });
});

describe('sortMembers', () => {
  const m = (userId: string, displayName: string, role: 'manager' | 'player') => ({
    userId,
    displayName,
    role,
  });

  it('lists managers first, then by name ignoring case, then by user id', () => {
    const list = [
      m('u1', 'zoe', 'player'),
      m('u2', 'Anna', 'player'),
      m('u3', 'Mia', 'manager'),
      m('u5', 'anna', 'player'),
      m('u4', 'Bea', 'manager'),
      m('u0', 'Anna', 'player'),
    ];
    expect(sortMembers(list).map((x) => x.userId)).toEqual(['u4', 'u3', 'u0', 'u2', 'u5', 'u1']);
    expect(list[0]?.userId).toBe('u1'); // a copy is sorted
  });

  it('puts members without a name last within their role', () => {
    const list = [
      m('u1', '', 'player'),
      m('u2', 'Zoe', 'player'),
      m('u3', '  ', 'manager'),
      m('u4', 'Anna', 'player'),
      m('u5', 'Bea', 'manager'),
      m('u0', '', 'player'),
    ];
    expect(sortMembers(list).map((x) => x.userId)).toEqual(['u5', 'u3', 'u4', 'u2', 'u0', 'u1']);
  });

  it('keeps a stable order for the same name and role', () => {
    const list = [m('b', 'Anna', 'player'), m('a', 'Anna', 'player'), m('a', 'Anna', 'player')];
    expect(sortMembers(list).map((x) => x.userId)).toEqual(['a', 'a', 'b']);
  });
});

describe('defaults', () => {
  it('offers 1, 7 and 30 days; a new invite is for a player for 7 days', () => {
    expect(INVITE_DAYS).toEqual([1, 7, 30]);
    // Audit H5: manager codes are valid 7 days at most on the server.
    expect(inviteDayOptions('player')).toEqual([1, 7, 30]);
    expect(inviteDayOptions('manager')).toEqual([1, 7]);
    expect(inviteDaysFor('manager', 30)).toBe(7);
    expect(inviteDaysFor('manager', 1)).toBe(1);
    expect(inviteDaysFor('player', 30)).toBe(30);
    expect(DEFAULT_INVITE_DAYS).toBe(7);
    expect(DEFAULT_INVITE_ROLE).toBe('player');
  });
});
