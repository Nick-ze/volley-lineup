/**
 * Web: loads the HTML into a hidden iframe and opens the browser print dialog for it, so the app
 * page itself is never printed. "Save as PDF" in that dialog gives a PDF.
 */
import type { PrintHtml } from './print';

/** Removes the iframe if `afterprint` never fires (some browsers don't send it for iframes). */
export const PRINT_CLEANUP_MS = 60_000;

export const printHtml: PrintHtml = (html, options = {}) =>
  new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('data-testid', 'print-frame');
    frame.tabIndex = -1;
    // Off-screen but laid out (display:none would make some browsers print a blank page).
    Object.assign(frame.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden',
    });

    const appTitle = document.title;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      document.title = appTitle;
      frame.remove();
    };

    frame.addEventListener(
      'load',
      () => {
        const win = frame.contentWindow;
        if (!win) {
          cleanup();
          reject(new Error('Could not open the print view.'));
          return;
        }
        try {
          if (options.title) document.title = options.title;
          win.addEventListener('afterprint', cleanup);
          timer = setTimeout(cleanup, PRINT_CLEANUP_MS);
          win.focus();
          win.print();
          resolve();
        } catch (error) {
          cleanup();
          reject(error);
        }
      },
      { once: true },
    );

    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
