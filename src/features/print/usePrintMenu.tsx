import { useCallback, useState, type ReactNode } from 'react';

import { PrintChoiceDialog, type PrintChoice } from './PrintChoiceDialog';
import { usePrintSheet } from './usePrintSheet';
import { useScorerSheet } from './useScorerSheet';

export interface PrintMenu {
  /** Nothing can be printed right now (not ready yet, or a print is running). */
  disabled: boolean;
  /** Ask what to print. */
  open: () => void;
  /** The last print failed. */
  failed: boolean;
  /** The "what to print" dialog while it is open (render it in the screen). */
  dialog: ReactNode;
}

/**
 * "Print / PDF" for a match: web opens the print dialog, phones get a PDF in the share sheet.
 * Opening it first asks what to print: the lineup sheet ("With results" / "Lineups only" once the
 * match has results) or (v9.2) the player list for the scorer. v11: a hook, so the button can sit
 * in the header while the dialog and the error line are drawn by the screen.
 */
export function usePrintMenu(matchId: string): PrintMenu {
  const sheet = usePrintSheet(matchId);
  const scorer = useScorerSheet({ matchId });
  const [choosing, setChoosing] = useState(false);
  const open = useCallback(() => setChoosing(true), []);
  const choose = (choice: PrintChoice) => {
    setChoosing(false);
    if (choice === 'scorer') void scorer.print();
    else void sheet.print({ withResults: choice === 'results' });
  };
  return {
    disabled: !sheet.ready || sheet.printing || scorer.printing,
    open,
    failed: sheet.failed || scorer.failed,
    dialog: choosing ? (
      <PrintChoiceDialog
        hasResults={sheet.hasResults}
        onChoose={choose}
        onCancel={() => setChoosing(false)}
      />
    ) : null,
  };
}
