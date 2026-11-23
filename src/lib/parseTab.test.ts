import { parseTab } from './parseTab';

const TABS = ['a', 'b', 'c'] as const;

describe('parseTab', () => {
  it('returns a known tab', () => {
    expect(parseTab(TABS, 'b', 'a')).toBe('b');
  });

  it('takes the first value of an array param', () => {
    expect(parseTab(TABS, ['c', 'b'], 'a')).toBe('c');
  });

  it('falls back for unknown, empty or missing values', () => {
    expect(parseTab(TABS, 'nope', 'a')).toBe('a');
    expect(parseTab(TABS, '', 'b')).toBe('b');
    expect(parseTab(TABS, [], 'b')).toBe('b');
    expect(parseTab(TABS, undefined, 'c')).toBe('c');
  });
});
