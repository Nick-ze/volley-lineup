import { Text } from 'react-native';

import { Button, Screen } from '@/components';
import { useT } from '@/i18n';

import { listStyles } from './styles';

/** Shown when a route points at a team / player that no longer exists. */
export function NotFound({
  message,
  onBack,
  backLabel,
}: {
  message: string;
  onBack: () => void;
  backLabel?: string;
}) {
  const t = useT();
  return (
    <Screen>
      <Text style={listStyles.empty} accessibilityRole="alert">
        {message}
      </Text>
      <Button label={backLabel ?? t.roster.backToTeams} variant="secondary" onPress={onBack} />
    </Screen>
  );
}
