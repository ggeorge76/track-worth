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
