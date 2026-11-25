/** Currencies offered when creating or editing an account. */

/** Shown first, in this order. */
export const COMMON_CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
  'AUD',
  'CAD',
  'JPY',
  'CHF',
];

/** Used if the runtime can't list currencies (older webviews). */
const FALLBACK = [
  ...COMMON_CURRENCIES,
  'CNY',
  'HKD',
  'NZD',
  'SAR',
  'SEK',
  'NOK',
  'DKK',
  'ZAR',
  'BRL',
  'MXN',
  'KRW',
  'THB',
  'MYR',
  'IDR',
  'PHP',
  'QAR',
  'KWD',
  'BHD',
  'OMR',
  'LKR',
  'NPR',
  'BDT',
  'PKR',
];

export function currencyCodes(): string[] {
  let all: string[];
  try {
    all = Intl.supportedValuesOf('currency');
  } catch {
    all = FALLBACK;
  }
  const rest = all.filter((c) => !COMMON_CURRENCIES.includes(c)).sort();
  return [...COMMON_CURRENCIES, ...rest];
}

/** "INR · Indian Rupee" */
export function currencyLabel(code: string, locale?: string): string {
  try {
    const name = new Intl.DisplayNames(locale, { type: 'currency' }).of(code);
    return name && name !== code ? `${code} · ${name}` : code;
  } catch {
    return code;
  }
}

/** Default currency for a new account: the one most used so far, else the file's base currency. */
export function suggestedCurrency(
  accountCurrencies: readonly string[],
  baseCurrency: string,
): string {
  const counts = new Map<string, number>();
  for (const c of accountCurrencies) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best = baseCurrency;
  let bestCount = 0;
  for (const [c, n] of counts) {
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}
