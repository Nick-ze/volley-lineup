import { useCallback, useState } from 'react';

import { buildExport, exportFileName, serializeExport } from '@/domain/exportSchema';
import type { Team } from '@/domain/types';
import { useT } from '@/i18n';
import { saveTextFile } from '@/lib/fileTransfer';
import { selectAppData, useAppStore } from '@/store';

import type { Status } from './StatusMessage';

/** Exports everything, or one team, as a .json file (download on web, share sheet on phone). */
export function useExport() {
  const t = useT();
  // The outcome is kept as data (not text) so the message follows a language switch.
  const [outcome, setOutcome] = useState<{ fileName: string } | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);

  const exportData = useCallback(
    async (team?: Team) => {
      const now = new Date();
      const file = buildExport(selectAppData(useAppStore.getState()), { teamId: team?.id, now });
      const fileName = exportFileName(now, team?.name);
      setBusy(true);
      setOutcome(null);
      try {
        await saveTextFile(fileName, serializeExport(file), {
          dialogTitle: t.transfer.export.dialogTitle,
        });
        setOutcome({ fileName });
      } catch {
        setOutcome('failed');
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const status: Status | null =
    outcome === null
      ? null
      : outcome === 'failed'
        ? { tone: 'error', text: t.transfer.export.failed }
        : { tone: 'success', text: t.transfer.export.done(outcome.fileName) };

  return { exportData, status, busy };
}
