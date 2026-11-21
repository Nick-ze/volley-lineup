/**
 * iOS / Android: expo-print (SDK 58 `printToFileAsync`) renders the HTML to an A4 PDF in the cache
 * directory, then expo-sharing opens the share sheet (print, save to Files, send, ...).
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { PrintHtml } from './print';

/** A4 in PostScript points (1/72 inch); expo-print defaults to US Letter. */
export const A4_POINTS = { width: 595, height: 842 } as const;

export const printHtml: PrintHtml = async (html, options = {}) => {
  const { uri } = await Print.printToFileAsync({ html, ...A4_POINTS });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: options.dialogTitle,
  });
};
