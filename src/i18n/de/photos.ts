import type { Strings } from '../en';

/** v6: Profil- und Spielerfotos. */
export const photos: Strings['photos'] = {
  title: 'Foto',
  add: 'Foto hinzufügen',
  change: 'Foto ändern',
  remove: 'Foto entfernen',
  addHint: 'Nimm ein Foto auf oder wähle eins aus; es wird mit dem Formular gespeichert.',
  unsaved: 'Das neue Foto wird mit dem Formular gespeichert.',
  removed: 'Das Foto wird entfernt, wenn du das Formular speicherst.',
  processing: 'Foto wird vorbereitet …',
  takePhoto: 'Foto aufnehmen',
  choosePhoto: 'Foto auswählen',
  cancelChoiceLabel: 'Abbrechen, kein neues Foto',
  denied:
    'Die App darf die Kamera nicht verwenden. Erlaube es in den Einstellungen deines Handys oder wähle ein Foto aus.',
  failed: 'Das Bild konnte nicht geladen werden. Versuch ein anderes.',
  chipCaption: (number: number, name: string) => `#${number} ${name}`,
};
