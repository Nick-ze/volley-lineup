import { formatDate, formatOptionalDate, parseDateInput, todayInput, todayIso } from './dates';

describe('formatDate', () => {
  it('shows an ISO date as dd.mm.yy', () => {
    expect(formatDate('2026-11-22')).toBe('22.11.26');
    expect(formatDate('2027-01-05')).toBe('05.01.27');
    expect(formatDate('1999-12-31')).toBe('31.12.99');
  });

  it('uses the date part of an ISO timestamp', () => {
    expect(formatDate('2026-11-22T17:25:23.000Z')).toBe('22.11.26');
  });

  it('returns anything else unchanged', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('soon')).toBe('soon');
    expect(formatDate('22.11.26')).toBe('22.11.26');
  });
});

describe('formatOptionalDate', () => {
  it('is empty without a date', () => {
    expect(formatOptionalDate(undefined)).toBe('');
    expect(formatOptionalDate('')).toBe('');
  });

  it('formats a date', () => {
    expect(formatOptionalDate('2026-03-01')).toBe('01.03.26');
  });
});

describe('parseDateInput', () => {
  it('accepts dd.mm.yy as 20yy', () => {
    expect(parseDateInput('22.11.26')).toBe('2026-11-22');
    expect(parseDateInput('01.01.00')).toBe('2000-01-01');
    expect(parseDateInput('31.12.99')).toBe('2099-12-31');
  });

  it('accepts single-digit day and month', () => {
    expect(parseDateInput('1.2.27')).toBe('2027-02-01');
    expect(parseDateInput('5.11.2026')).toBe('2026-11-05');
  });

  it('accepts dd.mm.yyyy', () => {
    expect(parseDateInput('22.11.2026')).toBe('2026-11-22');
  });

  it('keeps accepting ISO', () => {
    expect(parseDateInput('2026-11-22')).toBe('2026-11-22');
  });

  it('ignores surrounding spaces', () => {
    expect(parseDateInput('  22.11.26 ')).toBe('2026-11-22');
    expect(parseDateInput(' 2026-11-22 ')).toBe('2026-11-22');
  });

  it('rejects dates that do not exist', () => {
    expect(parseDateInput('31.02.26')).toBeNull();
    expect(parseDateInput('29.02.26')).toBeNull();
    expect(parseDateInput('0.1.26')).toBeNull();
    expect(parseDateInput('1.13.26')).toBeNull();
    expect(parseDateInput('1.0.26')).toBeNull();
    expect(parseDateInput('2026-02-30')).toBeNull();
    expect(parseDateInput('2026-13-01')).toBeNull();
  });

  it('accepts 29 February in a leap year', () => {
    expect(parseDateInput('29.02.28')).toBe('2028-02-29');
  });

  it('rejects other formats', () => {
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('22.11.')).toBeNull();
    expect(parseDateInput('22.11')).toBeNull();
    expect(parseDateInput('22.11.226')).toBeNull();
    expect(parseDateInput('11/22/2026')).toBeNull();
    expect(parseDateInput('2026-1-5')).toBeNull();
    expect(parseDateInput('tomorrow')).toBeNull();
  });

  it('round-trips with formatDate', () => {
    for (const iso of ['2026-11-22', '2030-02-28', '2000-07-04']) {
      expect(parseDateInput(formatDate(iso))).toBe(iso);
    }
  });
});

describe('today', () => {
  it('uses the local calendar day', () => {
    const now = new Date(2026, 10, 22, 23, 30);
    expect(todayIso(now)).toBe('2026-11-22');
    expect(todayInput(now)).toBe('22.11.26');
    expect(todayIso(new Date(2027, 0, 3))).toBe('2027-01-03');
  });
});
