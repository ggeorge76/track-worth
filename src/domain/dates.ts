/**
 * Calendar-date helpers. Balance dates are plain `YYYY-MM-DD` strings in the user's local
 * calendar (no time zone), so they compare correctly as strings.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in the user's local time zone, as `YYYY-MM-DD`. */
export function localIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** First day of the month containing `isoDate`. */
export function startOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/**
 * First day of the financial year containing `isoDate`, for a financial year that starts on the
 * 1st of `startMonth` (1–12). E.g. April start: 2026-02-10 → 2025-04-01, 2026-05-01 → 2026-04-01.
 */
export function financialYearStart(isoDate: string, startMonth: number): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return `${String(month >= startMonth ? year : year - 1)}-${pad(startMonth)}-01`;
}
