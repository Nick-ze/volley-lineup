import { useState } from 'react';

import { Button } from '@/components';
import { ConfirmDialog } from '@/features/roster/components/ConfirmDialog';
import { useT } from '@/i18n';

export interface ResetLiveDataProps {
  disabled: boolean;
  onReset: () => void;
}

/** "Reset live data" with the in-app confirm dialog: clears the set's score and subs. */
export function ResetLiveData({ disabled, onReset }: ResetLiveDataProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        label={t.live.reset}
        accessibilityHint={t.live.resetHint}
        variant="danger"
        compact
        disabled={disabled}
        onPress={() => setOpen(true)}
        testID="reset-live"
      />
      <ConfirmDialog
        visible={open}
        message={t.live.resetConfirm}
        confirmLabel={t.live.resetConfirmButton}
        onConfirm={() => {
          setOpen(false);
          onReset();
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
