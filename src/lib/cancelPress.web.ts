/**
 * Cancels the press a drag started on (v8.1): with a mouse, a card under the pointer would
 * otherwise open on release after the tab pager moved. react-native-web fires `onPress` on the
 * browser's `click`, so the click that follows this drag is swallowed; a `dragstart` (its "mouse
 * cancel" event) ends the card's pressed look at once.
 */
export function cancelPress(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const swallow = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  // The click (if any) comes right after the release; stop waiting for one after that.
  const stop = () => setTimeout(() => window.removeEventListener('click', swallow, true), 0);
  window.addEventListener('pointerup', stop, { capture: true, once: true });
  document.body.dispatchEvent(new Event('dragstart', { bubbles: true }));
}
