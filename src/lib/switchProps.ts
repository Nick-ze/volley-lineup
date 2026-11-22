/**
 * Platform props for a purely decorative `Switch` inside a pressable row.
 * Native needs nothing extra (`thumbColor` applies in both states, and the wrapper ignores touches);
 * see `switchProps.web.ts` for the web variant.
 */
export const decorativeSwitchProps = (_thumbColor: string) => ({}) as const;
