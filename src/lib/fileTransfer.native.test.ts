import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { pickTextFile, saveTextFile } from './fileTransfer.native';

const mockFiles: { uri: string; content?: string; created?: boolean }[] = [];

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    content?: string;
    created?: boolean;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
      mockFiles.push(this);
    }
    create() {
      this.created = true;
    }
    async write(text: string) {
      this.content = text;
    }
    async text() {
      return `text of ${this.uri}`;
    }
  }
  return { File: MockFile, Paths: { cache: { uri: 'file:///cache' } } };
});
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const getDocument = DocumentPicker.getDocumentAsync as jest.Mock;

beforeEach(() => {
  mockFiles.length = 0;
  jest.clearAllMocks();
});

describe('native file transfer', () => {
  it('writes the file to the cache and opens the share sheet', async () => {
    await saveTextFile('export.json', '{"a":1}', { dialogTitle: 'Share' });
    expect(mockFiles[0]).toMatchObject({
      uri: 'file:///cache/export.json',
      created: true,
      content: '{"a":1}',
    });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/export.json', {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Share',
    });
  });

  it('fails when sharing is unavailable', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await expect(saveTextFile('x.txt', 'x', { mimeType: 'text/plain' })).rejects.toThrow();
  });

  it('reads the picked document as text', async () => {
    getDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///picked.json', name: 'picked.json' }],
    });
    await expect(pickTextFile()).resolves.toEqual({
      name: 'picked.json',
      text: 'text of file:///picked.json',
    });
  });

  it('returns null when picking is cancelled', async () => {
    getDocument.mockResolvedValueOnce({ canceled: true, assets: null });
    await expect(pickTextFile()).resolves.toBeNull();
  });
});
