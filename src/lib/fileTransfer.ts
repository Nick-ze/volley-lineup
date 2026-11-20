/**
 * Saving and picking text files, per platform.
 *
 * Metro picks `fileTransfer.web.ts` on web and `fileTransfer.native.ts` on iOS/Android; this
 * file only defines the shared contract (TypeScript resolves imports here) and a fallback that
 * should never run. Keep every platform difference inside these three files.
 */

export interface SaveTextFileOptions {
  /** MIME type of the file (default `application/json`). */
  mimeType?: string;
  /** Title of the native share sheet (Android). */
  dialogTitle?: string;
}

export interface PickedTextFile {
  name: string;
  text: string;
}

export interface FileTransfer {
  /** Web: downloads the file. Phone: writes it to the cache and opens the share sheet. */
  saveTextFile(fileName: string, text: string, options?: SaveTextFileOptions): Promise<void>;
  /** Lets the user pick a file and returns its text, or `null` if they cancelled. */
  pickTextFile(): Promise<PickedTextFile | null>;
}

const unsupported = (): Promise<never> =>
  Promise.reject(new Error('File transfer is not supported on this platform.'));

export const saveTextFile: FileTransfer['saveTextFile'] = unsupported;
export const pickTextFile: FileTransfer['pickTextFile'] = unsupported;
