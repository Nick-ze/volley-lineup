import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { TourPage } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { acceptOffer, closeTips } from './tourSession';
import { TourSheet } from './TourSheet';

/**
 * v9.0 quick tour, on a screen outside the quick path: "Quick tip for …?" — Show me opens the
 * tips, No thanks skips them. Either way the page counts as seen.
 */
export function TourOffer({ page }: { page: TourPage }) {
  const styles = useStyles();
  const t = useT();
  const o = t.tour.offer;
  const name = t.tour.pages[page];
  const title = o.title(name);
  return (
    <TourSheet onClose={closeTips} label={title} testID="tour-offer">
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.actions}>
        <Button
          label={o.no}
          accessibilityLabel={o.noLabel(name)}
          variant="secondary"
          compact
          onPress={closeTips}
          testID="tour-offer-no"
        />
        <Button
          label={o.show}
          accessibilityLabel={o.showLabel(name)}
          compact
          onPress={acceptOffer}
          testID="tour-offer-show"
        />
      </View>
    </TourSheet>
  );
}

const useStyles = makeStyles((theme) => ({
  title: { ...typography.subheading, color: theme.colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
}));
