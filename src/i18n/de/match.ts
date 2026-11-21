import type { Strings } from '../en';

/** Spielergebnisse (v3): Ergebnis in der Spielliste und im Spielkopf. */
export const match: Strings['match'] = {
  title: 'Spiel',
  resultWon: (us: number, them: number) => `${us}:${them} gewonnen`,
  resultLost: (us: number, them: number) => `${us}:${them} verloren`,
  resultInProgress: 'läuft',
  resultInProgressSets: (us: number, them: number) => `${us}:${them} · läuft`,
  resultLabel: (text: string) => `Ergebnis: ${text}`,
};
