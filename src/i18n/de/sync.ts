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
  // E2: Status-Anzeige, Hinweise, geteiltes Team löschen, Import, Teamliste.
  badge: {
    offlinePending: (n: number) => `Offline (${n})`,
    label: (text: string) => `${text}: Konto öffnen`,
  },
  notices: {
    removed: (team: string) =>
      `Du bist nicht mehr Mitglied von ${team}. Das Team bleibt als lokale Kopie auf diesem Gerät.`,
    deleted: (team: string) =>
      `${team} wurde aus der Cloud gelöscht. Das Team bleibt als lokale Kopie auf diesem Gerät.`,
    demoted: (team: string, undone: number) =>
      undone === 0
        ? `Du kannst ${team} jetzt nur noch ansehen.`
        : undone === 1
          ? `Du kannst ${team} jetzt nur noch ansehen; 1 nicht synchronisierte Änderung wurde zurückgenommen.`
          : `Du kannst ${team} jetzt nur noch ansehen; ${undone} nicht synchronisierte Änderungen wurden zurückgenommen.`,
    skipped: (team: string, count: number) =>
      count === 1
        ? `${team}: 1 Eintrag aus der Cloud war ungültig und wurde übersprungen.`
        : `${team}: ${count} Einträge aus der Cloud waren ungültig und wurden übersprungen.`,
    dismiss: 'Schließen',
    dismissLabel: (team: string) => `Schließen: Hinweis zu ${team}`,
  },
  teamDelete: {
    title: (team: string) => `${team} löschen?`,
    removeTitle: (team: string) => `${team} entfernen?`,
    managerBody:
      'Dieses Team ist geteilt. Entferne es nur von diesem Gerät (in der Cloud bleibt es für alle) oder lösche es für alle.',
    playerBody:
      'Dieses Team wurde mit dir geteilt. Entferne es nur von diesem Gerät (du bleibst Mitglied) oder verlasse das Team.',
    removeHere: 'Von diesem Gerät entfernen',
    removeHereLabel: (team: string) => `Von diesem Gerät entfernen: ${team}`,
    deleteEverywhere: 'Für alle löschen',
    deleteEverywhereLabel: (team: string) => `Für alle löschen: ${team}`,
    leave: 'Team verlassen',
    leaveLabel: (team: string) => `Team verlassen: ${team}`,
    cancel: 'Abbrechen',
    cancelLabel: 'Abbrechen: Team behalten',
    errors: {
      offline: 'Dafür brauchst du eine Verbindung. Versuch es online noch einmal.',
      lastManager: 'Mach zuerst jemand anderen zum Trainer.',
      lastMember: 'Du bist das einzige Mitglied: Lösche das Team stattdessen für alle.',
      forbidden: 'Das können nur Trainer.',
      signIn: 'Melde dich zuerst an (Profil → Konto).',
      unknown: 'Das hat nicht geklappt. Versuch es noch einmal.',
    },
  },
  import: {
    shared: (names: string[]) =>
      `Geteilte Teams: ${names.join(', ')} (Änderungen werden mit allen Mitgliedern synchronisiert).`,
    skipped: (names: string[]) => `Übersprungene Teams (nur ansehen): ${names.join(', ')}.`,
    replaceKeeps: 'Ersetzen behält die auf diesem Gerät geteilten Teams.',
    sharedConflict:
      'Diese Datei passt nicht zu einem auf diesem Gerät geteilten Team (zum Beispiel zwei Spieler mit derselben Trikotnummer). Es wurde nichts geändert.',
  },
  team: {
    rowLabel: (open: string, mark: string) => `${open}. ${mark}`,
    markSeparator: ' · ',
    join: 'Team beitreten',
    joinLabel: 'Team beitreten: mit einem Einladungscode',
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
