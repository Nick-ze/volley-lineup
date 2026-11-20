import { useCallback, useState } from 'react';

interface PendingConfirm {
  message: string;
  onConfirm: () => void;
}

/** State for one ConfirmDialog: `ask(message, action)` opens it; spread `dialogProps` on it. */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const ask = useCallback((message: string, onConfirm: () => void) => {
    setPending({ message, onConfirm });
  }, []);
  const onCancel = useCallback(() => setPending(null), []);
  const onConfirm = useCallback(() => {
    pending?.onConfirm();
    setPending(null);
  }, [pending]);
  return {
    ask,
    dialogProps: {
      visible: pending !== null,
      message: pending?.message ?? '',
      onConfirm,
      onCancel,
    },
  };
}
