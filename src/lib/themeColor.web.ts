/**
 * v8 QA: sets `<meta name="theme-color">` (the browser / PWA bar colour) to the theme's
 * background, so it follows light / dark instead of staying at the dark colour from app.json.
 */
export function setThemeColor(color: string): void {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}
