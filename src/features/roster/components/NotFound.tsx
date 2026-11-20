import { Text } from 'react-native';

import { Button, Screen } from '@/components';
import { t } from '@/i18n/en';

import { listStyles } from './styles';

/** Shown when a route points at a team / player that no longer exists. */
export function NotFound({
  message,
  onBack,
  backLabel = t.roster.backToTeams,
}: {
  message: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <Screen>
      <Text style={listStyles.empty} accessibilityRole="alert">
        {message}
      </Text>
      <Button label={backLabel} variant="secondary" onPress={onBack} />
    </Screen>
  );
}
