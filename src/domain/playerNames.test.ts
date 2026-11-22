import { fullName, numberAndName, shortName, shortNames } from './playerNames';

const p = (id: string, firstName: string, lastName: string, number = 1) => ({
  id,
  firstName,
  lastName,
  number,
});

describe('fullName', () => {
  it('puts the first name first', () => {
    expect(fullName(p('a', 'Anna', 'Meier'))).toBe('Anna Meier');
  });

  it('has no stray spaces when a part is empty', () => {
    expect(fullName(p('a', '', 'Meier'))).toBe('Meier');
    expect(fullName(p('a', ' Anna ', ''))).toBe('Anna');
  });
});

describe('shortName', () => {
  const anna = p('a', 'Anna', 'Meier');
  const bea = p('b', 'Bea', 'Keller');

  it('is the first name when it is unique in the team', () => {
    expect(shortName(anna, [anna, bea])).toBe('Anna');
    expect(shortName(anna, [])).toBe('Anna');
  });

  it('adds the last name initial when a teammate has the same first name', () => {
    const anna2 = p('c', 'Anna', 'Huber');
    expect(shortName(anna, [anna, bea, anna2])).toBe('Anna M.');
    expect(shortName(anna2, [anna, bea, anna2])).toBe('Anna H.');
  });

  it('compares first names ignoring case, accents and spaces', () => {
    const lea = p('a', 'Léa', 'Meier');
    const lea2 = p('b', ' lea', 'Huber');
    expect(shortName(lea, [lea, lea2])).toBe('Léa M.');
  });

  it('uses the whole last name when the initials clash too', () => {
    const anna2 = p('c', 'Anna', 'Müller');
    expect(shortName(anna, [anna, anna2])).toBe('Anna Meier');
    expect(shortName(anna2, [anna, anna2])).toBe('Anna Müller');
  });

  it('keeps the first name alone when there is no last name to tell them apart', () => {
    const anna2 = p('c', 'Anna', '');
    expect(shortName(anna2, [anna, anna2])).toBe('Anna');
  });

  it('falls back to the last name without a first name', () => {
    expect(shortName(p('x', ' ', 'Meier'), [anna])).toBe('Meier');
  });
});

describe('shortNames', () => {
  it('names a whole team by id', () => {
    const team = [p('a', 'Anna', 'Meier'), p('b', 'Anna', 'Huber'), p('c', 'Bea', 'Keller')];
    expect(Object.fromEntries(shortNames(team))).toEqual({ a: 'Anna M.', b: 'Anna H.', c: 'Bea' });
  });
});

describe('numberAndName', () => {
  it('shows "#7 Anna"', () => {
    const anna = p('a', 'Anna', 'Meier', 7);
    expect(numberAndName(anna, [anna])).toBe('#7 Anna');
  });

  it('is only the number without any name', () => {
    expect(numberAndName(p('a', '', '', 3), [])).toBe('#3');
  });
});
