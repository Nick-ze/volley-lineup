import { useCallback, useState } from 'react';

import {
  buildTournamentSheetHtml,
  standings,
  tableCounts,
  type TournamentSheetLabels,
} from '@/domain/hostedTournament';
import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { printHtml } from '@/lib/print';
import { useAppStore, useHostedResults, useHostedTeams } from '@/store';

import { formatText } from './tournamentText';
import { useTournamentPlan } from './useTournamentPlan';

/**
 * v12.3: builds the printable table of a hosted tournament (ranks and points, then every result)
 * and hands it to the platform's print / PDF helper: the print dialog on the web, a PDF in the
 * share sheet on a phone.
 */
export function useTournamentSheet(tournament: HostedTournament) {
  const t = useT();
  const language = useAppStore((s) => s.language);
  const teams = useHostedTeams(tournament.id);
  const results = useHostedResults(tournament.id);
  const plan = useTournamentPlan(tournament);
  const [printing, setPrinting] = useState(false);
  const [failed, setFailed] = useState(false);

  const print = useCallback(async () => {
    setPrinting(true);
    setFailed(false);
    const s = t.tournament;
    const labels: TournamentSheetLabels = {
      ...s.sheet,
      documentTitle: s.sheet.documentTitle(tournament.name),
      format: formatText(t, tournament),
      recordText: s.table.record,
      recordWithDrawsText: s.table.recordWithDraws,
      signed: s.signed,
      explain: s.table.explain[tableCounts(tournament)],
      round: s.matches.round,
      resting: s.matches.resting,
    };
    try {
      const html = buildTournamentSheetHtml({
        tournament,
        standings: standings(tournament, teams, results),
        plan,
        labels,
        lang: language,
      });
      await printHtml(html, { title: labels.documentTitle, dialogTitle: s.sheet.dialogTitle });
    } catch {
      setFailed(true);
    } finally {
      setPrinting(false);
    }
  }, [tournament, teams, results, plan, t, language]);

  return { print, printing, failed };
}
