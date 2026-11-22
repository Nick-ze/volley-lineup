import { de } from './de';
import { en } from './en';
import { dictionaries, stringsFor } from './index';

/** Paths of every leaf (string or function) in a strings object. */
function leaves(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? leaves(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

const counts = { profiles: 1, teams: 2, players: 1, matches: 3, presets: 2, seasons: 1 };

describe('German strings', () => {
  it('have exactly the same keys as English (TypeScript checks this too)', () => {
    expect(leaves(de).sort()).toEqual(leaves(en).sort());
  });

  it('are actually translated (sample of keys)', () => {
    const pairs: [string, string][] = [
      [de.common.save, en.common.save],
      [de.nav.lineup, en.nav.lineup],
      [de.nav.settings, en.nav.settings],
      [de.positions.S, en.positions.S],
      [de.positions.OH, en.positions.OH],
      [de.positions.MB, en.positions.MB],
      [de.positions.OPP, en.positions.OPP],
      [de.positions.DS, en.positions.DS],
      [de.roster.team.rosterTab, en.roster.team.rosterTab],
      [de.roster.matches.home, en.roster.matches.home],
      [de.roster.matches.away, en.roster.matches.away],
      [de.lineup.setTab(2), en.lineup.setTab(2)],
      [de.lineup.weServe, en.lineup.weServe],
      [de.rotation.setterRotation(3), en.rotation.setterRotation(3)],
      [de.transfer.import.summary(counts), en.transfer.import.summary(counts)],
      [de.transfer.danger.title, en.transfer.danger.title],
    ];
    for (const [german, english] of pairs) expect(german).not.toBe(english);
    expect(de.positions.MB).toBe('Mittelblocker');
    expect(de.transfer.import.summary(counts)).toBe(
      '2 Teams, 1 Spieler, 3 Spiele, 1 Saison / Turnier, 2 gespeicherte Aufstellungen, 1 Profil',
    );
  });

  it('are picked by language', () => {
    expect(stringsFor('de')).toBe(de);
    expect(stringsFor('en')).toBe(en);
    expect(Object.keys(dictionaries).sort()).toEqual(['de', 'en']);
  });
});
