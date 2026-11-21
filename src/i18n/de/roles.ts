import type { Strings } from '../en';

/** Rollen auf dem Feld (v4.0). */
export const roles: Strings['roles'] = {
  title: 'Rollen',
  playerRef: (number: number, name: string) => `#${number} ${name}`.trim(),
  spotRole: (role: string, offPosition: boolean) =>
    offPosition ? `spielt ${role}, nicht als Position eingetragen` : `spielt ${role}`,
  tagLabel: (code: string, role: string, name: string, offPosition: boolean) =>
    `${code}, ${role}${offPosition ? ', nicht als Position eingetragen' : ''}. Rolle von ${name} ändern`,
  tagHint: 'Öffnet die Rollenauswahl',
  picker: {
    title: (name: string) => `Rolle von ${name}`,
    hint: 'Alle können jede Rolle spielen. Mit * markierte Rollen sind nicht als Position eingetragen.',
    optionText: (code: string, role: string) => `${code} · ${role}`,
    optionLabel: (code: string, role: string, offPosition: boolean) =>
      `${code} · ${role}${offPosition ? ', nicht als Position eingetragen' : ''}`,
    offMark: ' *',
    cancelLabel: 'Abbrechen: Rollenauswahl schließen',
  },
  confirm: {
    title: 'Bist du sicher?',
    message: (name: string, role: string) =>
      `${name} ist nicht als ${role} eingetragen. Als ${role} spielen lassen?`,
    confirm: 'Bestätigen',
    confirmLabel: (role: string) => `Bestätigen: als ${role} spielen`,
  },
};
