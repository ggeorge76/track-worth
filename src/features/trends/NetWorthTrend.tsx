import { useState } from 'react';
import { useToday } from '@/app/useToday';
import { Segmented } from '@/components/Segmented';
import { formatIsoDate } from '@/domain/dates';
import { formatMoney, formatPercent, formatSignedMoney } from '@/domain/money';
import { netWorthByCurrency } from '@/domain/netWorth';
import type { DataFile } from '@/domain/schema';
import {
  DEFAULT_TREND_RANGE,
  netWorthTrend,
  trendCurrencies,
  type Trend,
  type TrendRange,
} from '@/domain/trend';
import { TrendChart } from './TrendChart';

const PERIOD: Record<TrendRange, string> = {
  '1M': 'in the last month',
  '6M': 'in the last 6 months',
  '1Y': 'in the last year',
  All: '',
};

function ChangeLine({
  trend,
  range,
  currency,
}: {
  trend: Trend;
  range: TrendRange;
  currency: string;
}) {
  const { change } = trend;
  if (!change) return null;
  const since =
    range === 'All' || change.fromDate !== trend.points[0]?.date
      ? `since ${formatIsoDate(change.fromDate)}`
      : PERIOD[range];
  const tone =
    change.deltaMinor > 0
      ? 'text-emerald-700'
      : change.deltaMinor < 0
        ? 'text-rose-700'
        : 'text-slate-500';
  return (
    <p className="mt-1 text-sm">
      <span className={`font-medium tabular-nums ${tone}`}>
        {formatSignedMoney(change.deltaMinor, currency)}
        {change.percent !== null && ` (${formatPercent(change.percent)})`}
      </span>{' '}
      <span className="text-slate-500">{since}</span>
    </p>
  );
}

/**
 * Net worth over time (R-D3), the change over the range (R-D4) and assets/liabilities (R-D2),
 * shown under the headline number. One currency at a time; see domain/trend.ts for the rules.
 */
export function NetWorthTrend({ data }: { data: DataFile }) {
  const today = useToday();
  const currencies = trendCurrencies(data);
  const [range, setRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);
  const [picked, setPicked] = useState<string>();
  const currency = picked && currencies.includes(picked) ? picked : currencies[0];
  if (!currency) return null;

  const trend = netWorthTrend(data, { currency, range, today });
  const totals = netWorthByCurrency(data)[currency];
  const first = trend.points.find((p) => p.netMinor !== null);
  const last = trend.points.at(-1);
  const summary =
    first && last && first.netMinor !== null && last.netMinor !== null
      ? `Net worth in ${currency}: ${formatMoney(first.netMinor, currency)} on ${formatIsoDate(first.date)}, ${formatMoney(last.netMinor, currency)} on ${formatIsoDate(last.date)}.`
      : `Net worth in ${currency}.`;

  return (
    <div className="mt-2">
      {currencies.length > 1 && (
        <div className="mb-2 max-w-xs">
          <Segmented
            label="Chart currency"
            value={currency}
            options={currencies.map((c) => ({ value: c, label: c }))}
            onChange={setPicked}
          />
        </div>
      )}
      <ChangeLine trend={trend} range={range} currency={currency} />
      <TrendChart
        points={trend.points.map((p) => ({
          date: p.date,
          valueMinor: p.netMinor,
          imported: p.imported ?? false,
        }))}
        currency={currency}
        range={range}
        onRangeChange={setRange}
        financialYearStart={trend.financialYearStart}
        summary={summary}
        valueLabel="Net worth"
      />
      {totals && (
        <p className="mt-3 text-sm text-slate-600">
          Assets <span className="tabular-nums">{formatMoney(totals.assetsMinor, currency)}</span>
          {' · '}Liabilities{' '}
          <span className="tabular-nums">{formatMoney(totals.liabilitiesMinor, currency)}</span>
        </p>
      )}
    </div>
  );
}
