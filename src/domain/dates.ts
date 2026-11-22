/**
 * v8: Swiss date format (docs/PLAN.md §31.1). Dates are stored, exported and sorted as ISO
 * `YYYY-MM-DD`; the app shows them as `dd.mm.yy` (EN and DE) and date fields accept
 * `d.m.yy`, `dd.mm.yyyy` and ISO. Two-digit years mean 20yy. Pure functions, no React.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** True when year / month / day form a real calendar date (no 31.02.). */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const SWISS = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/;

/**
 * `2026-11-22` → `22.11.26`. A value that isn't an ISO date (or the start of an ISO timestamp)
 * is returned unchanged, so a bad stored value is still visible.
 */
export function formatDate(iso: string): string {
  const match = ISO.exec(iso.slice(0, 10));
  if (!match) return iso;
  const [, year, month, day] = match as unknown as [string, string, string, string];
  return `${day}.${month}.${year.slice(2)}`;
}

/** `formatDate` for an optional value: `''` when there is none. */
export function formatOptionalDate(iso: string | undefined): string {
  return iso === undefined || iso === '' ? '' : formatDate(iso);
}

/**
 * A typed date as ISO `YYYY-MM-DD`, or `null` when it isn't a real date. Accepts
 * `d.m.yy` / `dd.mm.yy` (20yy), `d.m.yyyy` / `dd.mm.yyyy` and `YYYY-MM-DD`; spaces around it
 * are ignored.
 */
export function parseDateInput(text: string): string | null {
  const value = text.trim();
  const iso = ISO.exec(value);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(year, month, day) ? value : null;
  }
  const swiss = SWISS.exec(value);
  if (!swiss) return null;
  const day = Number(swiss[1]);
  const month = Number(swiss[2]);
  const yearText = swiss[3] as string;
  const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
  if (!isRealDate(year, month, day)) return null;
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** The local calendar day of `now` as ISO `YYYY-MM-DD`. */
export function todayIso(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** The value a date field starts with: today as `dd.mm.yy`. */
export function todayInput(now: Date): string {
  return formatDate(todayIso(now));
}
