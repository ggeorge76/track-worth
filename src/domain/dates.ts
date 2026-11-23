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

/** "9 Nov 2026" (locale-dependent) for a `YYYY-MM-DD` date. */
export function formatIsoDate(isoDate: string, locale?: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

/** Month names, index 0 = January. */
export function monthNames(locale?: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2026, i, 1))));
}

/** Last day of the financial year that starts on `start` (YYYY-MM-01). */
export function financialYearEnd(start: string): string {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  const end = new Date(Date.UTC(y + 1, m - 1, 0)); // day 0 = last day of the previous month
  return end.toISOString().slice(0, 10);
}

function toUtc(isoDate: string): Date {
  return new Date(
    Date.UTC(
      Number(isoDate.slice(0, 4)),
      Number(isoDate.slice(5, 7)) - 1,
      Number(isoDate.slice(8, 10)),
    ),
  );
}

/** Milliseconds since the epoch at UTC midnight of `isoDate` (for chart axes). */
export function isoDateToUtcMs(isoDate: string): number {
  return toUtc(isoDate).getTime();
}

/** Same day `months` later (may be negative), clamped to the month's last day (31 Mar − 1 → 28 Feb). */
export function addMonths(isoDate: string, months: number): string {
  const total = Number(isoDate.slice(0, 4)) * 12 + Number(isoDate.slice(5, 7)) - 1 + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Number(isoDate.slice(8, 10)), lastDay);
  return `${String(y)}-${pad(m)}-${pad(day)}`;
}

/** Last day of the month containing `isoDate`. */
export function endOfMonth(isoDate: string): string {
  return addDays(addMonths(startOfMonth(isoDate), 1), -1);
}

/** `isoDate` plus `days` (may be negative). */
export function addDays(isoDate: string, days: number): string {
  const d = toUtc(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Same day `years` later (29 Feb maps to 28 Feb in non-leap years). */
export function addYears(isoDate: string, years: number): string {
  const y = Number(isoDate.slice(0, 4)) + years;
  const m = Number(isoDate.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Number(isoDate.slice(8, 10)), lastDay);
  return `${String(y)}-${isoDate.slice(5, 7)}-${String(day).padStart(2, '0')}`;
}
