/**
 * v12.2 hosted tournaments: the optional players of a team — validation of the player form and
 * how a player is named ("#6" or "Kelly").
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import { MAX_NAME_LENGTH } from './syncSchema';
import type { HostedPlayer, HostedPlayerLabel, HostedTeam } from './types';

export const MAX_HOSTED_PLAYERS = 30;
export const MAX_HOSTED_PLAYER_NUMBER = 999;
export const DEFAULT_PLAYER_LABEL: HostedPlayerLabel = 'number';

/** How a team's players are named: by number unless the team says "by name". */
export const playerLabelOf = (team: Pick<HostedTeam, 'playerLabel'>): HostedPlayerLabel =>
  team.playerLabel ?? DEFAULT_PLAYER_LABEL;

/** A team's players: by number (those without one last), then by name, then as added. */
export function playersOfTeam(players: readonly HostedPlayer[], teamId: string): HostedPlayer[] {
  const own = players.filter((p) => p.teamId === teamId);
  const index = new Map(own.map((p, i) => [p.id, i]));
  const numberOf = (p: HostedPlayer) => p.number ?? Number.MAX_SAFE_INTEGER;
  const nameOf = (p: HostedPlayer) => p.name ?? '';
  return own.sort(
    (x, y) =>
      numberOf(x) - numberOf(y) ||
      nameOf(x).localeCompare(nameOf(y), undefined, { numeric: true }) ||
      (index.get(x.id) as number) - (index.get(y.id) as number),
  );
}

export interface PlayerRef {
  /** What the team's setting asks for when the player has it: "#6" or "Kelly". */
  short: string;
  /** Everything known: "#6 Kelly", "#6" or "Kelly". */
  full: string;
}

/**
 * How a player is named. `number`: "#6" (the name when there is no number); `name`: "Kelly"
 * (the number when there is no name). `numberText` formats the number ("#6").
 */
export function playerRef(
  player: Pick<HostedPlayer, 'number' | 'name'>,
  label: HostedPlayerLabel,
  numberText: (n: number) => string,
): PlayerRef {
  const number = player.number === undefined ? '' : numberText(player.number);
  const name = player.name ?? '';
  const short = label === 'name' ? name || number : number || name;
  return { short, full: [number, name].filter((x) => x !== '').join(' ') };
}

export interface HostedPlayerInput {
  number: string;
  name: string;
}

export type HostedPlayerValue = Pick<HostedPlayer, 'number' | 'name'>;
export type HostedPlayerError =
  'REQUIRED' | 'INVALID_NUMBER' | 'DUPLICATE_NUMBER' | 'TOO_LONG' | 'TOO_MANY';

/**
 * Validates the player form: a number (whole, 0–999, unique within the team) and / or a name
 * (≤ `MAX_NAME_LENGTH`), at least one of the two. A new player (no `editingId`) is refused when
 * the team already has 30.
 */
export function validateHostedPlayer(
  input: HostedPlayerInput,
  players: readonly HostedPlayer[],
  teamId: string,
  editingId: string | null = null,
): { ok: true; value: HostedPlayerValue } | { ok: false; error: HostedPlayerError } {
  const own = players.filter((p) => p.teamId === teamId);
  const numberText = input.number.trim();
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (numberText === '' && name === '') return { ok: false, error: 'REQUIRED' };
  if (numberText !== '' && !/^\d{1,3}$/.test(numberText)) {
    return { ok: false, error: 'INVALID_NUMBER' };
  }
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: 'TOO_LONG' };
  const number = numberText === '' ? undefined : Number(numberText);
  if (number !== undefined && own.some((p) => p.id !== editingId && p.number === number)) {
    return { ok: false, error: 'DUPLICATE_NUMBER' };
  }
  if (editingId === null && own.length >= MAX_HOSTED_PLAYERS) {
    return { ok: false, error: 'TOO_MANY' };
  }
  return {
    ok: true,
    value: { ...(number === undefined ? {} : { number }), ...(name === '' ? {} : { name }) },
  };
}
