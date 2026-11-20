import type { ComponentRef, ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CourtPosition } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, radius, spacing, typography } from '@/theme';

/** Front row is drawn nearest the net (top), back row below. Left→right as seen from behind our baseline. */
export const FRONT_ROW: readonly CourtPosition[] = [4, 3, 2];
export const BACK_ROW: readonly CourtPosition[] = [5, 6, 1];

export type CourtSlotRef = ComponentRef<typeof View>;

export interface CourtSlotInfo {
  position: CourtPosition;
  isFrontRow: boolean;
}

export interface CourtProps {
  /** Renders the content of one court position (a PlayerChip, an empty drop slot, …). */
  renderSlot: (info: CourtSlotInfo) => ReactNode;
  /** Optional wrapper style per slot, e.g. a yellow glow for valid drop targets. */
  slotStyle?: (info: CourtSlotInfo) => StyleProp<ViewStyle>;
  /** Ref callback per slot so drag & drop can measure slots and hit-test drops. */
  slotRef?: (position: CourtPosition, view: CourtSlotRef | null) => void;
  showPositionNumbers?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Court({
  renderSlot,
  slotStyle,
  slotRef,
  showPositionNumbers = true,
  style,
  testID,
}: CourtProps) {
  const row = (positions: readonly CourtPosition[], isFrontRow: boolean) => (
    <View style={styles.row}>
      {positions.map((position) => {
        const info = { position, isFrontRow };
        return (
          <View
            key={position}
            ref={slotRef ? (v) => slotRef(position, v) : undefined}
            collapsable={false}
            style={[styles.slot, slotStyle?.(info)]}
            testID={`court-slot-${position}`}
          >
            {showPositionNumbers ? (
              <Text style={styles.posNumber} accessibilityLabel={t.court.position(position)}>
                {position}
              </Text>
            ) : null}
            {renderSlot(info)}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.court, style]} testID={testID}>
      <View style={styles.net} accessibilityLabel={t.court.net}>
        <Text style={styles.netLabel}>{t.court.net}</Text>
      </View>
      {row(FRONT_ROW, true)}
      <View style={styles.attackLine} />
      {row(BACK_ROW, false)}
    </View>
  );
}

const styles = StyleSheet.create({
  court: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.courtLine,
    padding: spacing.sm,
    paddingTop: 0,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: spacing.sm,
  },
  net: {
    height: 18,
    borderBottomWidth: 4,
    borderBottomColor: colors.net,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: -spacing.sm,
  },
  netLabel: { ...typography.caption, color: colors.onPrimary, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  attackLine: { height: 2, backgroundColor: colors.courtLine, opacity: 0.8 },
  slot: {
    flex: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  posNumber: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.sm,
    ...typography.label,
    color: colors.onPrimary,
  },
});
