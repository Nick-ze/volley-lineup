import { useCallback, useState } from 'react';

import { buildLineupSheetHtml } from '@/domain/lineupSheet';
import { t } from '@/i18n/en';
import { printHtml } from '@/lib/print';
import { useMatch, usePlayersForTeam, useTeam } from '@/store';

import { sheetLabels } from './sheetLabels';

/** Builds the lineup sheet of a match and hands it to the platform's print / PDF helper. */
export function usePrintSheet(matchId: string) {
  const match = useMatch(matchId);
  const team = useTeam(match?.teamId);
  const players = usePlayersForTeam(match?.teamId);
  const [printing, setPrinting] = useState(false);
  const [failed, setFailed] = useState(false);

  const print = useCallback(async () => {
    if (!match || !team) return;
    setPrinting(true);
    setFailed(false);
    const labels = sheetLabels(team.name, match.opponent);
    try {
      const html = buildLineupSheetHtml({ match, team, players, labels });
      await printHtml(html, { title: labels.documentTitle, dialogTitle: t.print.dialogTitle });
    } catch {
      setFailed(true);
    } finally {
      setPrinting(false);
    }
  }, [match, team, players]);

  return { print, printing, failed, ready: Boolean(match && team) };
}
