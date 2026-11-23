import { Text } from 'react-native';

import { useT } from '@/i18n';

import { Button } from './Button';
import { useListStyles } from './formStyles';
import { Screen } from './Screen';

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
  const listStyles = useListStyles();
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
