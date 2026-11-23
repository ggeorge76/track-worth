import { useState } from 'react';
import { formatIsoDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { Account, BalanceEntry } from '@/domain/schema';
import { accountTrend, DEFAULT_TREND_RANGE, type TrendRange } from '@/domain/trend';
import { TrendChart } from '@/features/trends/TrendChart';

/**
 * Balance over time for one account (R-B4). Dots are the balances entered; the line holds each
 * one until the next. Liabilities are shown as the amount owed, so paying down reads as a fall.
 */
export function BalanceChart({
  account,
  entries,
  today,
  financialYearStartMonth,
}: {
  account: Account;
  entries: readonly BalanceEntry[];
  today: string;
  financialYearStartMonth: number;
}) {
  const [range, setRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);
  const trend = accountTrend(entries, {
    kind: account.kind,
    range,
    today,
    financialYearStartMonth,
  });
  if (trend.points.length === 0) return null;

  const label = account.kind === 'liability' ? 'Amount owed' : 'Balance';
  const shown = trend.points.filter((p) => p.valueMinor !== null);
  const first = shown[0];
  const last = shown.at(-1);
  const describe = (p: { date: string; valueMinor: number | null }) =>
    `${formatMoney(p.valueMinor ?? 0, account.currency)} on ${formatIsoDate(p.date)}`;
  const summary =
    first && last && first !== last
      ? `${label} over time: ${describe(first)}, ${describe(last)}.`
      : `${label} over time.`;

  return (
    <section aria-label={`${label} over time`} className="mt-6">
      <h2 className="text-sm text-slate-500">{label} over time</h2>
      <TrendChart
        points={trend.points}
        currency={account.currency}
        range={range}
        onRangeChange={setRange}
        financialYearStart={trend.financialYearStart}
        summary={summary}
        valueLabel={label}
        step
      />
    </section>
  );
}
