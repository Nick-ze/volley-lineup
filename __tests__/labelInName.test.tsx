/**
 * Guard for WCAG 2.5.3 "Label in Name" (v8.3, audit B25 / B26): on the main screens, in English
 * and German, every control (button, tab, link, switch, radio, …) that shows text and has an
 * `accessibilityLabel` must have a label that STARTS with the shown text, so voice-control users
 * can say what they see. Extra context goes after it ("Point us: we won the rally").
 *
 * - The shown text is the control's first text (a card's or chip's title); texts inside nested
 *   labelled elements and decorative parts hidden from assistive tech (photo / avatar
 *   fallbacks) don't count. Symbols and icons (‹ › ↺ ↻ ✕ · …) are ignored, and so is case.
 * - The screens are the ones `scripts/screenshots.js` shoots, with the export golden data.
 *   Hidden pager pages are mounted, so they are checked too.
 * - The few intended exceptions are listed in `EXCEPTIONS` below, each with its reason.
 */
import { fireEvent, screen } from '@testing-library/react-native';

import { fullName, shortName } from '@/domain/playerNames';
import type { Player, PointEvent, PointKind, SetNumber, Side } from '@/domain/types';
import { playerDescription, playerRef } from '@/features/live/format';
import { dictionaries, type Strings } from '@/i18n';
import { en } from '@/i18n/en';
import type { Language } from '@/store';
import {
  includeHidden,
  makePlayer,
  makeSet,
  type QueriedElement,
  renderApp,
  seedApp,
  seedGolden,
} from '@/test-utils';

// Expo Router warns about every modal route rendered as the first screen; not what this tests.
beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

const SCREENS: [string, string][] = [
  ['profiles', '/'],
  ['teams', '/teams'],
  ['profile', '/profile'],
  ['settings', '/settings'],
  ['team-roster', '/team/t1?tab=roster'],
  ['team-matches', '/team/t1?tab=matches'],
  ['team-presets', '/team/t1?tab=presets'],
  ['team-starters', '/team/t1?tab=starters'],
  ['team-stats', '/team/t1?tab=stats'],
  ['team2-roster', '/team/t2?tab=roster'],
  ['player-detail', '/team/t1/players/p1'],
  ['player-edit', '/team/t1/player?playerId=p1'],
  ['match-new', '/team/t1/match-new?seasonId=s1'],
  ['season-new', '/team/t1/season-new'],
  ['preset', '/team/t1/preset/ps2'],
  ['team-starters-editor', '/team/t1/starters'],
  ['season-matches', '/team/t1/season/s1?tab=matches'],
  ['season-opponents', '/team/t1/season/s1?tab=opponents'],
  ['season-stats', '/team/t1/season/s1?tab=stats'],
  ['builder-set1', '/match/m1?set=1'],
  ['builder-set3', '/match/m1?set=3'],
  ['rotation', '/match/m1/rotation'],
  ['match-starters', '/match/m1/starters'],
  ['live-current', '/match/m1/live'],
  ['live-set1', '/match/m1/live?set=1'],
  ['live-not-started', '/match/m2/live'],
  ['performance', '/match/m1/performance?set=all'],
  ['performance-player', '/match/m1/performance?set=1&player=p1'],
  ['match-stats', '/match/m1/stats'],
];

const CONTROL_ROLES = new Set([
  'button',
  'link',
  'tab',
  'checkbox',
  'radio',
  'switch',
  'togglebutton',
  'menuitem',
  'combobox',
]);

type Props = Record<string, unknown>;
type Node = QueriedElement | string;
const propsOf = (node: QueriedElement): Props => node.props as Props;

function isControl(node: QueriedElement): boolean {
  const p = propsOf(node);
  const role = p.accessibilityRole ?? p.role;
  return (typeof role === 'string' && CONTROL_ROLES.has(role)) || typeof p.onClick === 'function';
}

const hiddenFromAT = (p: Props) =>
  p.accessibilityElementsHidden === true ||
  p['aria-hidden'] === true ||
  p.importantForAccessibility === 'no-hide-descendants';

/** Lower case, symbols and icon glyphs dropped, spaces collapsed. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s.,:;!?()/+#%&–-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const textOf = (n: Node): string =>
  typeof n === 'string' ? n : n.children.map((c) => textOf(c as Node)).join('');

/** The texts a control shows, in order (one per text element). */
function shownTexts(control: QueriedElement): string[] {
  const out: string[] = [];
  const walk = (n: Node, top: boolean) => {
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    const p = propsOf(n);
    if (!top && (typeof p.accessibilityLabel === 'string' || hiddenFromAT(p))) return;
    if (n.type === 'Text') {
      out.push(textOf(n));
      return;
    }
    for (const child of n.children) walk(child as Node, false);
  };
  walk(control, true);
  // Icons ("+", "✕") are not text a user would say.
  return out.map(norm).filter((s) => /[\p{L}\p{N}]/u.test(s));
}

/**
 * Intended exceptions. Each returns true when the pair is fine although the label doesn't start
 * with the shown text.
 */
const EXCEPTIONS: { reason: string; ok: (shown: string, label: string, l: Language) => boolean }[] =
  [
    {
      // Rotation numbers, jersey numbers on chips / court spots / cards: the label says what the
      // number is ("Show rotation 4", "Number 7, Anna Meier, Setter", "Position 4, 7 …").
      reason: 'a bare number is spoken with what it counts; the label contains the number',
      ok: (shown, label) =>
        /^#?\d+$/.test(shown) && new RegExp(`(^|\\D)${shown.replace('#', '')}(\\D|$)`).test(label),
    },
    {
      // Position chips and role tags show the short code (S, OH, MB, OPP, L, DS); the label
      // spells out the position ("Outside Hitter", "Make Setter the primary position").
      reason: 'a position abbreviation is spoken as the full position name',
      ok: (shown, label, l) => {
        const names = dictionaries[l].positions as Record<string, string>;
        const full = Object.entries(names).find(([code]) => code.toLowerCase() === shown)?.[1];
        return full !== undefined && norm(label).includes(norm(full));
      },
    },
  ];

/**
 * True when `label` starts with `shown` as whole words: what follows the shown text is the end,
 * a space or punctuation ("Angriff" is not the start of "Angriffspunkt").
 */
function startsWithText(label: string, shown: string): boolean {
  const l = norm(label);
  const s = norm(shown);
  return l.startsWith(s) && (l.length === s.length || /[\s.,:;!?()–-]/.test(l.charAt(s.length)));
}

function failures(language: Language): string[] {
  const out = new Set<string>();
  for (const node of screen.queryAllByLabelText(/./, includeHidden)) {
    const label = propsOf(node).accessibilityLabel;
    if (typeof label !== 'string' || !isControl(node)) continue;
    const [shown] = shownTexts(node);
    if (shown === undefined || startsWithText(label, shown)) continue;
    if (EXCEPTIONS.some((e) => e.ok(shown, norm(label), language))) continue;
    out.add(`"${shown}" → "${label}"`);
  }
  return [...out];
}

describe.each<Language>(['en', 'de'])('label in name on the screens (%s)', (language) => {
  it.each(SCREENS)('%s: control labels start with the shown text', async (_name, url) => {
    seedGolden(language);
    await renderApp(url);
    expect(failures(language)).toEqual([]);
  });
});

/**
 * Controls the screens above don't show at rest (dialogs, the tag row after a rally, the set-won
 * panel, the match summary, the next-set setup, …): their shown text and label, from the strings.
 */
const PAIRS: [string, (t: Strings) => string, (t: Strings) => string][] = [
  [
    'description lock',
    (t) => t.playerDetail.description.lock,
    (t) => t.playerDetail.description.lockLabel,
  ],
  [
    'description show',
    (t) => t.playerDetail.description.show,
    (t) => t.playerDetail.description.showLabel,
  ],
  ['lineup clear', (t) => t.lineup.clear, (t) => t.lineup.clearLabel],
  [
    'libero suggest',
    (t) => t.lineup.liberoReplaces.suggest,
    (t) => t.lineup.liberoReplaces.suggestLabel,
  ],
  ['placement cancel', (t) => t.roles.confirm.cancel, (t) => t.roles.confirm.cancelLabel],
  ['placement confirm', (t) => t.roles.confirm.confirm, (t) => t.roles.confirm.confirmLabel],
  [
    'formation confirm',
    (t) => t.roles.confirm.confirm,
    (t) => t.roles.confirm.confirmFormationLabel,
  ],
  ['preset apply', () => 'Alpha', (t) => t.presets.apply.presetLabel('Alpha')],
  ['preset apply cancel', (t) => t.presets.apply.cancel, (t) => t.presets.apply.cancelLabel],
  [
    'rotate ccw',
    (t) => t.lineup.rotate.counterclockwise,
    (t) => t.lineup.rotate.counterclockwiseLabel,
  ],
  ['rotate cw', (t) => t.lineup.rotate.clockwise, (t) => t.lineup.rotate.clockwiseLabel],
  ['template system', () => '5-1', (t) => t.lineup.template.systemLabel('5-1')],
  ['template cancel', (t) => t.lineup.template.cancel, (t) => t.lineup.template.cancelLabel],
  ['live formation cancel', (t) => t.common.cancel, (t) => t.live.setup.formationCancelLabel],
  [
    'live formation confirm',
    (t) => t.live.setup.formationConfirm,
    (t) => t.live.setup.formationConfirmLabel,
  ],
  ['summary back', (t) => t.live.summary.back, (t) => t.live.summary.backLabel],
  [
    'summary / set won undo (us)',
    (t) => t.live.undoLastPoint,
    (t) => t.live.undoLastPointLabel(true),
  ],
  [
    'summary / set won undo (them)',
    (t) => t.live.undoLastPoint,
    (t) => t.live.undoLastPointLabel(false),
  ],
  ['next set edit', (t) => t.live.setup.edit, (t) => t.live.setup.editLabel],
  ['next set undo', (t) => t.live.undoLastPoint, (t) => t.live.undoLastPointAcross(1)],
  ['set won start', (t) => t.live.startSet(2), (t) => t.live.startSetLabel(2)],
  ['setup rotate ccw', (t) => t.live.setup.rotateCcw, (t) => t.live.setup.rotateCcwLabel],
  ['setup rotate cw', (t) => t.live.setup.rotateCw, (t) => t.live.setup.rotateCwLabel],
  ['setup starters', (t) => t.live.setup.starters, (t) => t.live.setup.startersLabel],
  ['setup copy', (t) => t.live.setup.copy(1), (t) => t.live.setup.copyLabel(1)],
  ['setup preset', () => 'Alpha', (t) => t.live.setup.presetLabel('Alpha')],
  ['sub cancel', (t) => t.live.cancelSub, (t) => t.live.cancelSubLabel],
  ['undo point (us)', (t) => t.live.undo, (t) => t.live.undoPoint(true)],
  ['undo point (them)', (t) => t.live.undo, (t) => t.live.undoPoint(false)],
  ['undo across sets', (t) => t.live.undo, (t) => t.live.undoAcross(1)],
  ['undo substitution', (t) => t.live.undo, (t) => t.live.undoSub('Anna', 'Mia')],
  ['photo cancel', (t) => t.common.cancel, (t) => t.photos.cancelChoiceLabel],
  ['player edit', (t) => t.playerDetail.edit, (t) => t.playerDetail.editLabel('Anna Meier')],
  ['preset rename', (t) => t.common.rename, (t) => t.presets.list.renameLabel('Alpha')],
  [
    'preset duplicate',
    (t) => t.presets.list.duplicate,
    (t) => t.presets.list.duplicateLabel('Alpha'),
  ],
  ['preset delete', (t) => t.common.delete, (t) => t.presets.list.deleteLabel('Alpha')],
  ['starters set', (t) => t.presets.starters.set, (t) => t.presets.starters.setLabel],
  ['print', (t) => t.print.button, (t) => t.print.buttonLabel],
  ['print with results', (t) => t.print.choice.withResults, (t) => t.print.choice.withResultsLabel],
  ['print lineups only', (t) => t.print.choice.lineupsOnly, (t) => t.print.choice.lineupsOnlyLabel],
  ['print cancel', (t) => t.print.choice.cancel, (t) => t.print.choice.cancelLabel],
  ['profile edit', (t) => t.common.edit, (t) => t.roster.profiles.rename('Coach')],
  ['profile delete', (t) => t.common.delete, (t) => t.roster.profiles.delete('Coach')],
  ['team edit', (t) => t.common.edit, (t) => t.roster.teams.rename('Herren 1')],
  ['team delete', (t) => t.common.delete, (t) => t.roster.teams.delete('Herren 1')],
  ['match delete', (t) => t.common.delete, (t) => t.roster.matches.delete('Lions')],
  [
    'opponent rename',
    (t) => t.seasons.opponents.rename,
    (t) => t.seasons.opponents.renameLabel('Lions'),
  ],
  [
    'opponent delete',
    (t) => t.seasons.opponents.delete,
    (t) => t.seasons.opponents.deleteLabel('Lions'),
  ],
  ['season edit', (t) => t.seasons.screen.edit, (t) => t.seasons.screen.editLabel('Liga')],
  [
    'season opponent filter',
    (t) => t.seasons.matches.filter('Lions'),
    (t) => t.seasons.matches.filterLabel('Lions'),
  ],
  ['opponent add', (t) => t.seasons.opponents.add, (t) => t.seasons.opponents.addLabel],
  ['performance back', (t) => t.performance.back, (t) => t.performance.backLabel],
  ['performance set', (t) => t.performance.filter.set(1), (t) => t.performance.filter.setLabel(1)],
  ['performance all', (t) => t.performance.filter.all, (t) => t.performance.filter.allLabel],
  ['preset editor rename', (t) => t.presets.editor.rename, (t) => t.presets.editor.renameLabel],
];

/* Tag chips and libero chips, built with the components' own helpers, for every kind. */
const anna: Player = {
  id: 'p7',
  teamId: 't',
  firstName: 'Anna',
  lastName: 'Meier',
  number: 7,
  positions: ['OH'],
  active: true,
};
const annaToo: Player = { ...anna, id: 'p8', lastName: 'Marti', number: 8 };
const team = new Map([anna, annaToo].map((p) => [p.id, p]));
const KINDS = Object.keys(en.tags.kinds) as PointKind[];
for (const kind of KINDS) {
  PAIRS.push(
    [
      `tag kind ${kind} choose`,
      (t) => t.tags.kinds[kind],
      (t) => t.tags.chooseKind(t.tags.kinds[kind], t.tags.kindNames[kind]),
    ],
    [
      `tag kind ${kind} clear`,
      (t) => t.tags.kinds[kind],
      (t) => t.tags.clearKind(t.tags.kinds[kind], t.tags.kindNames[kind]),
    ],
    [
      `tag player choose (${kind})`,
      (t) => playerRef(t, team, anna.id),
      (t) =>
        t.tags.choosePlayer(
          playerRef(t, team, anna.id),
          playerDescription(t, anna),
          t.tags.kindNames[kind],
        ),
    ],
  );
}
PAIRS.push(
  [
    'tag player clear',
    (t) => playerRef(t, team, anna.id),
    (t) => t.tags.clearPlayer(playerRef(t, team, anna.id), playerDescription(t, anna)),
  ],
  [
    'libero replaces chip',
    (t) => t.lineup.liberoReplaces.optionText(anna.number, shortName(anna, [anna])),
    (t) => t.lineup.liberoReplaces.optionLabel(anna.number, fullName(anna)),
  ],
);

describe.each<Language>(['en', 'de'])('label in name of other controls (%s)', (language) => {
  it.each(PAIRS)('%s', (_name, shown, label) => {
    const t = dictionaries[language];
    // The label must start with the shown text (the rest is the extra context).
    expect({ shown: shown(t), label: label(t), ok: startsWithText(label(t), shown(t)) }).toEqual({
      shown: shown(t),
      label: label(t),
      ok: true,
    });
  });
});

/*
 * The live screen after a rally (tag row: kind chips, player chips, error types), at the end of
 * a set (set-won panel, next-set setup) and at the end of the match (summary), really rendered.
 */
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const pressFirst = (testID: RegExp) => fireEvent.press(screen.getAllByTestId(testID)[0]!);
const rally = (winner: Side, n: number): PointEvent[] =>
  Array.from({ length: n }, () => ({ type: 'point', winner }));
const livePlayers = [
  makePlayer(1, 'Sina', ['S']),
  makePlayer(2, 'Olga', ['OH']),
  makePlayer(3, 'Mara', ['MB']),
  makePlayer(4, 'Opal', ['OPP']),
  makePlayer(5, 'Ola', ['OH']),
  makePlayer(6, 'Mia', ['MB']),
  makePlayer(7, 'Lea', ['L']),
  makePlayer(8, 'Sara', ['OH']),
];

describe.each<Language>(['en', 'de'])('label in name in live mode (%s)', (language) => {
  it('tag row: kind chips, player chips, error types', async () => {
    seedGolden(language);
    await renderApp('/match/m1/live');
    await press('point-us');
    expect(failures(language)).toEqual([]);
    await press('tag-kill');
    expect(failures(language)).toEqual([]);
    await pressFirst(/^tag-player-/);
    expect(failures(language)).toEqual([]);
    await press('point-them');
    expect(failures(language)).toEqual([]);
    await press('tag-ourError');
    expect(failures(language)).toEqual([]);
  });

  it('set won panel and next-set setup', async () => {
    seedApp({
      players: livePlayers,
      matches: [
        {
          id: 'm1',
          opponent: 'Rivals',
          date: '2026-11-20',
          home: true,
          sets: [makeSet({ events: rally('us', 24) })],
        },
      ],
      language,
    });
    await renderApp('/match/m1/live');
    await press('point-us');
    expect(screen.getByTestId('set-won-panel')).toBeTruthy();
    expect(failures(language)).toEqual([]);
    await press('next-set');
    expect(screen.getByTestId('set-setup')).toBeTruthy();
    expect(failures(language)).toEqual([]);
  });

  it('match summary', async () => {
    const won = (n: SetNumber, us: number) => makeSet({ setNumber: n, events: rally('us', us) });
    seedApp({
      players: livePlayers,
      matches: [
        {
          id: 'm1',
          opponent: 'Rivals',
          date: '2026-11-20',
          home: true,
          sets: [won(1, 25), won(2, 25), won(3, 24)],
        },
      ],
      language,
    });
    await renderApp('/match/m1/live');
    await press('point-us');
    expect(screen.getByTestId('match-summary')).toBeTruthy();
    expect(failures(language)).toEqual([]);
  });
});
