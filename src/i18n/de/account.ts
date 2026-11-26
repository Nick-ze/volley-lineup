import type { Strings } from '../en';

const changes = (n: number) => (n === 1 ? '1 Änderung' : `${n} Änderungen`);
const teams = (n: number) => (n === 1 ? '1 Team' : `${n} Teams`);

const signOutNote = 'Du wirst abgemeldet; geteilte Teams bleiben in der Cloud.';

/** v10: Konto, Anmeldung mit E-Mail-Code, Cloud-Teams (hochladen / herunterladen), Konto löschen. */
export const account: Strings['account'] = {
  title: 'Cloud-Sync',
  signIn: {
    title: 'Anmelden',
    email: 'E-Mail',
    sendCode: 'Code senden',
    code: '6-stelliger Code',
    verify: 'Anmelden',
    intro:
      'Melde dich an, um deine Teams zwischen deinen Geräten zu synchronisieren und zu teilen. Wir schicken dir einen 6-stelligen Code per E-Mail; kein Passwort nötig.',
    emailInvalid: 'Gib eine gültige E-Mail-Adresse ein.',
    codeSent: (email) => `Wir haben einen Code an ${email} geschickt. Es kann eine Minute dauern.`,
    haveCode: 'Ich habe schon einen Code',
    codeFromBefore: (email) =>
      `Gib den neuesten Code ein, den wir an ${email} geschickt haben. Ein Code gilt 10 Minuten.`,
    resend: 'Neuen Code senden',
    resendIn: (seconds) => `Neuer Code in ${seconds} s`,
    changeEmail: 'E-Mail ändern',
    noProfile: 'Öffne zuerst ein Profil: Geteilte Teams gehören zu einem Profil.',
    openProfiles: 'Profile öffnen',
    switchConfirm: (email, pending) =>
      `Die Teams von ${email} bleiben als lokale Kopien auf diesem Gerät.` +
      (pending > 0
        ? pending === 1
          ? ' 1 Änderung, die noch nicht synchronisiert ist, kommt nicht in die Cloud.'
          : ` ${changes(pending)}, die noch nicht synchronisiert sind, kommen nicht in die Cloud.`
        : '') +
      ' Weiter?',
    switchContinue: 'Weiter',
  },
  profileSection: {
    title: 'Cloud-Sync',
    signedOut:
      'Melde dich an, um deine Teams zwischen deinen Geräten zu synchronisieren und mit deinem Team zu teilen.',
    signIn: 'Anmelden',
    signInLabel: 'Anmelden, um deine Teams zu synchronisieren',
    signedIn: (email) => `Angemeldet als ${email}`,
    restoring: 'Anmeldung wird geprüft …',
    open: 'Cloud-Sync öffnen',
    openLabel: 'Cloud-Sync öffnen: Sync-Status und geteilte Teams',
    otherProfile: (email, profile) =>
      `${email} ist auf diesem Gerät mit dem Profil „${profile}“ angemeldet. Öffne dieses Profil, um das Konto zu nutzen.`,
  },
  screen: {
    status: 'Sync-Status',
    lastSynced: (when) => `Zuletzt synchronisiert ${when}`,
    notSynced: 'Noch nicht synchronisiert',
    sharedTeams: 'Geteilte Teams',
    noSharedTeams: 'Noch keine geteilten Teams auf diesem Gerät.',
    roles: { manager: 'Trainer', player: 'Spieler · nur ansehen' },
    openTeamLabel: (name, role) => `${name}: ${role}`,
    cloudTeams: 'Cloud-Teams',
    cloudTeamsHint: 'Lade Teams von diesem Gerät hoch oder deine Teams aus der Cloud herunter.',
    join: 'Team beitreten',
    signOut: 'Vom Konto abmelden',
    signOutHint:
      'Deine Daten bleiben auf diesem Gerät. Geteilte Teams werden wieder synchronisiert, wenn du dich anmeldest.',
    signOutConfirm: (pending) =>
      `${changes(pending)} ${pending === 1 ? 'wird' : 'werden'} bei der nächsten Anmeldung synchronisiert. Jetzt abmelden?`,
    signedOut: 'Du bist nicht angemeldet.',
  },
  deleteAccount: {
    title: 'Konto löschen',
    hint: 'Löscht dein Konto und deine Daten in der Cloud. Deine Daten auf diesem Gerät bleiben.',
    button: 'Konto löschen',
    confirm: (soleTeams) =>
      'Dein Konto und deine Mitgliedschaften werden aus der Cloud gelöscht.' +
      (soleTeams.length > 0
        ? ` Teams, in denen du das einzige Mitglied bist, werden endgültig gelöscht: ${soleTeams.join(', ')}.`
        : '') +
      ' Deine Daten auf diesem Gerät bleiben.',
    blocked:
      'Du bist der letzte Trainer dieser Teams. Mach zuerst jemand anderen zum Trainer oder lösche das Team:',
    members: 'Mitglieder',
    membersLabel: (team) => `Mitglieder: ${team}`,
    notOnDevice: 'Ein Team, das nicht auf diesem Gerät ist',
    done: 'Konto gelöscht. Deine Daten bleiben auf diesem Gerät.',
  },
  cloudTeams: {
    title: 'Cloud-Teams',
    intro: 'Wähle, was du teilen willst. Hochgeladen wird nur, was du ankreuzt.',
    loading: 'Cloud-Teams werden geladen…',
    retry: 'Nochmal versuchen',
    done: 'Fertig',
    checkMark: '✓',
    upload: {
      title: 'Von diesem Gerät hochladen',
      hint: 'Diese Teams sind noch nicht geteilt. Hochgeladene Teams werden zwischen deinen Geräten synchronisiert.',
      empty: 'Alle Teams dieses Profils sind geteilt.',
      button: 'Auswahl hochladen',
      results: {
        created: 'hochgeladen',
        rekeyed: 'hochgeladen',
        linked: 'mit der Cloud-Kopie verbunden',
        failed: 'konnte nicht hochgeladen werden',
      },
      result: (team, result) => `${team}: ${result}`,
      failedBecause: (team, reason) => `${team}: konnte nicht hochgeladen werden. ${reason}`,
    },
    download: {
      title: 'Aus der Cloud herunterladen',
      hint: 'Deine Teams in der Cloud, die noch nicht auf diesem Gerät sind.',
      empty: 'Keine weiteren Teams in der Cloud.',
      button: 'Herunterladen',
      done: (n) => `${teams(n)} heruntergeladen.`,
      unnamed: 'Team noch ohne Namen',
    },
  },
  signOutNote,
};
