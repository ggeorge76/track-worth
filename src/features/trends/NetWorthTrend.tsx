import { useState } from 'react';
import { useToday } from '@/app/useToday';
import { formatIsoDate } from '@/domain/dates';
import { formatMoney, formatPercent, formatSignedMoney } from '@/domain/money';
import type { Converter } from '@/domain/fx';
import { netWorthInBase } from '@/domain/netWorth';
import type { DataFile } from '@/domain/schema';
import { DEFAULT_TREND_RANGE, netWorthTrend, type Trend, type TrendRange } from '@/domain/trend';
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
      ? 'bg-positive-soft text-positive'
      : change.deltaMinor < 0
        ? 'bg-negative-soft text-negative'
        : 'bg-subtle text-ink-muted';
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className={`rounded-full px-2.5 py-0.5 font-semibold tabular-nums ${tone}`}>
        <span aria-hidden="true">
          {change.deltaMinor > 0 ? '▲ ' : change.deltaMinor < 0 ? '▼ ' : ''}
        </span>
        {formatSignedMoney(change.deltaMinor, currency)}
        {change.percent !== null && ` (${formatPercent(change.percent)})`}
      </span>
      <span className="text-ink-muted">{since}</span>
    </p>
  );
}

/**
 * Net worth over time (R-D3), the change over the range (R-D4) and assets/liabilities (R-D2),
 * shown under the headline number, in the base currency (ADR-0018). See domain/trend.ts.
 */
export function NetWorthTrend({ data, fx }: { data: DataFile; fx: Converter }) {
  const today = useToday();
  const [range, setRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);
  const currency = fx.base;
  const trend = netWorthTrend(data, { fx, range, today });
  if (trend.points.length === 0) return null;

  const totals = netWorthInBase(data, fx, today);
  const first = trend.points.find((p) => p.netMinor !== null);
  const last = trend.points.at(-1);
  const summary =
    first && last && first.netMinor !== null && last.netMinor !== null
      ? `Net worth in ${currency}: ${formatMoney(first.netMinor, currency)} on ${formatIsoDate(first.date)}, ${formatMoney(last.netMinor, currency)} on ${formatIsoDate(last.date)}.`
      : `Net worth in ${currency}.`;

  return (
    <div className="mt-2">
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
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-ink-muted">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-positive" />
            Assets
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatMoney(totals.assetsMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-ink-muted">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-negative" />
            Liabilities
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatMoney(totals.liabilitiesMinor, currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
