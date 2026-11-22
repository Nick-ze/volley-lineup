import type { Strings } from '../en';

/** v8: Teambilder und die Spielerkarten im Kader. */
export const teamPhoto: Strings['teamPhoto'] = {
  title: 'Teambild',
  add: 'Teambild hinzufügen',
  change: 'Teambild ändern',
  remove: 'Teambild entfernen',
  addHint: 'Mach ein Foto oder wähle eins aus; es wird mit dem Team gespeichert.',
  unsaved: 'Das neue Teambild wird mit dem Team gespeichert.',
  removed: 'Das Teambild wird beim Speichern des Teams entfernt.',
  initialOf: (team: string) =>
    team.trim() === '' ? 'Noch kein Teambild' : `Kein Teambild: Anfangsbuchstabe von ${team}`,
};
