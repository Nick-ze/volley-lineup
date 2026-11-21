/** Roles on court (v4.0): role tags, the role picker, setter rotation, libero on/off. Shared by the v4 workers. */
export const roles = {
  title: 'Roles',
  /** Added to a court spot's label: the role in words. */
  spotRole: (role: string, offPosition: boolean) =>
    offPosition ? `plays ${role}, not one of their positions` : `plays ${role}`,
  /** The role tag button on a court spot; starts with the visible code (e.g. "OPP"). */
  tagLabel: (code: string, role: string, name: string, offPosition: boolean) =>
    `${code}, ${role}${offPosition ? ', not one of their positions' : ''}. Change the role of ${name}`,
  tagHint: 'Opens the role choice',
  picker: {
    title: (name: string) => `Role of ${name}`,
    hint: 'Anyone can play any role. Roles marked * are none of the player’s positions.',
    optionText: (code: string, role: string) => `${code} · ${role}`,
    optionLabel: (code: string, role: string, offPosition: boolean) =>
      `${code} · ${role}${offPosition ? ', not one of their positions' : ''}`,
    offMark: ' *',
    cancelLabel: 'Close the role choice',
  },
  confirm: {
    title: 'Are you sure?',
    message: (name: string, role: string) =>
      `${name} isn’t listed as ${role}. Play them as ${role}?`,
    confirm: 'Confirm',
    confirmLabel: (role: string) => `Confirm: play as ${role}`,
  },
} as const;
