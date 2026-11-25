import { syncStatusKey, type SyncStatusKey } from '@/domain/syncStatusKey';
import { useT } from '@/i18n';
import {
  useAppStore,
  useSession,
  useSessionRestoring,
  useSyncAccount,
  useSyncStatus,
} from '@/store';

/**
 * v10: which status text to show (`syncStatusKey`): phase `off` only says "Not signed in" when
 * there is no session; signed in without shared teams it says "No shared teams".
 */
export function useSyncStatusKey(): SyncStatusKey {
  const { phase } = useSyncStatus();
  const session = useSession();
  const restoring = useSessionRestoring();
  const account = useSyncAccount();
  const userId = session?.userId ?? account?.userId;
  const sharedTeams = useAppStore(
    (s) => Object.values(s.sync.teams).filter((m) => m.userId === userId).length,
  );
  return syncStatusKey(phase, session !== null || (restoring && account !== null), sharedTeams);
}

/** v10: "Synced · 2 changes waiting" — the sync status plus the pending count. */
export function useStatusLine(): string {
  const t = useT();
  const { pending } = useSyncStatus();
  const text = t.sync.status[useSyncStatusKey()];
  return pending > 0 ? `${text} · ${t.sync.status.pending(pending)}` : text;
}
