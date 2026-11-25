/**
 * v10: in browsers supabase-js refreshes the session token by itself (it watches the page's
 * visibility), so there is nothing to wire on web. See `autoRefresh.native.ts`.
 */
export function keepTokenFresh(_auth: {
  startAutoRefresh(): Promise<void>;
  stopAutoRefresh(): Promise<void>;
}): void {}
