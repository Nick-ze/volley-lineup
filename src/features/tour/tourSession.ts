/**
 * v9.0: the tour's screen state (not persisted): which page is focused, the open popup and
 * whether the tour choice was opened from Profile. The persisted part (chosen tour, seen pages)
 * is in the app store; `tourAction` (domain) decides what a page does.
 */
import { create } from 'zustand';

import { tourAction } from '@/domain/tour';
import type { TourMode, TourPage } from '@/domain/types';
import { useAppStore } from '@/store';

export interface TourPopup {
  page: TourPage;
  /** The page's tips, or the quick tour's "Quick tip for …?" offer. */
  kind: 'steps' | 'offer';
  /** The shown tip (0-based) while `kind` is 'steps'. */
  step: number;
}

interface TourSessionState {
  /** The page of the focused screen and its shown tab (null: none with tips). */
  focused: TourPage | null;
  popup: TourPopup | null;
  /** The tour choice opened from Profile (it also shows while no tour was chosen yet). */
  choiceOpen: boolean;
}

const initial = (): TourSessionState => ({ focused: null, popup: null, choiceOpen: false });

export const useTourSession = create<TourSessionState>()(initial);

/** Tests: back to a fresh app start. */
export const resetTourSession = () => useTourSession.setState(initial());

/** Opens the focused page's tips (or offer) when they are due and nothing else is open. */
export function openTipsIfDue(): void {
  const { focused, popup, choiceOpen } = useTourSession.getState();
  if (popup || choiceOpen || focused === null) return;
  const { tourMode, tourSeen } = useAppStore.getState();
  const action = tourAction(tourMode, tourSeen, focused);
  if (action !== 'none')
    useTourSession.setState({ popup: { page: focused, kind: action, step: 0 } });
}

/** A screen (or its shown tab) with tips got focus. */
export function focusTourPage(page: TourPage): void {
  useTourSession.setState({ focused: page });
  openTipsIfDue();
}

/** That screen lost focus (another screen on top, back, another tab): its popup goes too. */
export function blurTourPage(page: TourPage): void {
  const { focused, popup } = useTourSession.getState();
  useTourSession.setState({
    focused: focused === page ? null : focused,
    popup: popup?.page === page ? null : popup,
  });
}

/** Shows another tip of the open popup. */
export function showTourStep(step: number): void {
  const { popup } = useTourSession.getState();
  if (popup) useTourSession.setState({ popup: { ...popup, step } });
}

/** Closes the popup; its page counts as seen (finished, closed or declined). */
export function closeTips(): void {
  const { popup } = useTourSession.getState();
  if (!popup) return;
  useAppStore.getState().markTourSeen(popup.page);
  useTourSession.setState({ popup: null });
}

/** The offer's "Show me": the page counts as seen, its tips open. */
export function acceptOffer(): void {
  const { popup } = useTourSession.getState();
  if (!popup) return;
  useAppStore.getState().markTourSeen(popup.page);
  useTourSession.setState({ popup: { page: popup.page, kind: 'steps', step: 0 } });
}

/** "End tour": no more tips anywhere (a tour can be chosen again in Profile). */
export function endTour(): void {
  useAppStore.getState().setTourMode('none');
  useTourSession.setState({ popup: null });
}

/** Profile's "Choose again". */
export function openTourChoice(): void {
  useTourSession.setState({ choiceOpen: true, popup: null });
}

/** Cancel in the choice opened from Profile: everything stays as it was. */
export function cancelTourChoice(): void {
  useTourSession.setState({ choiceOpen: false });
}

/** A tour was chosen: it starts over, with the focused page's tips right away. */
export function chooseTour(mode: TourMode): void {
  useAppStore.getState().setTourMode(mode);
  useTourSession.setState({ choiceOpen: false, popup: null });
  openTipsIfDue();
}
