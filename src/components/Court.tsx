import type { ComponentRef, ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { SpotKeys } from '@/domain/courtMotion';
import type { CourtPosition } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { CourtGhosts, useCourtMotion } from './CourtMotion';

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

const PADDING_KEYS = [
  'padding',
  'paddingVertical',
  'paddingHorizontal',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
] as const;

/** A slot's style split into its box and its padding (which goes to the sliding content box). */
function splitPadding(style: ViewStyle): { box: ViewStyle; padding: ViewStyle } {
  const box: Record<string, unknown> = { ...style };
  const padding: Record<string, unknown> = {};
  for (const key of PADDING_KEYS) {
    if (style[key] !== undefined) {
      padding[key] = style[key];
      delete box[key];
    }
  }
  return { box: box as ViewStyle, padding: padding as ViewStyle };
}

/** One flat style object (StyleSheet.flatten of nothing is empty). */
const flat = (style: StyleProp<ViewStyle>): ViewStyle => StyleSheet.flatten(style) ?? {};

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
  const styles = useStyles();
  const t = useT();
  const motion = useCourtMotion(slotKeys);
  const animated = slotKeys !== undefined;
  const slotParts = (info: CourtSlotInfo) => splitPadding(flat([styles.slot, slotStyle?.(info)]));
  const info = (position: CourtPosition) => ({ position, isFrontRow: isFront(position) });
  const content = (position: CourtPosition) => [styles.content, slotParts(info(position)).padding];

  const row = (positions: readonly CourtPosition[], isFrontRow: boolean) => (
    <View style={styles.row} onLayout={animated ? motion.onRowLayout(isFrontRow) : undefined}>
      {positions.map((position) => {
        const slot = { position, isFrontRow };
        const parts = animated ? slotParts(slot) : null;
        return (
          <View
            key={position}
            ref={slotRef ? (v) => slotRef(position, v) : undefined}
            collapsable={false}
            style={parts ? parts.box : [styles.slot, slotStyle?.(slot)]}
            onLayout={animated ? motion.onSlotLayout(position) : undefined}
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
              <View
                style={[
                  styles.content,
                  parts.padding,
                  motion.moves[position] !== undefined && styles.hidden,
                ]}
              >
                {renderSlot(slot)}
              </View>
            ) : (
              renderSlot(slot)
            )}
          </View>
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

const useStyles = makeStyles((theme) => ({
  // v8: the sliding content box inside a slot (it takes the slot's padding and alignment).
  content: { flexGrow: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  // The sliding copy keeps the slot's size and border width, without its fill and outline.
  ghostBox: { backgroundColor: theme.colors.transparent, borderColor: theme.colors.transparent },
  court: {
    backgroundColor: theme.colors.primary,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: theme.colors.courtLine,
    padding: spacing.sm,
    paddingTop: 0,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  grid: { gap: spacing.sm },
  net: {
    height: 18,
    borderBottomWidth: 4,
    borderBottomColor: theme.colors.net,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: -spacing.sm,
  },
  netLabel: { ...typography.caption, color: theme.colors.onCourt, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  attackLine: { height: 2, backgroundColor: theme.colors.courtLine, opacity: 0.8 },
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
    color: theme.colors.onCourt,
  },
}));
