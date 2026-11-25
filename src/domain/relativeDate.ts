/** "Updated 8 days ago" style text for a `YYYY-MM-DD` date, relative to `today`. */

const DAY_MS = 86_400_000;

function toUtcDay(isoDate: string): number {
  return Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDay(to) - toUtcDay(from)) / DAY_MS);
}

export function describeDateAgo(isoDate: string, today: string, locale?: string): string {
  const days = daysBetween(isoDate, today);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (days < 0) return rtf.format(-days, 'day'); // future-dated entry: "in 2 days"
  if (days < 30) return rtf.format(-days, 'day');
  if (days < 365) return rtf.format(-Math.round(days / 30), 'month');
  return rtf.format(-Math.round(days / 365), 'year');
}
