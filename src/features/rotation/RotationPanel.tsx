import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  getRotation,
  nextRotation,
  previousRotation,
  type RotationNumber,
} from '@/domain/rotation';
import type { Player, SetLineup } from '@/domain/types';
import { t } from '@/i18n/en';
import { useIsWide } from '@/lib/useIsWide';
import { colors, spacing, typography } from '@/theme';

import { COURT_MAX_WIDTH, SIDE_PANEL_WIDTH } from './layout';
import { RotationCourt } from './RotationCourt';
import { RotationStepper } from './RotationStepper';
import { SetInfo } from './SetInfo';
import { SwipeArea } from './SwipeArea';

export interface RotationPanelProps {
  set: SetLineup;
  playersById: Map<string, Player>;
}

/** Court + stepper for one set. Remount (key by set number) to start again at rotation 1. */
export function RotationPanel({ set, playersById }: RotationPanelProps) {
  const isWide = useIsWide();
  const [rotation, setRotation] = useState<RotationNumber>(1);
  const slots = useMemo(() => getRotation(set.slots, rotation), [set.slots, rotation]);
  const isEmpty = Object.values(set.slots).every((id) => id === null);
  const next = () => setRotation(nextRotation);
  const previous = () => setRotation(previousRotation);

  return (
    <View style={styles.wrap}>
      <RotationStepper
        rotation={rotation}
        onNext={next}
        onPrevious={previous}
        onSelect={setRotation}
      />
      {isEmpty ? <Text style={styles.hint}>{t.rotation.emptySet}</Text> : null}
      <View style={[styles.body, isWide && styles.bodyWide]}>
        <View style={styles.courtCol}>
          <SwipeArea onSwipeLeft={next} onSwipeRight={previous}>
            <View collapsable={false} testID="rotation-swipe-area">
              <RotationCourt slots={slots} playersById={playersById} testID="rotation-court" />
            </View>
          </SwipeArea>
          <Text style={styles.hint}>{t.rotation.swipeHint}</Text>
        </View>
        <View style={isWide ? styles.sideWide : undefined}>
          <SetInfo
            libero={set.liberoId ? playersById.get(set.liberoId) : undefined}
            liberoId={set.liberoId}
            weServeFirst={set.weServeFirst}
            compact={!isWide}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  body: { gap: spacing.lg },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  courtCol: {
    flexShrink: 1,
    flexGrow: 1,
    maxWidth: COURT_MAX_WIDTH,
    width: '100%',
    gap: spacing.sm,
  },
  sideWide: { width: SIDE_PANEL_WIDTH },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
