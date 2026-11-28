/**
 * v9.0: every page's tips — title and text from `t.tour.steps`, plus the small visual guide
 * drawn above them (`TourVisual`). Visual labels are the app's real strings, so the drawing
 * matches the button the tip talks about.
 */
import type { Position, TourPage } from '@/domain/types';
import type { Strings } from '@/i18n';

export type TourVisualSpec =
  /** A button with its label and a finger marker on it. */
  | { kind: 'tap'; label: string }
  /** A list row (avatar, name, ›) with a finger marker. */
  | { kind: 'row'; label: string }
  /** A player chip moving from the bench to a court spot. */
  | { kind: 'drag' }
  /** Tab labels with ← → (swipe between them). */
  | { kind: 'swipe'; tabs: readonly string[] }
  /** A text field with a value and a button. */
  | { kind: 'form'; field: string; value: string; button: string }
  /** A labelled switch. */
  | { kind: 'toggle'; label: string }
  /** Position chips, the first one marked as primary. */
  | { kind: 'chips'; items: readonly Position[] }
  /** A small court with the role of every spot. */
  | { kind: 'court' }
  /** The score with Point us / Point them. */
  | { kind: 'score'; us: string; them: string }
  /** A small bar chart. */
  | { kind: 'stats' };

export interface TourStep {
  title: string;
  text: string;
  visual: TourVisualSpec;
}

type Tip = { title: string; text: string };
const step = (tip: Tip, visual: TourVisualSpec): TourStep => ({ ...tip, visual });

const POSITION_CODES: readonly Position[] = ['S', 'OH', 'MB', 'OPP', 'L'];

const STEPS: Record<TourPage, (t: Strings) => TourStep[]> = {
  profiles: (t) => [
    step(t.tour.steps.profiles.create, {
      kind: 'form',
      field: t.roster.profiles.name,
      value: t.tour.sample.profile,
      button: t.roster.profiles.create,
    }),
    step(t.tour.steps.profiles.open, { kind: 'row', label: t.tour.sample.profile }),
  ],
  teams: (t) => [
    step(t.tour.steps.teams.create, { kind: 'tap', label: t.roster.teams.new }),
    step(t.tour.steps.teams.open, { kind: 'row', label: t.tour.sample.team }),
  ],
  roster: (t) => [
    step(t.tour.steps.roster.add, { kind: 'tap', label: t.roster.roster.addPlayer }),
    step(t.tour.steps.roster.sections, {
      kind: 'swipe',
      tabs: [t.presets.nav.roster, t.presets.nav.matches, t.presets.nav.presets],
    }),
  ],
  playerForm: (t) => [
    step(t.tour.steps.playerForm.name, {
      kind: 'form',
      field: t.roster.player.firstName,
      value: t.tour.sample.player,
      button: t.common.save,
    }),
    step(t.tour.steps.playerForm.positions, { kind: 'chips', items: POSITION_CODES }),
  ],
  matches: (t) => [
    step(t.tour.steps.matches.season, { kind: 'tap', label: t.seasons.list.newSeason }),
    step(t.tour.steps.matches.open, { kind: 'row', label: t.tour.sample.season }),
  ],
  seasonForm: (t) => [
    step(t.tour.steps.seasonForm.form, {
      kind: 'form',
      field: t.seasons.form.name,
      value: t.tour.sample.season,
      button: t.seasons.form.create,
    }),
  ],
  seasonMatches: (t) => [
    step(t.tour.steps.seasonMatches.add, { kind: 'tap', label: t.roster.matches.newMatch }),
    step(t.tour.steps.seasonMatches.tabs, {
      kind: 'swipe',
      tabs: [t.seasons.screen.matches, t.seasons.screen.opponents, t.seasons.screen.stats],
    }),
  ],
  matchForm: (t) => [
    step(t.tour.steps.matchForm.form, {
      kind: 'form',
      field: t.roster.matchForm.opponent,
      value: t.tour.sample.opponent,
      button: t.roster.matchForm.create,
    }),
  ],
  builder: (t) => [
    step(t.tour.steps.builder.drag, { kind: 'drag' }),
    step(t.tour.steps.builder.libero, { kind: 'court' }),
    step(t.tour.steps.builder.serve, { kind: 'tap', label: t.lineup.weServe }),
  ],
  profile: (t) => [
    step(t.tour.steps.profile.look, { kind: 'toggle', label: t.appearance.dyslexiaFont }),
    step(t.tour.steps.profile.tutorial, { kind: 'tap', label: t.tour.profile.button }),
  ],
  settings: (t) => [
    step(t.tour.steps.settings.display, {
      kind: 'toggle',
      label: t.language.display.namesInsteadOfNumbers,
    }),
    step(t.tour.steps.settings.backup, { kind: 'tap', label: t.transfer.export.all }),
  ],
  presets: (t) => [step(t.tour.steps.presets.saved, { kind: 'tap', label: t.presets.list.add })],
  starters: (t) => [step(t.tour.steps.starters.starters, { kind: 'court' })],
  teamStats: (t) => [step(t.tour.steps.teamStats.stats, { kind: 'stats' })],
  playerDetail: (t) => [
    step(t.tour.steps.playerDetail.detail, { kind: 'tap', label: t.playerDetail.edit }),
  ],
  presetEditor: (t) => [step(t.tour.steps.presetEditor.edit, { kind: 'drag' })],
  startersEditor: (t) => [step(t.tour.steps.startersEditor.edit, { kind: 'drag' })],
  seasonOpponents: (t) => [
    step(t.tour.steps.seasonOpponents.add, {
      kind: 'form',
      field: t.seasons.opponents.name,
      value: t.tour.sample.opponent,
      button: t.seasons.opponents.add,
    }),
  ],
  seasonStats: (t) => [step(t.tour.steps.seasonStats.stats, { kind: 'stats' })],
  rotation: (t) => [step(t.tour.steps.rotation.rotations, { kind: 'court' })],
  matchStarters: (t) => [step(t.tour.steps.matchStarters.overview, { kind: 'court' })],
  live: (t) => [
    step(t.tour.steps.live.score, { kind: 'score', us: t.live.pointUs, them: t.live.pointThem }),
    step(t.tour.steps.live.tags, { kind: 'tap', label: t.live.undo }),
    step(t.tour.steps.live.subs, { kind: 'tap', label: t.live.substitution }),
  ],
  performance: (t) => [step(t.tour.steps.performance.overview, { kind: 'stats' })],
  matchStats: (t) => [step(t.tour.steps.matchStats.stats, { kind: 'stats' })],
  account: (t) => [step(t.tour.steps.account.sync, { kind: 'tap', label: t.sync.status.syncNow })],
  signIn: (t) => [
    step(t.tour.steps.signIn.code, {
      kind: 'form',
      field: t.account.signIn.email,
      value: t.tour.sample.email,
      button: t.account.signIn.sendCode,
    }),
  ],
  cloudTeams: (t) => [
    step(t.tour.steps.cloudTeams.choose, { kind: 'toggle', label: t.tour.sample.team }),
  ],
  members: (t) => [step(t.tour.steps.members.invite, { kind: 'tap', label: t.members.newInvite })],
  // v12: hosted tournaments.
  tournaments: (t) => [
    step(t.tour.steps.tournaments.create, { kind: 'tap', label: t.tournament.list.new }),
    step(t.tour.steps.tournaments.open, { kind: 'row', label: t.tour.sample.tournament }),
  ],
  tournamentForm: (t) => [
    step(t.tour.steps.tournamentForm.format, {
      kind: 'form',
      field: t.tournament.form.name,
      value: t.tour.sample.tournament,
      button: t.tournament.form.create,
    }),
  ],
  tournamentTable: (t) => [step(t.tour.steps.tournamentTable.table, { kind: 'stats' })],
  tournamentMatches: (t) => [
    step(t.tour.steps.tournamentMatches.result, { kind: 'row', label: t.tour.sample.opponent }),
    step(t.tour.steps.tournamentMatches.tabs, {
      kind: 'swipe',
      tabs: [t.tournament.screen.table, t.tournament.screen.matches, t.tournament.screen.teams],
    }),
  ],
  tournamentTeams: (t) => [
    step(t.tour.steps.tournamentTeams.add, {
      kind: 'form',
      field: t.tournament.teams.name,
      value: t.tour.sample.opponent,
      button: t.tournament.teams.add,
    }),
  ],
  tournamentTeam: (t) => [
    step(t.tour.steps.tournamentTeam.matches, { kind: 'row', label: t.tour.sample.opponent }),
  ],
  tournamentResult: (t) => [
    step(t.tour.steps.tournamentResult.sets, {
      kind: 'form',
      field: t.tournament.result.set(1),
      value: t.tour.sample.setScore,
      button: t.common.save,
    }),
  ],
  join: (t) => [
    step(t.tour.steps.join.code, {
      kind: 'form',
      field: t.members.join.code,
      value: t.tour.sample.inviteCode,
      button: t.members.join.submit,
    }),
  ],
};

/** The page's tips in the current language. */
export const tourSteps = (t: Strings, page: TourPage): TourStep[] => STEPS[page](t);
