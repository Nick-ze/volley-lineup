/**
 * v8: first name first (docs/PLAN.md §31.7). Wherever a player is named, the first name comes
 * first and is the part kept when space is short. The last name (or its initial) is added only
 * when another player of the same team has the same first name. Pure functions, no React.
 */
import type { Player } from './types';

type Named = Pick<Player, 'id' | 'firstName' | 'lastName'>;

/** Lower case without accents and surrounding spaces, for comparing names. */
function fold(text: string): string {
  return text.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "Anna Meier": first name first, single spaces, no stray spaces when one part is empty. */
export function fullName(player: Pick<Player, 'firstName' | 'lastName'>): string {
  return `${player.firstName.trim()} ${player.lastName.trim()}`.trim();
}

/**
 * The short name shown when space is short: the first name ("Anna"). When a teammate shares
 * the first name, the last name's initial is added ("Anna M."); when that is shared too, the
 * whole last name ("Anna Meier"). A player without a first name is shown by the last name.
 * `teammates` may include the player themself; players are compared by id.
 */
export function shortName(player: Named, teammates: readonly Named[]): string {
  const first = player.firstName.trim();
  const last = player.lastName.trim();
  if (first === '') return last;
  const others = teammates.filter((p) => p.id !== player.id && fold(p.firstName) === fold(first));
  if (others.length === 0 || last === '') return first;
  const initial = (text: string) => fold(text).slice(0, 1);
  const initialShared = others.some((p) => initial(p.lastName) === initial(last));
  return initialShared ? `${first} ${last}` : `${first} ${last.slice(0, 1)}.`;
}

/** The short names of a whole team at once, by player id. */
export function shortNames(players: readonly Named[]): Map<string, string> {
  return new Map(players.map((p) => [p.id, shortName(p, players)]));
}

/** "#7 Anna" (with the short name). */
export function numberAndName(
  player: Named & Pick<Player, 'number'>,
  teammates: readonly Named[],
): string {
  const name = shortName(player, teammates);
  return name === '' ? `#${player.number}` : `#${player.number} ${name}`;
}
