/** Web: Blob + `<a download>` to save, a hidden `<input type="file">` to pick. */
import type { FileTransfer, PickedTextFile, SaveTextFileOptions } from './fileTransfer';

export const saveTextFile: FileTransfer['saveTextFile'] = async (
  fileName: string,
  text: string,
  options: SaveTextFileOptions = {},
) => {
  const blob = new Blob([text], { type: options.mimeType ?? 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const pickTextFile: FileTransfer['pickTextFile'] = () =>
  new Promise<PickedTextFile | null>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.setAttribute('data-testid', 'import-file-input');
    const cleanup = () => input.remove();

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    });
    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
