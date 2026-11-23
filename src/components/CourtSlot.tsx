import type { ComponentRef, ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import type { CourtPosition } from '@/domain/types';
import { useT } from '@/i18n';

import { useCourtStyles } from './courtStyle';

export type CourtSlotRef = ComponentRef<typeof View>;

export interface CourtSlotInfo {
  position: CourtPosition;
  isFrontRow: boolean;
}

export interface CourtSlotProps {
  slot: CourtSlotInfo;
  /**
   * With court motion: the slot's box and its padding (the content box inside takes the
   * padding, so it can slide). Null draws the slot as it is.
   */
  parts: { box: ViewStyle; padding: ViewStyle } | null;
  /** With court motion: the content is hidden while its copy slides in. */
  hidden: boolean;
  renderSlot: (info: CourtSlotInfo) => ReactNode;
  slotStyle?: (info: CourtSlotInfo) => StyleProp<ViewStyle>;
  slotRef?: (position: CourtPosition, view: CourtSlotRef | null) => void;
  showPositionNumbers: boolean;
  renderSlotStatic?: (info: CourtSlotInfo) => ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/** One court position: its number, its static content and its (sliding) content. */
export function CourtSlot({
  slot,
  parts,
  hidden,
  renderSlot,
  slotStyle,
  slotRef,
  showPositionNumbers,
  renderSlotStatic,
  onLayout,
}: CourtSlotProps) {
  const styles = useCourtStyles();
  const t = useT();
  const { position } = slot;
  return (
    <View
      ref={slotRef ? (v) => slotRef(position, v) : undefined}
      collapsable={false}
      style={parts ? parts.box : [styles.slot, slotStyle?.(slot)]}
      onLayout={onLayout}
      testID={`court-slot-${position}`}
    >
      {showPositionNumbers ? (
        <Text style={styles.posNumber} accessibilityLabel={t.court.position(position)}>
          {position}
        </Text>
      ) : null}
      {renderSlotStatic?.(slot)}
      {parts ? (
        // The content fills the slot like before (with the slot's padding), so it can be
        // hidden while its copy slides in.
        <View style={[styles.content, parts.padding, hidden && styles.hidden]}>
          {renderSlot(slot)}
        </View>
      ) : (
        renderSlot(slot)
      )}
    </View>
  );
}
