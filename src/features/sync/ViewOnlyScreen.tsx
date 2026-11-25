import { Button, ReadOnlyNote, Screen, ScreenTitle } from '@/components';

export interface ViewOnlyScreenProps {
  title: string;
  backLabel: string;
  onBack: () => void;
}

/**
 * v10: the route guard of an editor screen (player, season, new match) for a view-only member:
 * the reason instead of the form, and a way back.
 */
export function ViewOnlyScreen({ title, backLabel, onBack }: ViewOnlyScreenProps) {
  return (
    <Screen testID="view-only-screen">
      <ScreenTitle title={title} />
      <ReadOnlyNote block="viewer" />
      <Button label={backLabel} variant="secondary" onPress={onBack} />
    </Screen>
  );
}
