import { useAppStore } from '@/store';

import { TourChoiceDialog } from './TourChoiceDialog';
import { TourOffer } from './TourOffer';
import { TourStepPopup } from './TourStepPopup';
import { useTourSession } from './tourSession';

/**
 * v9.0: the tour's popups, rendered once in the root layout (inside the theme): the tour choice
 * (first start, or from Profile), a page's tips, or the quick tour's offer. Screens only say
 * which page they are (`useTourPage`).
 */
export function TourHost() {
  const hydrated = useAppStore((s) => s.hydrated);
  const tourMode = useAppStore((s) => s.tourMode);
  const choiceOpen = useTourSession((s) => s.choiceOpen);
  const popup = useTourSession((s) => s.popup);

  if (!hydrated) return null;
  if (tourMode === null || choiceOpen) return <TourChoiceDialog current={tourMode} />;
  if (!popup) return null;
  return popup.kind === 'offer' ? (
    <TourOffer page={popup.page} />
  ) : (
    <TourStepPopup page={popup.page} step={popup.step} />
  );
}
