import { useCallback, useState } from 'react';

import type { ConfirmDialogProps } from '@/components';

interface Pending {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/**
 * Like `useConfirm`, with the confirm button's text per question ("Remove", "Revoke", "Leave"):
 * `ask(message, confirmLabel, action)`; spread `dialogProps` on a `ConfirmDialog`.
 */
export function useConfirmAction() {
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = useCallback((message: string, confirmLabel: string, onConfirm: () => void) => {
    setPending({ message, confirmLabel, onConfirm });
  }, []);
  const dialogProps: ConfirmDialogProps = {
    visible: pending !== null,
    message: pending?.message ?? '',
    confirmLabel: pending?.confirmLabel,
    onCancel: () => setPending(null),
    onConfirm: () => {
      pending?.onConfirm();
      setPending(null);
    },
  };
  return { ask, dialogProps };
}
