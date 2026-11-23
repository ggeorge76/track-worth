import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Segmented } from '@/components/Segmented';
import { formatIsoDate, isoDateToUtcMs } from '@/domain/dates';
import { formatMoney, fractionDigits } from '@/domain/money';
import { TREND_RANGES, type TrendRange } from '@/domain/trend';

export interface ChartPoint {
  date: string;
  /** Minor units; `null` where there's no data yet (no line drawn). */
  valueMinor: number | null;
  /** Draw a dot here (a balance the user entered). */
  entry?: boolean;
}

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
function axisTicks(points: readonly ChartPoint[], range: TrendRange): number[] {
  const first = points[0]?.date;
  const last = points.at(-1)?.date;
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

/**
 * A value-over-time chart with range chips and the financial-year start line, shared by the
 * start page (net worth) and account details (balance). `step` holds each value until the next
 * one, for charts of actual entries.
 */
export function TrendChart({
  points,
  currency,
  range,
  onRangeChange,
  financialYearStart,
  summary,
  valueLabel,
  step = false,
}: {
  points: readonly ChartPoint[];
  currency: string;
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
  financialYearStart?: string | undefined;
  /** Accessible description of the chart. */
  summary: string;
  /** Tooltip label, e.g. "Net worth". */
  valueLabel: string;
  step?: boolean;
}) {
  const data = points.map((p) => ({
    x: isoDateToUtcMs(p.date),
    y: p.valueMinor,
    entry: p.entry ?? false,
  }));
  return (
    <>
      <div role="img" aria-label={summary} className="mt-3 h-32 w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 320, height: 128 }}
        >
          <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={axisTicks(points, range)}
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
                valueLabel,
              ]}
            />
            {financialYearStart && (
              <ReferenceLine
                x={isoDateToUtcMs(financialYearStart)}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                label={{ value: 'FY', position: 'insideTopLeft', fontSize: 11, fill: '#64748b' }}
              />
            )}
            <Area
              dataKey="y"
              type={step ? 'stepAfter' : 'linear'}
              stroke="#0f766e"
              strokeWidth={2}
              fill="#14b8a6"
              fillOpacity={0.12}
              isAnimationActive={false}
              connectNulls={false}
              dot={(props: {
                cx?: number;
                cy?: number;
                index?: number;
                payload?: { entry?: boolean };
              }) =>
                props.payload?.entry && props.cx !== undefined && props.cy !== undefined ? (
                  <circle key={props.index} cx={props.cx} cy={props.cy} r={2.5} fill="#0f766e" />
                ) : (
                  <g key={props.index} />
                )
              }
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
            onChange={onRangeChange}
          />
        </div>
        {financialYearStart && (
          <p className="text-xs text-slate-500">
            ┆ Financial year started {formatIsoDate(financialYearStart)}
          </p>
        )}
      </div>
    </>
  );
}
