import type { LineupSheetLabels } from '@/domain/lineupSheet';
import { t } from '@/i18n/en';

/** The translated labels the (i18n-free) domain sheet builder needs. */
export function sheetLabels(teamName: string, opponent: string): LineupSheetLabels {
  const s = t.print.sheet;
  return { ...s, documentTitle: s.documentTitle(teamName, opponent) };
}
