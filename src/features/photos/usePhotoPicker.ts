import { useState } from 'react';

import { canTakePhoto, pickPhoto, type PhotoSource } from '@/lib/pickPhoto';

export type PickProblem = 'denied' | 'failed';

/**
 * The "Add / Change photo" flow of a form: where the camera is offered, ask "Take photo" or
 * "Choose photo" first (inline, no modal: a system picker can't open over a closing modal on
 * iOS); otherwise go straight to the gallery / file chooser. `onPicked` gets the data URI;
 * `onBusyChange` tells the form while a picture is being prepared (Save must wait for it).
 */
export function usePhotoPicker(
  onPicked: (dataUri: string) => void,
  onBusyChange?: (busy: boolean) => void,
) {
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<PickProblem | null>(null);

  // Must start the picker synchronously in the press handler: a browser only opens a file
  // input from a user's click.
  const pick = (source: PhotoSource) => {
    setChoosing(false);
    setProblem(null);
    setBusy(true);
    onBusyChange?.(true);
    void pickPhoto(source).then((result) => {
      setBusy(false);
      onBusyChange?.(false);
      if (result.status === 'picked') onPicked(result.dataUri);
      else if (result.status !== 'cancelled') setProblem(result.status);
    });
  };

  const start = () => {
    if (canTakePhoto()) {
      setProblem(null);
      setChoosing(true);
    } else {
      pick('library');
    }
  };

  return { choosing, busy, problem, start, pick, cancel: () => setChoosing(false) };
}
