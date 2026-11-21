import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { plausibleErrorTypes, type LastRally } from '@/domain/lastRally';
import type { ErrorType } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { TagChip } from './TagChip';

export interface ErrorTypeChipsProps {
  rally: LastRally;
  /** The chosen "Our error" chip, shown first. */
  kindChip: ReactNode;
  /** Saves the error type of the last rally (null clears it). */
  onErrorType: (type: ErrorType | null) => void;
}

/**
 * The optional error type of "our error" (docs/VOLLEYBALL_RULES.md §7), inside the player
 * picker's row. Without a type: the kind chip and the plausible types as a labelled, full-width
 * group (players below). With a type: the kind chip and only that type's chip (tap to clear it
 * and choose again), inline with the players, so the row stays as short as before.
 */
export function ErrorTypeChips({ rally, kindChip, onErrorType }: ErrorTypeChipsProps) {
  const t = useT();
  const chosen = rally.event.errorType;
  if (chosen !== undefined) {
    const label = t.tags.errorTypes[chosen];
    return (
      <>
        {kindChip}
        <TagChip
          label={label}
          accessibilityLabel={t.tags.clearErrorType(label)}
          selected
          onPress={() => onErrorType(null)}
          testID={`tag-error-${chosen}`}
        />
      </>
    );
  }
  return (
    <View
      style={styles.group}
      role="group"
      accessibilityLabel={t.tags.errorTypesLabel}
      testID="tag-error-types"
    >
      {kindChip}
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Full width in the wrapping row: the players start on a new line.
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, width: '100%' },
});
