/**
 * iOS / Android: expo-file-system (SDK 58 `File` / `Paths` API) writes the export into the cache
 * directory and expo-sharing opens the share sheet; expo-document-picker picks a file to import.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { FileTransfer, SaveTextFileOptions } from './fileTransfer';

export const saveTextFile: FileTransfer['saveTextFile'] = async (
  fileName: string,
  text: string,
  options: SaveTextFileOptions = {},
) => {
  const mimeType = options.mimeType ?? 'application/json';
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(text);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI: mimeType === 'application/json' ? 'public.json' : undefined,
    dialogTitle: options.dialogTitle,
  });
};

export const pickTextFile: FileTransfer['pickTextFile'] = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    // Many Android file managers report .json files as text/plain or octet-stream, so accept
    // any file; the import validation rejects anything that is not a Volley Lineup export.
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const text = await new File(asset.uri).text();
  return { name: asset.name, text };
};
