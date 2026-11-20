/**
 * How a drag starts on phones (iOS / Android): a short long-press, so a normal swipe still
 * scrolls the page / bench instead of picking up a player.
 */
export const dragActivation: { minDistance?: number; activateAfterLongPress?: number } = {
  activateAfterLongPress: 200,
};
