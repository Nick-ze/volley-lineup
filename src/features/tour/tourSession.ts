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
  /** The focus token of the screen it belongs to (see `focusTourPage`). */
  token: number;
}

interface TourSessionState {
  /** The page of the focused screen and its shown tab (null: none with tips). */
  focused: TourPage | null;
  /**
   * Which screen focused it: two screens can share a page (the live screen's Performance view and
   * the performance route), so a blur only clears what its own screen set.
   */
  focusToken: number;
  popup: TourPopup | null;
  /** The tour choice opened from Profile (it also shows while no tour was chosen yet). */
  choiceOpen: boolean;
}

const initial = (): TourSessionState => ({
  focused: null,
  focusToken: 0,
  popup: null,
  choiceOpen: false,
});

let lastToken = 0;

export const useTourSession = create<TourSessionState>()(initial);

/** Tests: back to a fresh app start. */
export const resetTourSession = () => useTourSession.setState(initial());

/** Opens the focused page's tips (or offer) when they are due and nothing else is open. */
export function openTipsIfDue(): void {
  const { focused, focusToken, popup, choiceOpen } = useTourSession.getState();
  if (popup || choiceOpen || focused === null) return;
  const { tourMode, tourSeen } = useAppStore.getState();
  const action = tourAction(tourMode, tourSeen, focused);
  if (action !== 'none')
    useTourSession.setState({
      popup: { page: focused, kind: action, step: 0, token: focusToken },
    });
}

/**
 * A screen (or its shown tab) with tips got focus. Returns the screen's focus token, which its
 * blur passes back.
 */
export function focusTourPage(page: TourPage): number {
  lastToken += 1;
  useTourSession.setState({ focused: page, focusToken: lastToken });
  openTipsIfDue();
  return lastToken;
}

/**
 * The screen with focus token `token` lost focus (another screen on top, back, another tab): it
 * is no longer the focused one, and its popup goes too. Another screen's focus or popup stays
 * (also with the same page), and if that screen's tips are due now, they open.
 */
export function blurTourPage(token: number): void {
  const { focusToken, focused, popup } = useTourSession.getState();
  const own = focusToken === token;
  useTourSession.setState({
    focused: own ? null : focused,
    popup: popup?.token === token ? null : popup,
  });
  openTipsIfDue();
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
  useTourSession.setState({ popup: { ...popup, kind: 'steps', step: 0 } });
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

/** Cancel in the choice opened from Profile: the tour stays as it was (and goes on). */
export function cancelTourChoice(): void {
  useTourSession.setState({ choiceOpen: false });
  openTipsIfDue();
}

/** A tour was chosen: it starts over, with the focused page's tips right away. */
export function chooseTour(mode: TourMode): void {
  useAppStore.getState().setTourMode(mode);
  useTourSession.setState({ choiceOpen: false, popup: null });
  openTipsIfDue();
}
