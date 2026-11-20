import { useCallback, useState } from 'react';

import { buildExport, exportFileName, serializeExport } from '@/domain/exportSchema';
import type { Team } from '@/domain/types';
import { t } from '@/i18n/en';
import { saveTextFile } from '@/lib/fileTransfer';
import { selectAppData, useAppStore } from '@/store';

import type { Status } from './StatusMessage';

/** Exports everything, or one team, as a .json file (download on web, share sheet on phone). */
export function useExport() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const exportData = useCallback(async (team?: Team) => {
    const now = new Date();
    const file = buildExport(selectAppData(useAppStore.getState()), { teamId: team?.id, now });
    const fileName = exportFileName(now, team?.name);
    setBusy(true);
    setStatus(null);
    try {
      await saveTextFile(fileName, serializeExport(file), {
        dialogTitle: t.transfer.export.dialogTitle,
      });
      setStatus({ tone: 'success', text: t.transfer.export.done(fileName) });
    } catch {
      setStatus({ tone: 'error', text: t.transfer.export.failed });
    } finally {
      setBusy(false);
    }
  }, []);

  return { exportData, status, busy };
}
