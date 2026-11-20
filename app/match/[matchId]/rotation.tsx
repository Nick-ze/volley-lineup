import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { RotationViewer } from '@/features/rotation';

export default function RotationScreen() {
  const { matchId, set } = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  return (
    <Screen>
      <RotationViewer
        matchId={matchId}
        setParam={set}
        onSelectSet={(s) => router.setParams({ set: String(s) })}
      />
    </Screen>
  );
}
