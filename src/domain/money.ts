/**
 * Money helpers. All amounts are integers in minor units (e.g. cents) to avoid
 * floating-point errors. Never store or sum money as JS floats.
 */

export function fractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

export function formatMoney(amountMinor: number, currency: string, locale?: string): string {
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

/**
 * Parse user input like "1,234.56" or "-20" into minor units using string math.
 * Returns null for anything ambiguous; the UI should then show a validation error.
 */
export function parseMoneyInput(input: string, currency: string): number | null {
  const cleaned = input.trim().replace(/[\s,_]/g, '');
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, whole = '0', frac = ''] = match;
  const digits = fractionDigits(currency);
  if (frac.length > digits) return null;
  const minor = Number(whole + frac.padEnd(digits, '0'));
  if (!Number.isSafeInteger(minor)) return null;
  return sign ? -minor : minor;
}

/** Amount with an explicit sign for changes: "+₹42.00", "−₹645.00", "₹0.00". */
export function formatSignedMoney(amountMinor: number, currency: string, locale?: string): string {
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    signDisplay: 'exceptZero',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

/** Magnitude typed by the user, as text for an input ("1234.5" → "1234.50"). */
export function minorToInput(amountMinor: number, currency: string): string {
  const digits = fractionDigits(currency);
  const magnitude = Math.abs(amountMinor);
  const whole = Math.floor(magnitude / 10 ** digits);
  const frac = String(magnitude % 10 ** digits).padStart(digits, '0');
  return digits === 0 ? String(whole) : `${String(whole)}.${frac}`;
}

/** Signed plain number for files (CSV): no symbol or grouping, e.g. "-1234.50". */
export function minorToDecimal(amountMinor: number, currency: string): string {
  const text = minorToInput(amountMinor, currency);
  return amountMinor < 0 ? `-${text}` : text;
}

/**
 * Percentage change relative to the size of the base (so a debt shrinking from −1,000 to −800
 * is +20%). `null` when the base is zero.
 */
export function percentChange(deltaMinor: number, baseMinor: number): number | null {
  if (baseMinor === 0) return null;
  return (deltaMinor / Math.abs(baseMinor)) * 100;
}

export function formatPercent(percent: number, locale?: string): string {
  return (
    new Intl.NumberFormat(locale, {
      signDisplay: 'exceptZero',
      maximumFractionDigits: 1,
    }).format(percent) + '%'
  );
}
