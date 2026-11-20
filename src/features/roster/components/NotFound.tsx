import { Text } from 'react-native';

import { Button, Screen } from '@/components';
import { t } from '@/i18n/en';

import { listStyles } from './styles';

/** Shown when a route points at a team / player that no longer exists. */
export function NotFound({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <Screen>
      <Text style={listStyles.empty} accessibilityRole="alert">
        {message}
      </Text>
      <Button label={t.roster.backToTeams} variant="secondary" onPress={onBack} />
    </Screen>
  );
}
