/**
 * Printing an HTML document, per platform.
 *
 * Metro picks `print.web.ts` on web (hidden iframe + browser print dialog, where "Save as PDF" is
 * available) and `print.native.ts` on iOS/Android (expo-print renders a PDF, expo-sharing opens
 * the share sheet). This file defines the shared contract and a fallback that should never run.
 */

export interface PrintHtmlOptions {
  /** Web: used as the page title while printing (browsers use it as the default PDF name). */
  title?: string;
  /** Phone: title of the share sheet (Android). */
  dialogTitle?: string;
}

export type PrintHtml = (html: string, options?: PrintHtmlOptions) => Promise<void>;

export const printHtml: PrintHtml = () =>
  Promise.reject(new Error('Printing is not supported on this platform.'));
