/** v10: every backend request gives up after this long (then the app counts as offline). */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * `fetch` that aborts after `ms` (the caller's own signal still works). An aborted request
 * rejects with an `AbortError`, which `toSyncError` maps to offline.
 */
export function fetchWithTimeout(ms = REQUEST_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener('abort', () => controller.abort());
    }
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}
