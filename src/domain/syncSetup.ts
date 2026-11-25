/**
 * v10: pure helpers for the account screens (docs/V10_SYNC_DESIGN.md §3.9, §6): which teams the
 * first-sign-in pickers offer, whether this profile is the one signed in, the sign-in form's
 * email / code rules and the "last synced" time. No React, no storage, no backend.
 */
import { formatTimestampDate, pad2 } from './dates';
import type { ManagerProfile, SyncAccount, Team } from './types';

/** Digits in a sign-in code. */
export const CODE_LENGTH = 6;
/** Seconds before another code may be requested. */
export const RESEND_SECONDS = 60;

/** The cloud side of `setupLists` (the sync module's `CloudTeam`). */
export interface CloudTeamEntry {
  teamId: string;
  /** Already shared on this device. */
  onDevice: boolean;
}

export interface SetupLists<T, C> {
  /** This profile's local teams that aren't shared yet (offered for upload, unchecked). */
  upload: T[];
  /** Cloud teams of the account that aren't on this device (offered for download, checked). */
  download: C[];
}

/**
 * The two pickers of Account → Cloud teams. A local team that is also one of the account's cloud
 * teams (an old unlinked copy of it) is offered for download only, so the cloud copy wins.
 */
export function setupLists<T extends Pick<Team, 'id'>, C extends CloudTeamEntry>(
  localTeams: readonly T[],
  linkedTeamIds: readonly string[],
  cloudTeams: readonly C[],
): SetupLists<T, C> {
  const linked = new Set(linkedTeamIds);
  const download = cloudTeams.filter((c) => !c.onDevice && !linked.has(c.teamId));
  const inCloud = new Set(cloudTeams.map((c) => c.teamId));
  const upload = localTeams.filter((team) => !linked.has(team.id) && !inCloud.has(team.id));
  return { upload, download };
}

export interface SessionInfo {
  userId: string;
  email: string;
}

/** How the current profile relates to the account on this device. */
export type AccountLink =
  | { kind: 'noProfile' }
  | { kind: 'signedOut' }
  | { kind: 'signedIn'; email: string }
  /** The device's account belongs to another local profile: sign in there, not here. */
  | { kind: 'otherProfile'; email: string; profileName: string };

export function accountLink(
  session: SessionInfo | null,
  account: SyncAccount | null,
  profileId: string | null,
  profiles: readonly Pick<ManagerProfile, 'id' | 'name'>[],
): AccountLink {
  if (!profileId) return { kind: 'noProfile' };
  if (account && account.profileId !== profileId) {
    const owner = profiles.find((p) => p.id === account.profileId);
    if (owner) return { kind: 'otherProfile', email: account.email, profileName: owner.name };
  }
  const linkedHere = account?.profileId === profileId && account.userId === session?.userId;
  return session && linkedHere ? { kind: 'signedIn', email: session.email } : { kind: 'signedOut' };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A simple check before sending a code: something@something.tld, no spaces. */
export const isPlausibleEmail = (text: string): boolean => EMAIL.test(text.trim());

/** What the code field keeps of typed / pasted text: digits only, at most 6. */
export const codeInput = (text: string): string => text.replace(/\D/g, '').slice(0, CODE_LENGTH);

/** Whole seconds until another code may be sent (0 = now). */
export function resendSecondsLeft(sentAt: number, now: number): number {
  return Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - now) / 1000));
}

/** An ISO timestamp as local `dd.mm.yy HH:MM` (unparseable: shown as it is). */
export function formatSyncTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return formatTimestampDate(timestamp);
  return `${formatTimestampDate(timestamp)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
