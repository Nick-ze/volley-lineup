import { useCallback, useState } from 'react';

import { buildLineupSheetHtml } from '@/domain/lineupSheet';
import { useT } from '@/i18n';
import { printHtml } from '@/lib/print';
import { useAppStore, useMatch, usePlayersForTeam, useTeam } from '@/store';

import { sheetLabels } from './sheetLabels';

/** Builds the lineup sheet of a match and hands it to the platform's print / PDF helper. */
export function usePrintSheet(matchId: string) {
  const t = useT();
  const language = useAppStore((s) => s.language);
  const match = useMatch(matchId);
  const team = useTeam(match?.teamId);
  const players = usePlayersForTeam(match?.teamId);
  const [printing, setPrinting] = useState(false);
  const [failed, setFailed] = useState(false);

  const print = useCallback(async () => {
    if (!match || !team) return;
    setPrinting(true);
    setFailed(false);
    const labels = sheetLabels(t, team.name, match.opponent);
    try {
      const html = buildLineupSheetHtml({ match, team, players, labels, lang: language });
      await printHtml(html, { title: labels.documentTitle, dialogTitle: t.print.dialogTitle });
    } catch {
      setFailed(true);
    } finally {
      setPrinting(false);
    }
  }, [match, team, players, t, language]);

  return { print, printing, failed, ready: Boolean(match && team) };
}
