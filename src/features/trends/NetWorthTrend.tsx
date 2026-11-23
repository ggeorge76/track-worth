import { useState } from 'react';
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useToday } from '@/app/useToday';
import { Segmented } from '@/components/Segmented';
import { formatIsoDate, isoDateToUtcMs } from '@/domain/dates';
import { formatMoney, formatPercent, formatSignedMoney, fractionDigits } from '@/domain/money';
import { netWorthByCurrency } from '@/domain/netWorth';
import type { DataFile } from '@/domain/schema';
import {
  DEFAULT_TREND_RANGE,
  netWorthTrend,
  TREND_RANGES,
  trendCurrencies,
  type Trend,
  type TrendRange,
} from '@/domain/trend';

const PERIOD: Record<TrendRange, string> = {
  '1M': 'in the last month',
  '6M': 'in the last 6 months',
  '1Y': 'in the last year',
  All: '',
};

/** "$1.2M" style labels for the axis. Display only: amounts stay integer minor units. */
function compactMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amountMinor / 10 ** fractionDigits(currency));
}

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
const yearFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', timeZone: 'UTC' });

/** At most ~5 ticks on month starts (or year starts for All), so labels never crowd. */
function axisTicks(trend: Trend, range: TrendRange): number[] {
  const first = trend.points[0]?.date;
  const last = trend.points.at(-1)?.date;
  if (!first || !last) return [];
  const candidates: number[] = [];
  const [y0, m0] = [Number(first.slice(0, 4)), Number(first.slice(5, 7))];
  const [y1, m1] = [Number(last.slice(0, 4)), Number(last.slice(5, 7))];
  for (let i = y0 * 12 + m0; i <= y1 * 12 + m1; i++) {
    const [y, m] = [Math.floor((i - 1) / 12), ((i - 1) % 12) + 1];
    if (range === 'All' && m !== 1) continue;
    const ms = Date.UTC(y, m - 1, 1);
    if (ms >= isoDateToUtcMs(first) && ms <= isoDateToUtcMs(last)) candidates.push(ms);
  }
  const step = Math.max(1, Math.ceil(candidates.length / 5));
  return candidates.filter((_, i) => i % step === 0);
}

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
  const chartData = trend.points.map((p) => ({ x: isoDateToUtcMs(p.date), y: p.netMinor }));
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
      <div role="img" aria-label={summary} className="mt-3 h-32 w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 320, height: 128 }}
        >
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={axisTicks(trend, range)}
              tickFormatter={(ms: number) =>
                (range === 'All' ? yearFormat : monthFormat).format(new Date(ms))
              }
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              orientation="right"
              width={52}
              tickCount={3}
              tickFormatter={(v: number) => compactMoney(v, currency)}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              labelFormatter={(ms) =>
                typeof ms === 'number' ? formatIsoDate(new Date(ms).toISOString().slice(0, 10)) : ''
              }
              formatter={(v) => [
                typeof v === 'number' ? formatMoney(v, currency) : '—',
                'Net worth',
              ]}
            />
            {trend.financialYearStart && (
              <ReferenceLine
                x={isoDateToUtcMs(trend.financialYearStart)}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                label={{ value: 'FY', position: 'insideTopLeft', fontSize: 11, fill: '#64748b' }}
              />
            )}
            <Area
              dataKey="y"
              type="linear"
              stroke="#0f766e"
              strokeWidth={2}
              fill="#14b8a6"
              fillOpacity={0.12}
              isAnimationActive={false}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="w-56">
          <Segmented
            label="Chart range"
            value={range}
            options={TREND_RANGES.map((r) => ({ value: r, label: r }))}
            onChange={setRange}
          />
        </div>
        {trend.financialYearStart && (
          <p className="text-xs text-slate-500">
            ┆ Financial year started {formatIsoDate(trend.financialYearStart)}
          </p>
        )}
      </div>
      {totals && (
        <p className="mt-3 text-sm text-slate-600">
          Assets <span className="tabular-nums">{formatMoney(totals.assetsMinor, currency)}</span>
          {' · '}Liabilities{' '}
          <span className="tabular-nums">{formatMoney(totals.liabilitiesMinor, currency)}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400">
        Months without an entry use the account’s last balance.
      </p>
    </div>
  );
}
