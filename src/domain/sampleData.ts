import { addMonths, endOfMonth } from './dates';
import { dataFileSchema, type Account, type BalanceEntry, type DataFile } from './schema';

/**
 * Made-up data for store screenshots and demos (development builds only): nine accounts in INR
 * and USD with three years of monthly balances. Deterministic, so screenshots are repeatable.
 * Never real figures.
 */

interface SampleAccount {
  id: string;
  name: string;
  kind: Account['kind'];
  tag: string;
  liquidity: number;
  currency: string;
  balanceSource?: string;
  /** Balance 36 months ago and today, in major units (liabilities negative). */
  from: number;
  to: number;
  /** Month-to-month wobble as a fraction of the balance. */
  wobble: number;
}

const ACCOUNTS: SampleAccount[] = [
  {
    id: 'sample-savings',
    name: '🏦 Savings Account',
    kind: 'asset',
    tag: 'Cash',
    liquidity: 5,
    currency: 'INR',
    balanceSource: 'Bank app',
    from: 240_000,
    to: 385_000,
    wobble: 0.08,
  },
  {
    id: 'sample-salary',
    name: '💼 Salary Account',
    kind: 'asset',
    tag: 'Cash',
    liquidity: 5,
    currency: 'INR',
    balanceSource: 'Bank app',
    from: 90_000,
    to: 125_000,
    wobble: 0.2,
  },
  {
    id: 'sample-index',
    name: '📈 Index Fund',
    kind: 'asset',
    tag: 'Equity',
    liquidity: 4,
    currency: 'INR',
    balanceSource: 'Fund app',
    from: 650_000,
    to: 1_420_000,
    wobble: 0.05,
  },
  {
    id: 'sample-ppf',
    name: '🏛️ Public Provident Fund',
    kind: 'asset',
    tag: 'Fixed Income',
    liquidity: 1,
    currency: 'INR',
    from: 520_000,
    to: 880_000,
    wobble: 0,
  },
  {
    id: 'sample-fd',
    name: '🧾 Fixed Deposit',
    kind: 'asset',
    tag: 'Fixed Income',
    liquidity: 2,
    currency: 'INR',
    balanceSource: 'Bank app',
    from: 500_000,
    to: 540_000,
    wobble: 0,
  },
  {
    id: 'sample-gold',
    name: '🪙 Gold',
    kind: 'asset',
    tag: 'Gold',
    liquidity: 3,
    currency: 'INR',
    from: 180_000,
    to: 310_000,
    wobble: 0.03,
  },
  {
    id: 'sample-us',
    name: '🇺🇸 US Brokerage',
    kind: 'asset',
    tag: 'Equity',
    liquidity: 4,
    currency: 'USD',
    from: 7_500,
    to: 12_400,
    wobble: 0.05,
  },
  {
    id: 'sample-home',
    name: '🏠 Home Loan',
    kind: 'liability',
    tag: 'Loan',
    liquidity: 1,
    currency: 'INR',
    from: -3_600_000,
    to: -2_850_000,
    wobble: 0,
  },
  {
    id: 'sample-card',
    name: '💳 Credit Card',
    kind: 'liability',
    tag: 'Credit Card',
    liquidity: 4,
    currency: 'INR',
    balanceSource: 'Bank app',
    from: -18_000,
    to: -24_500,
    wobble: 0.45,
  },
];

const MONTHS = 36;

/** Small deterministic pseudo-random sequence in [-1, 1). */
function wobbles(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 1_073_741_824 - 1;
  };
}

function round2(n: number) {
  return Math.round(n * 100);
}

/**
 * The sample data, dated relative to `today` (YYYY-MM-DD): one balance at each of the last 36
 * month ends, and today's. Keeps the file's base currency choice out: INR base, April year.
 */
export function sampleDataFile(today: string, current: DataFile): DataFile {
  const createdAt = `${addMonths(today, -MONTHS)}T09:00:00.000Z`;
  const accounts: Account[] = ACCOUNTS.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    tag: a.tag,
    liquidity: a.liquidity,
    currency: a.currency,
    ...(a.balanceSource ? { balanceSource: a.balanceSource } : {}),
    archived: false,
    createdAt,
  }));

  const dates = [
    ...Array.from({ length: MONTHS }, (_, i) => endOfMonth(addMonths(today, i - MONTHS))),
    today,
  ].filter((d, i, all) => all.indexOf(d) === i);

  const balances: BalanceEntry[] = [];
  ACCOUNTS.forEach((a, n) => {
    const next = wobbles(n + 7);
    dates.forEach((date, i) => {
      const t = i / (dates.length - 1);
      const trend = a.from + (a.to - a.from) * t;
      const amount = i === dates.length - 1 ? a.to : trend * (1 + a.wobble * next());
      balances.push({
        id: `${a.id}-${date}`,
        accountId: a.id,
        date,
        amountMinor: round2(amount),
        recordedAt: `${date}T18:00:00.000Z`,
      });
    });
  });

  return dataFileSchema.parse({
    ...current,
    baseCurrency: 'INR',
    settings: { financialYearStartMonth: 4, customTags: ['Gold', 'Loan', 'Credit Card'] },
    accounts,
    balances,
    netWorthHistory: [],
  });
}
