/**
 * v8: a team without a picture is shown by its initial in a coloured circle (docs/PLAN.md
 * §31.8). The colour comes from a palette, picked by the team's id so it doesn't change when the
 * team is renamed. Pure functions, no React.
 */

/** The team name's first letter in upper case ("É" for "élan", "🏐" for "🏐 Club"), or "?". */
export function teamInitial(name: string): string {
  // By code point, so an emoji or astral letter isn't cut in half.
  const first = [...name.trim()][0];
  return first === undefined ? '?' : first.toLocaleUpperCase();
}

/** A stable, non-negative hash of `key` (FNV-1a, 32 bit). */
function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The palette colour for `key` (the team id), always the same for the same key. */
export function teamAvatarColor(key: string, palette: readonly string[]): string {
  if (palette.length === 0) throw new Error('teamAvatarColor: empty palette');
  return palette[hash(key) % palette.length] as string;
}
