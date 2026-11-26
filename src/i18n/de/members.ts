import type { Strings } from '../en';

/** v10: Teammitglieder, Rollen, Einladungscodes, einem Team beitreten. */
export const members: Strings['members'] = {
  title: 'Mitglieder',
  newInvite: 'Neue Einladung',
  newInviteLabel: 'Neue Einladung: einen Einladungscode erstellen',
  roles: {
    manager: 'Trainer',
    player: 'Spieler',
  },
  roleInText: {
    manager: 'Trainer',
    player: 'Spieler',
  },
  header: {
    members: 'Mitglieder',
    membersLabel: (team) => `Mitglieder: wer in ${team} ist`,
    share: 'Teilen',
    shareLabel: (team) => `Teilen: andere zu ${team} einladen`,
  },
  local: {
    intro:
      'Dieses Team ist nur auf diesem Gerät. Teile es, um es auf deinen anderen Geräten zu nutzen und Trainer und Spieler einzuladen. Spieler können es nur ansehen.',
    signInNeeded: 'Zum Teilen eines Teams brauchst du ein Konto.',
    signIn: 'Zuerst anmelden',
    signInLabel: 'Zuerst anmelden: du brauchst ein Konto',
    share: 'Dieses Team teilen',
    shareLabel: (team) => `Dieses Team teilen: ${team} in die Cloud hochladen`,
    sharing: 'Wird geteilt …',
  },
  list: {
    heading: 'Mitglieder',
    loading: 'Mitglieder werden geladen …',
    you: '(du)',
    noName: 'Ohne Namen',
    retry: 'Nochmals versuchen',
    retryLabel: 'Nochmals versuchen: Mitglieder laden',
    makeManager: 'Zum Trainer machen',
    makeManagerLabel: (name) => `Zum Trainer machen: ${name}`,
    makePlayer: 'Zum Spieler machen',
    makePlayerLabel: (name) => `Zum Spieler machen: ${name}`,
    remove: 'Entfernen',
    removeLabel: (name) => `Entfernen: ${name} aus dem Team`,
    removeConfirm: (name) =>
      `${name} aus dem Team entfernen? Die Kopie auf dem Gerät bleibt, aber es kommen keine Änderungen mehr. Offene Einladungscodes funktionieren nicht mehr: Erstelle neue für alle, die noch nicht beigetreten sind.`,
  },
  invites: {
    heading: 'Einladungen',
    none: 'Keine aktiven Einladungen. Erstelle eine und teile sie mit deinem Team.',
    details: (role, date, uses) => `${role} · gültig bis ${date} · ${uses}× benutzt`,
    share: 'Teilen',
    shareLabel: (code) => `Teilen: Einladungscode ${code}`,
    copy: 'Kopieren',
    copyLabel: (code) => `Kopieren: Einladungscode ${code}`,
    copied: 'Kopiert.',
    shareFailed: 'Teilen hat nicht geklappt. Lies den Code stattdessen vor.',
    revoke: 'Widerrufen',
    revokeLabel: (code) => `Widerrufen: Einladungscode ${code}`,
    revokeConfirm: (code) =>
      `Einladung ${code} widerrufen? Sie funktioniert dann sofort nicht mehr.`,
    shareTitle: (team) => `${team} beitreten`,
    shareMessage: (team, code, link) =>
      `Tritt „${team}“ in Volley Lineup bei: öffne ${link} oder gib unter „Team beitreten“ den Code ${code} ein.`,
  },
  newInviteDialog: {
    title: 'Neue Einladung',
    role: 'Rolle',
    roleHint: {
      manager: 'Trainer können alles ändern, einladen und Leute entfernen.',
      player: 'Spieler können das Team nur ansehen.',
    },
    days: 'Gültig für',
    dayOption: (days) => (days === 1 ? '1 Tag' : `${days} Tage`),
    create: 'Erstellen',
    createLabel: 'Erstellen: den Einladungscode erzeugen',
  },
  leave: {
    button: 'Team verlassen',
    label: (team) => `Team verlassen: ${team}`,
    confirm: (team) =>
      `${team} verlassen? Das Team wird von diesem Gerät entfernt und du bekommst keine Änderungen mehr.`,
    confirmButton: 'Verlassen',
  },
  join: {
    title: 'Team beitreten',
    intro:
      'Gib den Einladungscode ein, den du von einem Trainer bekommen hast, oder füge den Einladungslink ein.',
    code: 'Einladungscode',
    placeholder: 'ABCDE-FGHJK',
    badFormat: 'Ein Einladungscode hat 10 Buchstaben und Ziffern, z. B. ABCDE-FGHJK.',
    submit: 'Beitreten',
    submitLabel: 'Beitreten: dem Team mit diesem Code beitreten',
    joining: 'Beitreten …',
    signInNeeded: 'Um einem Team beizutreten, brauchst du ein Konto.',
    joined: (team, role) => `Du bist ${team} als ${role} beigetreten.`,
    joinedUnnamed: (role) => `Du bist dem Team als ${role} beigetreten.`,
    open: 'Team öffnen',
    openLabel: (team) => `Team öffnen: ${team}`,
  },
};
