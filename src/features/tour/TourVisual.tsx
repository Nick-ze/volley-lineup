import { View } from 'react-native';

import type { TourVisualSpec } from './steps';
import { CourtVisual, DragVisual, ScoreVisual, StatsVisual } from './TourCourtVisuals';
import {
  ChipsVisual,
  FormVisual,
  RowVisual,
  SwipeVisual,
  TapVisual,
  ToggleVisual,
} from './TourVisualParts';
import { useVisualStyles } from './visualStyles';

function Drawing({ spec }: { spec: TourVisualSpec }) {
  switch (spec.kind) {
    case 'tap':
      return <TapVisual label={spec.label} />;
    case 'row':
      return <RowVisual label={spec.label} />;
    case 'form':
      return <FormVisual field={spec.field} value={spec.value} button={spec.button} />;
    case 'toggle':
      return <ToggleVisual label={spec.label} />;
    case 'chips':
      return <ChipsVisual items={spec.items} />;
    case 'swipe':
      return <SwipeVisual tabs={spec.tabs} />;
    case 'drag':
      return <DragVisual />;
    case 'court':
      return <CourtVisual />;
    case 'score':
      return <ScoreVisual us={spec.us} them={spec.them} />;
    case 'stats':
      return <StatsVisual />;
  }
}

/**
 * v9.0: the small visual guide above a tip — a static miniature of the control the tip talks
 * about (no animation, so nothing to reduce). Decorative: the tip's text says it all.
 */
export function TourVisual({ spec }: { spec: TourVisualSpec }) {
  const styles = useVisualStyles();
  return (
    <View
      style={styles.frame}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      testID={`tour-visual-${spec.kind}`}
    >
      <Drawing spec={spec} />
    </View>
  );
}
