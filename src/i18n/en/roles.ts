/** Roles on court (v4.0, v6 formations): role tags, off-position confirmation. */
export const roles = {
  title: 'Roles',
  /** A player as "#7 Anna Smith". */
  playerRef: (number: number, name: string) => `#${number} ${name}`.trim(),
  /** Added to a court spot's label: the role in words. */
  spotRole: (role: string, offPosition: boolean) =>
    offPosition ? `plays ${role}, not one of their positions` : `plays ${role}`,
  /** The role tag button on a court spot; starts with the visible code (e.g. "OPP"). */
  tagLabel: (code: string, role: string, name: string, offPosition: boolean) =>
    `${code}, ${role}${offPosition ? ', not one of their positions' : ''}. Select ${name}`,
  tagHint: 'Selects the player, like tapping the chip',
  /** "Are you sure?" before a move puts someone on a role that is none of their positions. */
  confirm: {
    title: 'Are you sure?',
    notListed: (player: string, role: string) => `${player} isn’t listed as ${role}.`,
    questionOne: 'Put them on this spot?',
    questionMany: 'Put them on these spots?',
    questionFormation: 'Change the formation anyway?',
    confirmFormationLabel: 'Confirm: change the formation anyway',
    confirm: 'Confirm',
    confirmLabel: 'Confirm: put them on the spot anyway',
    cancel: 'Cancel',
    cancelLabel: 'Cancel: nothing changes',
  },
} as const;
