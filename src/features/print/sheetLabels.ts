import type { LineupSheetLabels } from '@/domain/lineupSheet';
import type { Strings } from '@/i18n';

/** The labels the (i18n-free) domain sheet builder needs, in the current language. */
export function sheetLabels(t: Strings, teamName: string, opponent: string): LineupSheetLabels {
  const s = t.print.sheet;
  return { ...s, documentTitle: s.documentTitle(teamName, opponent) };
}
