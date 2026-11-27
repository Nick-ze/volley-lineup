/**
 * v11: the room the app's own header leaves above its row for the status bar. A modal covers the
 * whole screen here (Android, web), so it needs the inset like every other screen.
 */
export function headerTopInset(insetTop: number, _modal: boolean): number {
  return insetTop;
}
