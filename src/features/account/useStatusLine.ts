import { useT } from '@/i18n';
import { useSyncStatus } from '@/store';

/** v10: "Synced · 2 changes waiting" — the sync phase plus the pending count. */
export function useStatusLine(): string {
  const t = useT();
  const { phase, pending } = useSyncStatus();
  const text = t.sync.status[phase];
  return pending > 0 ? `${text} · ${t.sync.status.pending(pending)}` : text;
}
