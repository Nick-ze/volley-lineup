import type { Strings } from '../en';

/** Team-Navigation, Aufstellungs-Vorlagen und Stammsechs (v3). */
export const presets: Strings['presets'] = {
  nav: {
    label: 'Team-Bereiche',
    roster: 'Kader',
    matches: 'Spiele',
    presets: 'Vorlagen',
    starters: 'Startsechs',
    stats: 'Statistik',
    rosterLabel: 'Kader: Spieler des Teams',
    matchesLabel: 'Spiele des Teams',
    presetsLabel: 'Vorlagen: gespeicherte Aufstellungen',
    startersLabel: 'Startsechs: die übliche Startaufstellung des Teams',
    statsLabel: 'Statistik: Saisonstatistik des Teams',
  },
  list: {
    count: (n: number) => (n === 1 ? '1 Vorlage' : `${n} Vorlagen`),
    add: 'Neue Vorlage',
    addLabel: 'Neue Vorlage anlegen',
    empty:
      'Noch keine Vorlagen. Speichere Aufstellungen, die du oft nutzt (zum Beispiel „5-1 starker Aufschlag“), und übernimm sie in jeden Satz.',
    summary: (filled: number, libero: boolean) => `${filled}/6${libero ? ' + L' : ''}`,
    summaryLabel: (filled: number, libero: boolean) =>
      `${filled} von 6 Positionen besetzt${libero ? ', mit Libero' : ''}`,
    open: (name: string) => `${name}: Vorlage bearbeiten`,
    renameLabel: (name: string) => `Umbenennen: Vorlage ${name}`,
    duplicate: 'Kopieren',
    duplicateLabel: (name: string) => `Kopieren: Vorlage ${name}`,
    copyName: (name: string) => `${name} (Kopie)`,
    deleteLabel: (name: string) => `Löschen: Vorlage ${name}`,
    confirmDelete: (name: string) =>
      `Die Vorlage „${name}“ löschen? Spiele werden nicht verändert.`,
    defaultName: 'Vorlage',
  },
  nameDialog: {
    newTitle: 'Neue Vorlage',
    renameTitle: 'Vorlage umbenennen',
    name: 'Name',
    placeholder: 'z. B. 5-1 starker Aufschlag',
    create: 'Anlegen',
    save: 'Speichern',
    errors: {
      required: 'Gib einen Namen ein.',
      tooLong: 'Höchstens 40 Zeichen.',
      taken: 'Dieses Team hat schon eine Vorlage mit diesem Namen.',
    },
  },
  editor: {
    title: (name: string) => `Vorlage: ${name}`,
    rename: 'Umbenennen',
    renameLabel: 'Umbenennen: diese Vorlage',
    notFound: 'Diese Vorlage gibt es nicht mehr.',
    startersHint:
      'Die Startsechs füllt Satz 1 jedes neuen Spiels. Im Spiel kannst du sie auch in jeden anderen Satz übernehmen.',
    presetHint:
      'Änderungen werden automatisch gespeichert. Im Spiel kannst du diese Vorlage in einen Satz übernehmen.',
  },
  starters: {
    heading: 'Startsechs',
    empty:
      'Noch keine Startsechs. Lege die übliche Startaufstellung und den Libero einmal fest; neue Spiele beginnen damit.',
    set: 'Startsechs festlegen',
    setLabel: 'Startsechs festlegen: gilt für das ganze Team',
    edit: 'Startsechs bearbeiten',
    editLabel: 'Startsechs bearbeiten: gilt für das ganze Team',
    incomplete: (filled: number) =>
      `${filled} von 6 Positionen festgelegt. Neue Spiele beginnen in Satz 1 damit; die übrigen Spieler wählst du im Spiel vor dem Anpfiff.`,
    complete: 'Neue Spiele beginnen in Satz 1 mit dieser Aufstellung.',
    leftOut: (n: number) =>
      n === 1
        ? '1 dieser Spieler ist verletzt und wird in neuen Spielen ausgelassen.'
        : `${n} dieser Spieler sind verletzt und werden in neuen Spielen ausgelassen.`,
    libero: (name: string) => `Libero: ${name}`,
    noLibero: 'Kein Libero',
    courtLabel: (summary: string) => `Startsechs: ${summary}`,
  },
  apply: {
    useStarters: 'Startsechs übernehmen',
    useStartersLabel: 'Diesen Satz mit der Startsechs des Teams füllen',
    noStarters: 'Das Team hat noch keine Startsechs (Team › Startsechs).',
    applyPreset: 'Vorlage übernehmen…',
    applyPresetLabel: 'Eine Vorlage wählen, um diesen Satz zu füllen',
    noPresets: 'Das Team hat noch keine Vorlagen (Team › Vorlagen).',
    choose: 'Vorlage wählen:',
    presetLabel: (name: string) => `${name}: Vorlage in diesen Satz übernehmen`,
    cancel: 'Abbrechen',
    cancelLabel: 'Abbrechen: Vorlagenliste schließen',
    locked:
      'Dieser Satz wurde schon gespielt; setze seine Live-Daten zurück, um die Aufstellung zu ändern.',
    applied: (name: string) => `${name} übernommen.`,
    startersName: 'Startsechs',
    skipped: (name: string, players: string) =>
      `${name} übernommen. Ausgelassen (verletzt oder nicht mehr im Team): ${players}.`,
    unknownPlayer: 'ein entfernter Spieler',
  },
};
