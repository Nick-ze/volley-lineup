/**
 * v10: invite codes and team members (docs/V10_SYNC_DESIGN.md §1.3, §6 rule 9). Pure.
 *
 * - A code has 10 characters of a 32-character alphabet without look-alikes (no I, O, 0, 1);
 *   it is shown as "ABCDE-FGHJK". People may type it in lower case, with spaces or dashes, or
 *   paste the whole join link — `normalizeInviteCode` accepts all of these.
 * - The join link opens the app (`volleylineup://join?code=…`, the scheme from `app.json`) or,
 *   given the web app's address, the web version (`…/join?code=…`).
 */
import type { TeamRole } from './types';

export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 10;
/** The app's URL scheme (`app.json` → `expo.scheme`). */
export const APP_SCHEME = 'volleylineup';

/** How long a new invite is valid, in days (the server allows 1–30). */
export const INVITE_DAYS = [1, 7, 30] as const;
export type InviteDays = (typeof INVITE_DAYS)[number];
export const DEFAULT_INVITE_DAYS: InviteDays = 7;
export const DEFAULT_INVITE_ROLE: TeamRole = 'player';

const CODE_PATTERN = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);
const CODE_PARAM = /[?&]code=([^&#\s]*)/i;

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The code in `input` (a code or a join link), upper case without spaces or dashes; null when it
 * isn't 10 characters of the invite alphabet.
 */
export function normalizeInviteCode(input: string): string | null {
  const fromLink = CODE_PARAM.exec(input)?.[1];
  const raw = fromLink === undefined ? input : decode(fromLink);
  const code = raw.replace(/[\s-]+/g, '').toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** `ABCDEFGHJK` → `ABCDE-FGHJK` (anything else is returned unchanged). */
export function formatInviteCode(code: string): string {
  if (code.length !== INVITE_CODE_LENGTH) return code;
  const half = INVITE_CODE_LENGTH / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** The link that opens "Join a team" with the code filled in: the app, or the web app at `webBase`. */
export function joinLink(code: string, webBase?: string): string {
  const query = `join?code=${encodeURIComponent(code)}`;
  if (webBase) return `${webBase.replace(/\/+$/, '')}/${query}`;
  return `${APP_SCHEME}://${query}`;
}

/** The parts of an invite the rules below need. */
export interface InviteTimes {
  expiresAt: string;
  revokedAt?: string | null;
  /** How often the code was used, and how often it works in all (null / missing: no limit). */
  uses?: number;
  maxUses?: number | null;
}

/** True when the invite's time is up at `now` (ms); an unreadable expiry counts as expired. */
export function inviteExpired(invite: InviteTimes, now: number): boolean {
  const expires = Date.parse(invite.expiresAt);
  return Number.isNaN(expires) || expires <= now;
}

/** True when the code has been used as often as it works (manager codes work once). */
export function inviteUsedUp(invite: InviteTimes): boolean {
  return invite.maxUses != null && (invite.uses ?? 0) >= invite.maxUses;
}

/**
 * Invites that still work at `now` (not revoked, not expired, not used up), soonest expiry
 * first.
 */
export function activeInvites<T extends InviteTimes>(invites: readonly T[], now: number): T[] {
  return invites
    .filter((invite) => !invite.revokedAt && !inviteExpired(invite, now) && !inviteUsedUp(invite))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

/** The parts of a member the sort needs. */
export interface MemberSortKey {
  userId: string;
  displayName: string;
  role: TeamRole;
}

const ROLE_ORDER: Record<TeamRole, number> = { manager: 0, player: 1 };

const unnamed = (member: MemberSortKey): number => (member.displayName.trim() === '' ? 1 : 0);

/**
 * Managers first, then by name (case-insensitive; members without a name last within their
 * role), then by user id so the order is stable.
 */
export function sortMembers<T extends MemberSortKey>(members: readonly T[]): T[] {
  return [...members].sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      unnamed(a) - unnamed(b) ||
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }) ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
}
