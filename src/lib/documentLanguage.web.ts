/** Sets `<html lang>` so screen readers and hyphenation use the app's language. */
export function setDocumentLanguage(language: string): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}
