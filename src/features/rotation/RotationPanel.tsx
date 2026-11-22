import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { activeLiberoReplaces, findLiberoSwap } from '@/domain/liberoSwap';
import { formationLabels, stepSpotRoles } from '@/domain/formationSteps';
import {
  getRotation,
  nextRotation,
  previousRotation,
  type RotationNumber,
} from '@/domain/rotation';
import type { Player, SetLineup } from '@/domain/types';
import { useT } from '@/i18n';
import { useIsWide } from '@/lib/useIsWide';
import { makeStyles, spacing, typography } from '@/theme';

import { COURT_MAX_WIDTH, SIDE_PANEL_WIDTH } from './layout';
import { LiberoSwapControl } from './LiberoSwapControl';
import { RotationCourt } from './RotationCourt';
import { RotationStepper } from './RotationStepper';
import { SetInfo } from './SetInfo';
import { SwipeArea } from './SwipeArea';

export interface RotationPanelProps {
  set: SetLineup;
  playersById: Map<string, Player>;
}

/**
 * Court + stepper for one set. Rotations are named after the setter spot (v6); remount
 * (key by set number) to start again at the starting six.
 */
export function RotationPanel({ set, playersById }: RotationPanelProps) {
  const styles = useStyles();
  const t = useT();
  const isWide = useIsWide();
  const [step, setStep] = useState<RotationNumber>(1);
  const [showSwaps, setShowSwaps] = useState(true);
  // v6: the formation turns with the players, so every spot (also an empty one) has a role and
  // the rotations are named after the setter spot.
  const roles = useMemo(() => stepSpotRoles(set.formation, step), [set.formation, step]);
  const labels = useMemo(() => formationLabels(set.formation), [set.formation]);
  const base = useMemo(() => getRotation(set.slots, step), [set.slots, step]);
  // The rotation viewer treats position 1 as serving, so the libero never stands there.
  const swap = showSwaps ? findLiberoSwap(base, set.liberoId, activeLiberoReplaces(set)) : null;
  const liberoId = set.liberoId;
  const slots = swap && liberoId ? { ...base, [swap.position]: liberoId } : base;
  const isEmpty = Object.values(set.slots).every((id) => id === null);
  const next = () => setStep(nextRotation);
  const previous = () => setStep(previousRotation);

  return (
    <View style={styles.wrap}>
      <RotationStepper
        step={step}
        labels={labels}
        onNext={next}
        onPrevious={previous}
        onSelect={setStep}
      />
      {isEmpty ? <Text style={styles.hint}>{t.rotation.emptySet}</Text> : null}
      <View style={[styles.body, isWide && styles.bodyWide]}>
        <View style={styles.courtCol}>
          <SwipeArea onSwipeLeft={next} onSwipeRight={previous}>
            <View collapsable={false} testID="rotation-swipe-area">
              <RotationCourt
                slots={slots}
                playersById={playersById}
                spotRoles={roles}
                liberoSwap={swap}
                testID="rotation-court"
              />
            </View>
          </SwipeArea>
          <Text style={styles.hint}>{t.rotation.swipeHint}</Text>
          <LiberoSwapControl set={set} showSwaps={showSwaps} onChange={setShowSwaps} />
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

const useStyles = makeStyles((theme) => ({
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
  hint: { ...typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
}));
