/**
 * v10 audit H7: keeps the stored session through a server outage.
 *
 * supabase-js (auth-js) deletes the stored session when a token refresh is answered with an
 * error it doesn't know as temporary — and it only knows HTTP 500–504 and 520–530. A paused
 * Supabase project answers 540, a rate-limited refresh 429: every device whose access token had
 * expired would be signed out and need a new sign-in email once the project is back.
 *
 * So for requests to the auth API, any status ≥ 500, and a 429 on a token refresh, are turned
 * into a network error: the one thing auth-js always treats as temporary (the session stays and
 * the refresh is tried again later). The app shows "offline" for it, as for any outage.
 */
const requestUrl = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === 'string' ? input : 'url' in input ? input.url : String(input);

export function keepSessionOnOutage(inner: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await inner(input, init);
    const url = requestUrl(input);
    if (!url.includes('/auth/v1/')) return response;
    const refresh = url.includes('grant_type=refresh_token');
    if (response.status >= 500 || (refresh && response.status === 429)) {
      throw new TypeError(`Network request failed (HTTP ${response.status})`);
    }
    return response;
  };
}
