import { AppState, type AppStateStatus } from 'react-native';

/**
 * v10: on phones the token is refreshed only while the app is in the foreground (supabase-js
 * can't see the app state itself): start on `active`, stop otherwise.
 */
export function keepTokenFresh(auth: {
  startAutoRefresh(): Promise<void>;
  stopAutoRefresh(): Promise<void>;
}): void {
  const apply = (state: AppStateStatus | string | null | undefined) => {
    void (state === 'active' ? auth.startAutoRefresh() : auth.stopAutoRefresh());
  };
  apply(AppState.currentState);
  AppState.addEventListener('change', apply);
}
