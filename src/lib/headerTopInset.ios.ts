/**
 * v11: the room the app's own header leaves above its row for the status bar. On iOS a modal is
 * a sheet that starts below the status bar, so its header needs no inset.
 */
export function headerTopInset(insetTop: number, modal: boolean): number {
  return modal ? 0 : insetTop;
}
