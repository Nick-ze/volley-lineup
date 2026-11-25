import type { Strings } from '../en';

/** v9.0: das Tutorial — Auswahl der Tour, Tipp-Popups und die Tipps jedes Bildschirms. */
export const tour: Strings['tour'] = {
  choice: {
    title: 'Willkommen bei Volley Lineup',
    titleAgain: 'Tutorial',
    intro: 'Kurze Tour gefällig? Unterwegs erscheinen Tipps auf den Bildschirmen.',
    full: 'Ganze Tour',
    fullHint: 'Jeder Bildschirm, kurz erklärt.',
    quick: 'Kurze Tour',
    quickHint: 'Profil → Team → erstes Spiel. Auf anderen Bildschirmen fragen wir.',
    none: 'Keine Tour',
    noneHint: 'Keine Tipps.',
    optionLabel: (name: string, hint: string) => `${name}: ${hint}`,
    current: (name: string) => `Jetzt: ${name}`,
    chosen: 'jetzt gewählt',
    cancel: 'Abbrechen',
    cancelLabel: 'Abbrechen: aktuelle Tour behalten',
  },
  popup: {
    back: 'Zurück',
    backLabel: 'Zurück: vorheriger Tipp',
    next: 'Weiter',
    nextLabel: 'Weiter: nächster Tipp',
    done: 'Verstanden',
    doneLabel: 'Verstanden: Tipps schließen',
    end: 'Tour beenden',
    endLabel: 'Tour beenden: keine Tipps mehr (im Profil neu wählbar)',
    stepOf: (n: number, total: number) => `Tipp ${n} von ${total}`,
    quickDone: 'Das war die kurze Tour. Mehr Tipps: Profil → Tutorial.',
  },
  offer: {
    title: (page: string) => `Kurzer Tipp zu ${page}?`,
    show: 'Anzeigen',
    showLabel: (page: string) => `Anzeigen: Tipps zu ${page}`,
    no: 'Nein danke',
    noLabel: (page: string) => `Nein danke: Tipps zu ${page} überspringen`,
  },
  profile: {
    title: 'Tutorial',
    hint: 'Wähle eine Tour neu, um ihre Tipps von vorn zu sehen, oder beende sie.',
    button: 'Neu wählen',
    buttonLabel: 'Neu wählen: ganze, kurze oder keine Tour',
    notChosen: 'Noch nicht gewählt',
  },
  sample: {
    profile: 'Coach',
    team: 'Mein Team',
    season: '2026/27',
    opponent: 'Lions',
    player: 'Anna',
    email: 'anna@example.com',
    inviteCode: 'ABCDE-FGHJK',
  },
  pages: {
    profiles: 'Profile',
    teams: 'Teams',
    roster: 'Kader',
    playerForm: 'Spieler hinzufügen',
    matches: 'Spiele',
    seasonForm: 'Neue Saison',
    seasonMatches: 'Saison',
    matchForm: 'Neues Spiel',
    builder: 'Aufstellung',
    profile: 'Profil',
    settings: 'Einstellungen',
    presets: 'Vorlagen',
    starters: 'Startsechs',
    teamStats: 'Team-Statistik',
    playerDetail: 'Spielerdetails',
    presetEditor: 'Vorlage bearbeiten',
    startersEditor: 'Startsechs bearbeiten',
    seasonOpponents: 'Gegner',
    seasonStats: 'Saison-Statistik',
    rotation: 'Rotationen',
    matchStarters: 'Startaufstellungen',
    live: 'Live-Zählung',
    performance: 'Leistung',
    matchStats: 'Spielstatistik',
    account: 'Konto',
    signIn: 'Anmelden',
    cloudTeams: 'Cloud-Teams',
    members: 'Mitglieder',
    join: 'Team beitreten',
  },
  steps: {
    profiles: {
      create: {
        title: 'Profil anlegen',
        text: 'In deinem Profil liegen deine Teams. Gib deinen Namen ein und tippe auf „Profil anlegen“ („Neues Profil“ legt ein weiteres an).',
      },
      open: {
        title: 'Deine Profile',
        text: 'Später tippst du hier auf dein Profil, um seine Teams zu öffnen. Andere Trainer können ein eigenes Profil haben.',
      },
    },
    teams: {
      create: {
        title: 'Team anlegen',
        text: 'Tippe auf „Neues Team“, gib ihm einen Namen und lege es an.',
      },
      open: {
        title: 'Team öffnen',
        text: 'Tippe auf das Team, um Spieler, Spiele und Aufstellungen zu verwalten.',
      },
    },
    roster: {
      add: {
        title: 'Spieler hinzufügen',
        text: 'Tippe für alle im Team auf „Spieler hinzufügen“. Eine Aufstellung braucht mindestens 6. Sobald Spieler da sind, druckt „Spielerliste (PDF)“ die Nummern für den Schreiber.',
      },
      sections: {
        title: 'Team-Bereiche',
        text: 'Die Leiste unten wechselt zwischen Kader, Spiele, Vorlagen, Startsechs und Statistik. Du kannst auch seitlich wischen.',
      },
    },
    playerForm: {
      name: {
        title: 'Name und Nummer',
        text: 'Gib Vorname, Nachname und Trikotnummer ein.',
      },
      positions: {
        title: 'Positionen',
        text: 'Wähle die Positionen, die der Spieler spielt. Die erste ist die Hauptposition. Für deinen Kapitän schalte „Kapitän“ ein. Dann speichern.',
      },
    },
    matches: {
      season: {
        title: 'Saison starten',
        text: 'Spiele gehören zu einer Saison oder einem Turnier. Tippe auf „Neue Saison / Turnier“.',
      },
      open: {
        title: 'Saison öffnen',
        text: '„Neue Saison / Turnier“ öffnet sie. Später tippst du auf die Saison, um zu ihren Spielen, Gegnern und der Statistik zurückzukehren.',
      },
    },
    seasonForm: {
      form: {
        title: 'Saison oder Turnier',
        text: 'Gib einen Namen ein und wähle Saison oder Turnier. Start- und Enddatum und Ort sind optional.',
      },
    },
    seasonMatches: {
      add: {
        title: 'Spiel anmelden',
        text: 'Tippe auf „Neues Spiel“, um ein Spiel gegen einen Gegner anzulegen.',
      },
      tabs: {
        title: 'Gegner und Statistik',
        text: 'Wische oder nutze die Tabs für die Gegner und die Statistik der Saison.',
      },
    },
    matchForm: {
      form: {
        title: 'Gegner und Datum',
        text: 'Wähle einen Gegner oder tippe einen neuen ein, setze Datum und Heim oder Auswärts und lege das Spiel an.',
      },
    },
    builder: {
      drag: {
        title: 'Spieler aufs Feld',
        text: 'Ziehe Spieler von der Bank aufs Feld, oder tippe einen Spieler und dann eine Position an.',
      },
      libero: {
        title: 'Libero und System',
        text: 'Setze deinen Libero auf den Libero-Platz. Wähle 5-1 oder 6-2 und rotiere, bis der Zuspieler richtig startet.',
      },
      serve: {
        title: 'Wer schlägt auf?',
        text: 'Wähle, wer zuerst aufschlägt. Jeder Satz hat seinen Tab; mit Live zählst du das Spiel, mit Drucken / PDF druckst du die Aufstellung oder die Spielerliste für den Schreiber.',
      },
    },
    profile: {
      look: {
        title: 'Dein Profil',
        text: 'Ändere Name und Farbe, wähle Dunkel oder Hell, oder schalte die Legasthenie-freundliche Schrift ein.',
      },
      tutorial: {
        title: 'Tutorial',
        text: 'Hier kannst du jederzeit eine Tour neu wählen oder sie beenden.',
      },
    },
    settings: {
      display: {
        title: 'Sprache und Chips',
        text: 'Wähle die Sprache, und ob die Spieler-Chips Nummern oder Namen zeigen.',
      },
      backup: {
        title: 'Daten sichern',
        text: 'Alles bleibt auf diesem Gerät. Export speichert es in eine Datei; Import lädt es wieder, auch auf einem anderen Gerät.',
      },
    },
    presets: {
      saved: {
        title: 'Gespeicherte Aufstellungen',
        text: 'Vorlagen sind Aufstellungen, die du oft brauchst. Im Spiel füllt „Vorlage übernehmen…“ einen Satz damit.',
      },
    },
    starters: {
      starters: {
        title: 'Startsechs des Teams',
        text: 'Lege deine übliche Sechs und den Libero einmal fest. Jedes neue Spiel beginnt Satz 1 damit. Teilweise ausgefüllt geht auch.',
      },
    },
    teamStats: {
      stats: {
        title: 'Team-Statistik',
        text: 'Gewonnene und verlorene Punkte pro Rotation und Spieler, über alle Spiele oder eine Saison.',
      },
    },
    playerDetail: {
      detail: {
        title: 'Spielerdetails',
        text: 'Foto, Spiele und vertrauliche Notizen (gesperrt, bis du sie entsperrst). Mit Bearbeiten änderst du Name, Nummer oder Positionen.',
      },
    },
    presetEditor: {
      edit: {
        title: 'Vorlage bearbeiten',
        text: 'Ziehe oder tippe Spieler aufs Feld, wie im Spiel. Änderungen werden sofort gespeichert.',
      },
    },
    startersEditor: {
      edit: {
        title: 'Deine Startsechs',
        text: 'Stelle die übliche Sechs und den Libero auf. Neue Spiele beginnen mit dieser Aufstellung.',
      },
    },
    seasonOpponents: {
      add: {
        title: 'Gegner',
        text: 'Füge die Teams hinzu, gegen die du spielst. Tippe auf einen, um eure Spiele zu sehen.',
      },
    },
    seasonStats: {
      stats: {
        title: 'Saison-Statistik',
        text: 'Ergebnisse, Rotationen und Spieler nur dieser Saison.',
      },
    },
    rotation: {
      rotations: {
        title: 'Alle 6 Rotationen',
        text: 'Sieh, wo alle in jeder Rotation stehen. Die Spieler rücken im Uhrzeigersinn weiter, wenn ihr den Aufschlag zurückholt.',
      },
    },
    matchStarters: {
      overview: {
        title: 'Alle Sätze auf einen Blick',
        text: 'Die Startaufstellungen aller Sätze. Tippe auf einen Satz für seine Rotationen.',
      },
    },
    live: {
      score: {
        title: 'Jeden Ballwechsel zählen',
        text: 'Tippe auf „Punkt für uns“ oder „Punkt Gegner“. Holt ihr den Aufschlag zurück, rotiert das Team von selbst.',
      },
      tags: {
        title: 'Rückgängig und Details',
        text: 'Rückgängig nimmt den letzten Punkt zurück. Einen Punkt zu markieren (Angriff, Ass, Fehler …) ist freiwillig.',
      },
      subs: {
        title: 'Wechsel und Sätze',
        text: 'Mit Wechsel tauschst du Spieler (6 pro Satz). Nach einem Satz startest du den nächsten; am Ende kommt eine Zusammenfassung.',
      },
    },
    performance: {
      overview: {
        title: 'Leistung',
        text: 'Ballwechsel, Punkte, Fehler und Bewertung jedes Spielers, pro Satz oder fürs Spiel. Tippe auf einen Spieler für mehr.',
      },
    },
    matchStats: {
      stats: {
        title: 'Spielstatistik',
        text: 'Punkte pro Rotation und pro Spieler. Nach Satz filtern. Drucken kannst du die Aufstellungen im Spiel-Bildschirm.',
      },
    },
    account: {
      sync: {
        title: 'Dein Konto',
        text: 'Angemeldet werden deine geteilten Teams zwischen deinen Geräten synchronisiert. Offline funktioniert alles weiter; „Jetzt synchronisieren“ synchronisiert sofort.',
      },
    },
    signIn: {
      code: {
        title: 'Mit Code anmelden',
        text: 'Gib deine E-Mail ein und tippe auf „Code senden“. Gib den 6-stelligen Code aus der E-Mail ein. Kein Passwort nötig.',
      },
    },
    cloudTeams: {
      choose: {
        title: 'Teams auswählen',
        text: 'Hake die Teams an, die du von diesem Gerät hochladen willst, und die Cloud-Teams zum Herunterladen. Hochgeladen wird nur, was du anhakst.',
      },
    },
    members: {
      invite: {
        title: 'Lade dein Team ein',
        text: 'Trainer erstellen einen Einladungscode für Trainer oder Spieler und teilen ihn. Spieler können das Team nur ansehen.',
      },
    },
    join: {
      code: {
        title: 'Mit Code beitreten',
        text: 'Gib den Einladungscode ein, den du von einem Trainer bekommen hast, und tippe auf „Beitreten“. Das Team erscheint dann in deiner Teamliste.',
      },
    },
  },
};
