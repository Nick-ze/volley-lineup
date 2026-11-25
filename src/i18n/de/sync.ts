import type { Strings } from '../en';

/** v10: Sync-Status und Gründe für „Nur ansehen“. */
export const sync: Strings['sync'] = {
  status: {
    off: 'Nicht angemeldet',
    synced: 'Synchronisiert',
    syncing: 'Synchronisiere …',
    offline: 'Offline',
    error: 'Sync-Fehler',
    pending: (n: number) => (n === 1 ? '1 Änderung wartet' : `${n} Änderungen warten`),
    syncNow: 'Jetzt synchronisieren',
  },
  readOnly: {
    viewer: 'Nur ansehen: Nur Trainer können dieses Team ändern.',
    held: (name: string) =>
      `Wird gerade live auf dem Gerät von ${name || 'jemand anderem'} gezählt.`,
    takeOver: 'Übernehmen',
  },
  shared: 'Geteilt',
  viewOnly: 'Nur ansehen',
  /** v10 (E1): Spielseite (Aufstellung, Live, Aufstellungen) für Zuschauer und gehaltene Spiele. */
  match: {
    notStarted: (set: number) => `Satz ${set} hat noch nicht begonnen.`,
    takeOverFailed: {
      offline: 'Zum Übernehmen brauchst du eine Verbindung.',
      forbidden: 'Nur Trainer können übernehmen.',
      other: 'Übernehmen hat nicht geklappt. Versuch es noch mal.',
    },
  },
};
