import type { Strings } from '../en';

/** v10: Sync-Status und Gründe für „Nur ansehen“. */
export const sync: Strings['sync'] = {
  errors: {
    offline: 'Keine Verbindung. Versuch es nochmal, wenn du online bist.',
    forbidden: 'Das darfst du nicht.',
    lastManager: 'Mach zuerst jemand anderen zum Trainer.',
    lastMember: 'Du bist das einzige Mitglied: Lösche das Team stattdessen für alle.',
    inviteInvalid: 'Dieser Einladungscode ist falsch, abgelaufen oder schon verwendet.',
    notSignedIn: 'Melde dich zuerst an (Profil → Cloud-Sync).',
    signedOut: 'Du wurdest abgemeldet. Melde dich nochmal an.',
    invalidCode:
      'Falscher oder abgelaufener Code. Prüfe die E-Mail oder lass dir einen neuen Code schicken.',
    rateLimited: 'Zu viele Versuche. Warte kurz und versuch es nochmal.',
    tooMany:
      'Grenze erreicht: höchstens 10 Teams pro Konto und 20 offene Einladungen und 20 MB Daten pro Team.',
    mailFailed: 'Die E-Mail mit dem Code konnte nicht gesendet werden. Versuch es später nochmal.',
    emailRejected:
      'Mit dieser E-Mail-Adresse kannst du dich nicht anmelden. Prüfe sie oder nimm eine andere.',
    unknown: 'Etwas ist schiefgelaufen. Versuch es nochmal.',
  },
  status: {
    off: 'Nicht angemeldet',
    noTeams: 'Keine geteilten Teams',
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
    heldNoDelete: (name: string) =>
      name
        ? `Löschen ist nicht möglich, solange auf dem Gerät von ${name} ein Spiel live gezählt wird.`
        : 'Löschen ist nicht möglich, solange auf einem anderen Gerät ein Spiel live gezählt wird.',
  },
  // E2: Status-Anzeige, Hinweise, geteiltes Team löschen, Import, Teamliste.
  badge: {
    offlinePending: (n: number) => `Offline (${n})`,
    label: (text: string) => `${text}: Cloud-Sync öffnen`,
  },
  notices: {
    removed: (team: string) =>
      `Du bist nicht mehr Mitglied von ${team}: Du wurdest entfernt oder das Team wurde gelöscht. Das Team bleibt als lokale Kopie auf diesem Gerät.`,
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
    takenOver: (team: string, holder: string, undone: number) =>
      `${holder || 'Jemand anderes'} hat bei einem Spiel von ${team} das Zählen übernommen. ` +
      (undone === 1
        ? '1 Änderung von diesem Gerät, die noch nicht synchronisiert war, wurde zurückgenommen.'
        : `${undone} Änderungen von diesem Gerät, die noch nicht synchronisiert waren, wurden zurückgenommen.`),
    waiting:
      'Eines deiner geteilten Teams kann noch nicht angezeigt werden: In der Cloud fehlen Daten davon, oder es wurde mit einer neueren Version dieser App gespeichert. Es erscheint von selbst, sobald das Gerät eines Trainers synchronisiert hat. Sonst aktualisiere die App.',
    unsent: (
      team: string,
      label: string,
      count: number,
      reason: 'tooLong' | 'invalid' | 'refused',
    ) => {
      const first = label === '' ? 'Ein Eintrag' : `„${label}“`;
      const what =
        count <= 1
          ? `${first} kann`
          : count === 2
            ? `${first} und 1 weiterer Eintrag können`
            : `${first} und ${count - 1} weitere Einträge können`;
      const why =
        reason === 'tooLong'
          ? 'Ein Name ist länger als 200 Zeichen oder ein anderer Text länger als 1000. Kürze ihn, dann wird von selbst synchronisiert.'
          : reason === 'invalid'
            ? 'Diese App könnte es aus der Cloud nicht wieder lesen (die Daten sind nicht wie erwartet). Es bleibt auf diesem Gerät.'
            : 'Die Cloud hat es abgelehnt (zu groß, oder mit einer Kennung oder einem Zeichen, das die Cloud nicht speichern kann). Es bleibt auf diesem Gerät.';
      return `${team}: ${what} nicht synchronisiert werden: ${why} Alles andere wird wie gewohnt synchronisiert.`;
    },
    aTeam: 'einem geteilten Team',
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
  },
  localCopy: {
    title: 'Ältere Kopie auf diesem Gerät',
    body: (viewOnly: string[], managed: string[]) => {
      const all = [...viewOnly, ...managed];
      const found =
        all.length === 1
          ? `Auf diesem Gerät gibt es eine ältere Kopie von ${all[0]}.`
          : `Auf diesem Gerät gibt es ältere Kopien von ${all.join(', ')}.`;
      const replaced =
        'Die Cloud-Version des Teams tritt an ihre Stelle – Änderungen an der Kopie auf diesem Gerät gehen verloren.';
      const merged =
        'Überall, wo beide etwas haben, gilt die Cloud-Version des Teams – Änderungen an der Kopie auf diesem Gerät gehen verloren. Was nur die Kopie hat, kommt zum Team dazu.';
      const effect =
        managed.length === 0
          ? replaced
          : viewOnly.length === 0
            ? merged
            : `Änderungen an den Kopien auf diesem Gerät gehen verloren: Bei ${viewOnly.join(', ')} tritt die Cloud-Version an die Stelle der Kopie; bei ${managed.join(', ')} gilt sie überall, wo beide etwas haben (was nur die Kopie hat, kommt zum Team dazu).`;
      return `${found} ${effect} Zuerst eine Sicherung exportieren?`;
    },
    exportHint:
      'Die Sicherung ist dieselbe Datei wie unter Einstellungen → Export: alles auf diesem Gerät, mit Fotos. Spielerbeschreibungen sind nur enthalten, wenn dort „Beschreibungen mitexportieren“ eingeschaltet ist.',
    export: 'Sicherung exportieren',
    exportLabel: 'Sicherung exportieren: dieselbe Datei wie unter Einstellungen → Export',
    replace: 'Cloud-Version verwenden',
    replaceLabel:
      'Cloud-Version verwenden: Änderungen an der Kopie auf diesem Gerät gehen verloren',
    cancel: 'Jetzt nicht',
    cancelLabel: 'Jetzt nicht: die Kopie auf diesem Gerät behalten',
    later: (team: string) =>
      `Du bist jetzt Mitglied von ${team}. Die Kopie auf diesem Gerät ist unverändert. Für die Cloud-Version des Teams: Cloud-Sync → Cloud-Teams öffnen und das Team herunterladen.`,
    inCloud:
      'Dieses Team ist bereits in der Cloud geteilt, und du bist Mitglied. Das hier ist eine ältere Kopie: Cloud-Sync → Cloud-Teams öffnen und das Team herunterladen, um es zu verbinden.',
    openCloudTeams: 'Cloud-Teams',
    openCloudTeamsLabel: 'Cloud-Teams: die Cloud-Version des Teams herunterladen',
  },
  import: {
    shared: (names: string[]) =>
      `Geteilte Teams: ${names.join(', ')} (Änderungen werden mit allen Mitgliedern synchronisiert).`,
    skipped: (names: string[]) => `Übersprungene Teams (nur ansehen): ${names.join(', ')}.`,
    replaceKeeps: 'Ersetzen behält die auf diesem Gerät geteilten Teams.',
    sharedConflict:
      'Diese Datei passt nicht zu einem auf diesem Gerät geteilten Team (zum Beispiel zwei Spieler mit derselben Trikotnummer). Es wurde nichts geändert.',
    liveMatch:
      'Ein Spiel, das diese Datei ändern würde, wird gerade auf einem anderen Gerät live gezählt. Es wurde nichts geändert. Importiere erneut, wenn dieses Spiel vorbei ist.',
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
