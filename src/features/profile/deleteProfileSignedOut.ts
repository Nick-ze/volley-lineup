import { signOut } from '@/lib/sync';
import { useAppStore } from '@/store';

/** v10: whether the device's account is linked to this profile (its shared teams live there). */
export const isLinkedProfile = (profileId: string): boolean =>
  useAppStore.getState().sync.account?.profileId === profileId;

/**
 * v10: deletes a profile; when the account is linked to it, signs out on this device first
 * (docs/V10_SYNC_DESIGN.md §3.10). The cloud teams are untouched. Use it wherever a profile is
 * deleted (Profile tab, profile picker).
 */
export function deleteProfileSignedOut(profileId: string): void {
  if (isLinkedProfile(profileId)) void signOut();
  useAppStore.getState().deleteProfile(profileId);
}
