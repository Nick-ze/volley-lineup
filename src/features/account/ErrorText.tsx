import type { SyncErrorCode } from '@/domain/types';
import { StatusMessage } from '@/features/settings/StatusMessage';
import { useT } from '@/i18n';

/** v10: a sync command's error as a short, announced message (nothing when null). */
export function ErrorText({ error, testID }: { error: SyncErrorCode | null; testID?: string }) {
  const t = useT();
  return (
    <StatusMessage
      status={error ? { tone: 'error', text: t.account.errors[error] } : null}
      testID={testID}
    />
  );
}
