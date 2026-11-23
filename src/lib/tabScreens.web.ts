/**
 * v8.1: on the web every route is its own code chunk, loaded on its first visit; until then the
 * screen shows nothing (a few hundred ms). A drag onto a tab not visited yet would end on that
 * blank screen, so the app tab bar mounts all three tabs up front there.
 */
export const LAZY_TAB_SCREENS = false;
