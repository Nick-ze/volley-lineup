/** Match results (v3): result labels for the match list and the match header. */
export const match = {
  title: 'Match',
  resultWon: (us: number, them: number) => `${us}:${them} won`,
  resultLost: (us: number, them: number) => `${us}:${them} lost`,
  resultInProgress: 'in progress',
  resultInProgressSets: (us: number, them: number) => `${us}:${them} · in progress`,
  resultLabel: (text: string) => `Result: ${text}`,
} as const;
