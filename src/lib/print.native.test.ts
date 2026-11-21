import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { A4_POINTS, PDF_MARGINS, printHtml } from './print.native';

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() =>
    Promise.resolve({ uri: 'file:///cache/Print/abc.pdf', numberOfPages: 1 }),
  ),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => jest.clearAllMocks());

describe('native printHtml', () => {
  it('renders an A4 PDF and opens the share sheet for it', async () => {
    await printHtml('<p>sheet</p>', { dialogTitle: 'Share sheet' });
    expect(Print.printToFileAsync).toHaveBeenCalledWith({
      html: '<p>sheet</p>',
      width: 595,
      height: 842,
      margins: { top: 34, right: 34, bottom: 34, left: 34 },
    });
    expect(PDF_MARGINS.left).toBe(34);
    expect(A4_POINTS).toEqual({ width: 595, height: 842 });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/Print/abc.pdf', {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share sheet',
    });
  });

  it('fails when sharing is unavailable', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await expect(printHtml('<p/>')).rejects.toThrow('Sharing is not available');
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('passes PDF errors on', async () => {
    (Print.printToFileAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(printHtml('<p/>')).rejects.toThrow('boom');
  });
});
