import type { Strings } from '../en';

/** Export / Import / Einstellungen. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const transfer: Strings['transfer'] = {
  export: {
    title: 'Export',
    hint: 'Speichere deine Daten als .json-Datei, als Sicherung oder für ein anderes Gerät.',
    all: 'Alles exportieren',
    team: (name: string) => `${name} exportieren`,
    teamLabel: (name: string) => `Nur das Team ${name} exportieren`,
    teamsHeading: 'Ein Team exportieren',
    noTeams: 'Das aktuelle Profil hat noch keine Teams.',
    dialogTitle: 'Volley-Lineup-Daten exportieren',
    done: (fileName: string) => `${fileName} exportiert.`,
    failed: 'Export fehlgeschlagen. Bitte versuche es noch einmal.',
  },
  import: {
    title: 'Import',
    hint: 'Lade eine .json-Datei, die aus Volley Lineup exportiert wurde.',
    pick: 'Aus Datei importieren',
    previewTitle: (fileName: string) => `Bereit, ${fileName} zu importieren`,
    summary: (s: {
      profiles: number;
      teams: number;
      players: number;
      matches: number;
      presets: number;
    }) =>
      [
        plural(s.teams, 'Team', 'Teams'),
        plural(s.players, 'Spieler', 'Spieler'),
        plural(s.matches, 'Spiel', 'Spiele'),
        plural(s.presets, 'gespeicherte Aufstellung', 'gespeicherte Aufstellungen'),
        plural(s.profiles, 'Profil', 'Profile'),
      ].join(', '),
    mergeHint:
      'Zusammenführen fügt die Datei zu deinen Daten hinzu; vorhandene Einträge werden aktualisiert. Die Startsechs eines Teams aus der Datei ersetzt deine.',
    replaceHint: 'Ersetzen löscht alle aktuellen Daten und behält nur die Daten aus der Datei.',
    merge: 'Zusammenführen',
    replace: 'Ersetzen',
    cancel: 'Import abbrechen',
    doneMerge: 'Import abgeschlossen: Daten zusammengeführt.',
    doneReplace: 'Import abgeschlossen: Daten ersetzt.',
    errors: {
      INVALID_JSON: 'Diese Datei ist kein gültiges JSON. Es wurde nichts geändert.',
      NOT_VOLLEY_LINEUP: 'Diese Datei ist kein Volley-Lineup-Export. Es wurde nichts geändert.',
      UNSUPPORTED_VERSION:
        'Diese Datei stammt aus einer anderen Version von Volley Lineup und kann nicht gelesen werden. Es wurde nichts geändert.',
      INVALID_SHAPE: 'Diese Datei ist beschädigt oder unvollständig. Es wurde nichts geändert.',
      INCONSISTENT_REFERENCES:
        'Diese Datei enthält Daten, die nicht zusammenpassen (zum Beispiel einen Spieler in einem unbekannten Team). Es wurde nichts geändert.',
      MERGE_CONFLICT:
        'Zusammenführen würde deine Daten widersprüchlich machen (zum Beispiel zwei Spieler mit derselben Trikotnummer in einem Team). Es wurde nichts geändert – verwende stattdessen Ersetzen.',
      READ_FAILED: 'Die Datei konnte nicht gelesen werden. Es wurde nichts geändert.',
    },
  },
  danger: {
    title: 'Alle Daten löschen',
    hint: 'Entfernt alle Profile, Teams, Spieler und Spiele von diesem Gerät.',
    button: 'Alle Daten löschen',
    confirmTitle: 'Alles löschen?',
    confirmBody:
      'Das kann nicht rückgängig gemacht werden. Exportiere deine Daten vorher, wenn du eine Sicherung willst.',
    confirm: 'Ja, alles löschen',
    cancel: 'Daten behalten',
    done: 'Alle Daten gelöscht.',
  },
  about: {
    title: 'Über',
    version: (version: string) => `Version ${version}`,
    unknownVersion: 'unbekannt',
  },
};
