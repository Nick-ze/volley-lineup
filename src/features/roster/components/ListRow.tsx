import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useT } from '@/i18n';

import { useListStyles } from './styles';

export interface ListRowProps {
  title: string;
  subtitle?: ReactNode;
  leading?: ReactNode;
  /** Trailing action buttons (rename, delete, toggles…). */
  actions?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

/** A card-like list row: a large pressable main area plus optional trailing actions. */
export function ListRow({
  title,
  subtitle,
  leading,
  actions,
  onPress,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const styles = useListStyles();
  const t = useT();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        {leading}
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {typeof subtitle === 'string' ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
        </View>
        <Text style={styles.chevron} importantForAccessibility="no" accessibilityElementsHidden>
          {t.roster.rowChevron}
        </Text>
      </Pressable>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}
