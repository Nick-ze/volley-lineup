import { StyleSheet, View } from 'react-native';

import { plausibleErrorTypes, type LastRally } from '@/domain/lastRally';
import type { ErrorType } from '@/domain/types';
import { useT } from '@/i18n';

import { TagChip } from './TagChip';

export interface ErrorTypeChipsProps {
  rally: LastRally;
  /** Saves the error type of the last rally (null clears it). */
  onErrorType: (type: ErrorType | null) => void;
}

/**
 * The optional error type of "our error" (docs/VOLLEYBALL_RULES.md §7), inside the player
 * picker's row. Without a type: the plausible types, then a line break before the players. With
 * a type: only that chip (tap to clear it and choose again), so the row stays as short as before.
 */
export function ErrorTypeChips({ rally, onErrorType }: ErrorTypeChipsProps) {
  const t = useT();
  const chosen = rally.event.errorType;
  if (chosen !== undefined) {
    const label = t.tags.errorTypes[chosen];
    return (
      <TagChip
        label={label}
        accessibilityLabel={t.tags.clearErrorType(label)}
        selected
        onPress={() => onErrorType(null)}
        testID={`tag-error-${chosen}`}
      />
    );
  }
  return (
    <>
      {plausibleErrorTypes(rally).map((type) => {
        const label = t.tags.errorTypes[type];
        return (
          <TagChip
            key={type}
            label={label}
            accessibilityLabel={t.tags.chooseErrorType(label)}
            onPress={() => onErrorType(type)}
            testID={`tag-error-${type}`}
          />
        );
      })}
      {/* A full-width spacer in the wrapping row: the players start on a new line. */}
      <View style={styles.break} />
    </>
  );
}

const styles = StyleSheet.create({
  break: { width: '100%', height: 0 },
});
