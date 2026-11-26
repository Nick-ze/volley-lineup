import { useCallback, useState } from 'react';

import { buildExport, exportFileName, serializeExport } from '@/domain/exportSchema';
import { teamsWithDuplicateNumbers } from '@/domain/roster';
import type { Team } from '@/domain/types';
import { useT } from '@/i18n';
import { saveTextFile } from '@/lib/fileTransfer';
import { transferSnapshot, useAppStore } from '@/store';

import type { Status } from './StatusMessage';

/**
 * Exports everything, or one team, as a .json file (download on web, share sheet on phone).
 * v7: photos always go with it; descriptions only with `includeDescriptions` (DECISIONS #150).
 * v10 (audit H6): `warning` says which teams have players sharing a jersey number (two devices
 * added it before a sync); the import refuses such a file. It never blocks the export.
 */
export function useExport() {
  const t = useT();
  const teams = useAppStore((s) => s.teams);
  const players = useAppStore((s) => s.players);
  const duplicates = teamsWithDuplicateNumbers(teams, players);
  const warning = duplicates.length === 0 ? null : t.transfer.export.duplicateNumbers(duplicates);
  // The outcome is kept as data (not text) so the message follows a language switch.
  const [outcome, setOutcome] = useState<{ fileName: string } | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);

  const exportData = useCallback(
    async (team?: Team, options: { includeDescriptions?: boolean } = {}) => {
      const now = new Date();
      const file = buildExport(await transferSnapshot(), {
        teamId: team?.id,
        now,
        includeDescriptions: options.includeDescriptions === true,
      });
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

  return { exportData, status, busy, warning };
}
