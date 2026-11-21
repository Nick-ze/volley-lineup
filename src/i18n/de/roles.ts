import type { Strings } from '../en';

/** Rollen auf dem Feld (v4.0). */
export const roles: Strings['roles'] = {
  title: 'Rollen',
  spotRole: (role: string, offPosition: boolean) =>
    offPosition ? `spielt ${role}, keine seiner Positionen` : `spielt ${role}`,
  tagLabel: (code: string, role: string, name: string, offPosition: boolean) =>
    `${code}, ${role}${offPosition ? ', keine seiner Positionen' : ''}. Rolle von ${name} ändern`,
  tagHint: 'Öffnet die Rollenauswahl',
  picker: {
    title: (name: string) => `Rolle von ${name}`,
    hint: 'Jeder kann jede Rolle spielen. Mit * markierte Rollen sind keine seiner Positionen.',
    optionText: (code: string, role: string) => `${code} · ${role}`,
    optionLabel: (code: string, role: string, offPosition: boolean) =>
      `${code} · ${role}${offPosition ? ', keine seiner Positionen' : ''}`,
    offMark: ' *',
    cancelLabel: 'Rollenauswahl schließen',
  },
  confirm: {
    title: 'Bist du sicher?',
    message: (name: string, role: string) =>
      `${name} ist nicht als ${role} eingetragen. Als ${role} spielen lassen?`,
    confirm: 'Bestätigen',
    confirmLabel: (role: string) => `Bestätigen: als ${role} spielen`,
  },
};
