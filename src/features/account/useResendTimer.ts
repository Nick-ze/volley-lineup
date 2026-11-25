import { useCallback, useEffect, useState } from 'react';

import { resendSecondsLeft } from '@/domain/syncSetup';

/** v10: the 60 s wait before another sign-in code may be sent; `start()` when one was sent. */
export function useResendTimer() {
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const left = sentAt === null ? 0 : resendSecondsLeft(sentAt, now);
  const running = left > 0;
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const start = useCallback(() => {
    const at = Date.now();
    setSentAt(at);
    setNow(at);
  }, []);
  return { left, start };
}
