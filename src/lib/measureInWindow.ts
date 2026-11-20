/** A view's rectangle in window coordinates (same space as gesture `absoluteX/Y`). */
export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Measurable {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

/** Promise wrapper around `measureInWindow` (kept here so tests can substitute a layout). */
export function measureInWindow(view: Measurable): Promise<WindowRect> {
  return new Promise((resolve) =>
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })),
  );
}
