/** v8: team pictures and the roster's player cards. */
export const teamPhoto = {
  title: 'Team picture',
  add: 'Add team picture',
  change: 'Change team picture',
  remove: 'Remove team picture',
  addHint: 'Take a picture or choose one; it is saved with the team.',
  unsaved: 'The new team picture is saved with the team.',
  removed: 'The team picture is removed when the team is saved.',
  /** The preview without a picture: the team's initial in a coloured circle. */
  initialOf: (team: string) =>
    team.trim() === '' ? 'No team picture yet' : `No team picture: initial of ${team}`,
};
