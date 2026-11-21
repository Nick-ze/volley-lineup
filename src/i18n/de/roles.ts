import type { Strings } from '../en';

/** Rollen auf dem Feld (v4.0). */
export const roles: Strings['roles'] = {
  title: 'Rollen',
  playerRef: (number: number, name: string) => `#${number} ${name}`.trim(),
  spotRole: (role: string, offPosition: boolean) =>
    offPosition ? `spielt ${role}, nicht als Position eingetragen` : `spielt ${role}`,
  tagLabel: (code: string, role: string, name: string, offPosition: boolean) =>
    `${code}, ${role}${offPosition ? ', nicht als Position eingetragen' : ''}. ${name} auswählen`,
  tagHint: 'Wählt den Spieler aus, wie ein Tippen auf den Chip',
  confirm: {
    title: 'Bist du sicher?',
    notListed: (player: string, role: string) => `${player} ist nicht als ${role} eingetragen.`,
    questionOne: 'Trotzdem auf diese Position stellen?',
    questionMany: 'Trotzdem auf diese Positionen stellen?',
    questionFormation: 'Formation trotzdem ändern?',
    confirmFormationLabel: 'Bestätigen: Formation trotzdem ändern',
    confirm: 'Bestätigen',
    confirmLabel: 'Bestätigen: trotzdem auf die Position stellen',
    cancel: 'Abbrechen',
    cancelLabel: 'Abbrechen: nichts ändert sich',
  },
};
