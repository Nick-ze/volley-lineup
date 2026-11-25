import { useCallback, useState } from 'react';

import { buildScorerSheetHtml } from '@/domain/scorerSheet';
import { useT } from '@/i18n';
import { printHtml } from '@/lib/print';
import { useAppStore, useMatch, usePlayersForTeam, useSeason, useTeam } from '@/store';

/**
 * v9.2: builds the player list for the scorer and hands it to the platform's print / PDF helper.
 * From the Roster tab pass the team; from a match pass the match (the team is the match's, and
 * the sheet gets the match line).
 */
export function useScorerSheet({ teamId, matchId }: { teamId?: string; matchId?: string }) {
  const t = useT();
  const language = useAppStore((s) => s.language);
  const match = useMatch(matchId);
  const team = useTeam(teamId ?? match?.teamId);
  const season = useSeason(match?.seasonId);
  const players = usePlayersForTeam(team?.id);
  const [printing, setPrinting] = useState(false);
  const [failed, setFailed] = useState(false);

  const print = useCallback(async () => {
    if (!team) return;
    setPrinting(true);
    setFailed(false);
    const s = t.print.scorer;
    const labels = { ...s.sheet, documentTitle: s.sheet.documentTitle(team.name) };
    try {
      const html = buildScorerSheetHtml({ team, players, match, season, labels, lang: language });
      await printHtml(html, { title: labels.documentTitle, dialogTitle: s.dialogTitle });
    } catch {
      setFailed(true);
    } finally {
      setPrinting(false);
    }
  }, [team, players, match, season, t, language]);

  return { print, printing, failed, ready: Boolean(team) };
}
