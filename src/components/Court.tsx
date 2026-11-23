import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { SpotKeys } from '@/domain/courtMotion';
import { COURT_ROWS } from '@/domain/rotation';
import type { CourtPosition } from '@/domain/types';
import { useT } from '@/i18n';

import { CourtGhosts } from './CourtMotion';
import { CourtSlot, type CourtSlotInfo, type CourtSlotRef } from './CourtSlot';
import { flat, splitPadding, useCourtStyles } from './courtStyle';
import { useCourtMotion } from './useCourtMotion';

/** Front row is drawn nearest the net (top), back row below. Left→right as seen from behind our baseline. */
export const [FRONT_ROW, BACK_ROW] = COURT_ROWS;

export type { CourtSlotInfo, CourtSlotRef };

export interface CourtProps {
  /** Renders the content of one court position (a PlayerChip, an empty drop slot, …). */
  renderSlot: (info: CourtSlotInfo) => ReactNode;
  /** Optional wrapper style per slot, e.g. a yellow glow for valid drop targets. */
  slotStyle?: (info: CourtSlotInfo) => StyleProp<ViewStyle>;
  /** Ref callback per slot so drag & drop can measure slots and hit-test drops. */
  slotRef?: (position: CourtPosition, view: CourtSlotRef | null) => void;
  showPositionNumbers?: boolean;
  /**
   * v8: who stands on each spot (player ids). With it, a rotation slides every spot's content
   * (`renderSlot`) from its old spot to its new one.
   */
  slotKeys?: SpotKeys;
  /** v8: content that belongs to the spot itself and never slides (e.g. its number). */
  renderSlotStatic?: (info: CourtSlotInfo) => ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const isFront = (position: CourtPosition) => FRONT_ROW.includes(position);

export function Court({
  renderSlot,
  slotStyle,
  slotRef,
  showPositionNumbers = true,
  slotKeys,
  renderSlotStatic,
  style,
  testID,
}: CourtProps) {
  const styles = useCourtStyles();
  const t = useT();
  const motion = useCourtMotion(slotKeys);
  const animated = slotKeys !== undefined;
  const slotParts = (info: CourtSlotInfo) => splitPadding(flat([styles.slot, slotStyle?.(info)]));
  const info = (position: CourtPosition) => ({ position, isFrontRow: isFront(position) });
  const content = (position: CourtPosition) => [styles.content, slotParts(info(position)).padding];

  const row = (positions: readonly CourtPosition[], isFrontRow: boolean) => (
    <View
      style={styles.row}
      onLayout={animated ? motion.onRowLayout(isFrontRow) : undefined}
      testID={`court-row-${isFrontRow ? 'front' : 'back'}`}
    >
      {positions.map((position) => {
        const slot = { position, isFrontRow };
        return (
          <CourtSlot
            key={position}
            slot={slot}
            parts={animated ? slotParts(slot) : null}
            hidden={motion.moves[position] !== undefined}
            renderSlot={renderSlot}
            slotStyle={slotStyle}
            slotRef={slotRef}
            showPositionNumbers={showPositionNumbers}
            renderSlotStatic={renderSlotStatic}
            onLayout={animated ? motion.onSlotLayout(position) : undefined}
          />
        );
      })}
    </View>
  );

  return (
    <View style={[styles.court, style]} testID={testID}>
      <View style={styles.grid}>
        <View style={styles.net} accessibilityLabel={t.court.net}>
          <Text style={styles.netLabel}>{t.court.net}</Text>
        </View>
        {row(FRONT_ROW, true)}
        <View style={styles.attackLine} />
        {row(BACK_ROW, false)}
        {animated ? (
          <CourtGhosts
            motion={motion}
            isFrontRow={isFront}
            boxStyle={(p) => flat([slotParts(info(p)).box, styles.ghostBox])}
            contentStyle={(p) => flat(content(p))}
            renderContent={(p) => renderSlot(info(p))}
          />
        ) : null}
      </View>
    </View>
  );
}
