/** v6: profile and player pictures (worker A). */
export const photos = {
  title: 'Photo',
  add: 'Add photo',
  change: 'Change photo',
  remove: 'Remove photo',
  /** Hint of the "Add / Change photo" button. */
  addHint: 'Take a picture or choose one; it is saved with the form.',
  /** Shown in the form after a change that isn't saved yet. */
  unsaved: 'The new photo is saved with the form.',
  removed: 'The photo is removed when the form is saved.',
  /** While a picked picture is resized and compressed (Save waits). */
  processing: 'Preparing photo…',
  takePhoto: 'Take photo',
  choosePhoto: 'Choose photo',
  /** The camera / gallery choice's Cancel (the form has its own). */
  cancelChoiceLabel: 'Cancel photo choice',
  denied:
    'The app may not use the camera. Allow it in your phone’s settings, or choose a photo instead.',
  failed: 'That picture couldn’t be loaded. Try another one.',
  /** Bench / substitution chips with a picture: number and name under it. */
  chipCaption: (number: number, name: string) => `#${number} ${name}`,
} as const;
