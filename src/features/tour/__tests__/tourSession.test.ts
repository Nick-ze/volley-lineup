import { useAppStore } from '@/store';

import {
  blurTourPage,
  cancelTourChoice,
  closeTips,
  focusTourPage,
  openTourChoice,
  resetTourSession,
  useTourSession,
} from '../tourSession';

const session = () => useTourSession.getState();

beforeEach(() => {
  resetTourSession();
  useAppStore.setState({ tourMode: 'full', tourSeen: [] });
});

describe('two screens with the same page (live Performance view and the performance route)', () => {
  it('a blur of one screen never clears the other one’s focus or popup', () => {
    // The live screen's Performance view opens its tips …
    const live = focusTourPage('performance');
    expect(session().popup).toMatchObject({ page: 'performance', token: live });
    // … then the performance route is pushed on top: it focuses first, the live screen blurs
    // after (the order navigators may use).
    const route = focusTourPage('performance');
    blurTourPage(live);
    // The route keeps its focus, and the tips are now the route's own.
    expect(session().focused).toBe('performance');
    expect(session().focusToken).toBe(route);
    expect(session().popup).toMatchObject({ page: 'performance', token: route });
    // Back: the route blurs, its popup goes; the live screen refocuses.
    blurTourPage(route);
    expect(session().focused).toBeNull();
    expect(session().popup).toBeNull();
  });

  it('a late blur of the old screen keeps the new screen’s popup', () => {
    useAppStore.setState({ tourSeen: [] });
    const first = focusTourPage('performance');
    closeTips(); // seen now
    useAppStore.setState({ tourSeen: [] }); // as if a tour were chosen again
    const second = focusTourPage('performance');
    expect(session().popup).toMatchObject({ token: second });
    blurTourPage(first);
    expect(session().popup).toMatchObject({ token: second });
    expect(session().focusToken).toBe(second);
  });
});

it('cancelling the choice from Profile goes on with the focused page’s tips', () => {
  focusTourPage('profile');
  openTourChoice();
  expect(session().popup).toBeNull();
  cancelTourChoice();
  expect(session().choiceOpen).toBe(false);
  expect(session().popup).toMatchObject({ page: 'profile', kind: 'steps' });
});
