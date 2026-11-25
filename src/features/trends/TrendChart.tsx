import { useId } from 'react';
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/app/theme';
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
  /** An imported total (ADR-0017): drawn as a lighter, dashed line. */
  imported?: boolean;
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

/** SVG can't use the CSS theme tokens directly, so the chart gets its colours per theme. */
const PALETTE = {
  light: {
    axis: '#5a6780',
    guide: '#8f9bb0',
    imported: '#94a3b8',
    dot: '#00a3ff',
    tooltipBg: '#ffffff',
    tooltipLine: '#e2e7f0',
    tooltipText: '#0d1526',
  },
  dark: {
    axis: '#95a3bd',
    guide: '#64728d',
    imported: '#64728d',
    dot: '#38d1ff',
    tooltipBg: '#111a2e',
    tooltipLine: '#22304b',
    tooltipText: '#e9eef8',
  },
} as const;

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
  const colors = PALETTE[useTheme().resolved];
  const gradientId = useId().replace(/:/g, '');
  // Imported totals get their own series; the first account point is in both, so they join.
  const data = points.map((p, i) => {
    const imported = p.imported ?? false;
    const afterImported = !imported && (points[i - 1]?.imported ?? false);
    return {
      x: isoDateToUtcMs(p.date),
      y: imported ? null : p.valueMinor,
      yImported: imported || afterImported ? p.valueMinor : null,
      entry: p.entry ?? false,
    };
  });
  const hasImported = points.some((p) => p.imported);
  return (
    <>
      <div role="img" aria-label={summary} className="mt-3 h-32 w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 320, height: 128 }}
        >
          <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
            <defs>
              {/* The logo's green → cyan → blue for the line, fading blue under it. */}
              {/* User-space units: a flat line has a zero-height box, which would hide a box-relative
                  gradient. */}
              <linearGradient
                id={`${gradientId}-line`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="100%"
                y2="0"
              >
                <stop offset="0%" stopColor="#00d68f" />
                <stop offset="55%" stopColor="#00c2ff" />
                <stop offset="100%" stopColor="#5b6cff" />
              </linearGradient>
              <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00c2ff" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#5b6cff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={axisTicks(points, range)}
              tickFormatter={(ms: number) =>
                (range === 'All' ? yearFormat : monthFormat).format(new Date(ms))
              }
              tick={{ fontSize: 11, fill: colors.axis }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              orientation="right"
              width={52}
              tickCount={3}
              tickFormatter={(v: number) => compactMoney(v, currency)}
              tick={{ fontSize: 11, fill: colors.axis }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: colors.tooltipBg,
                border: `1px solid ${colors.tooltipLine}`,
                borderRadius: 12,
                color: colors.tooltipText,
                fontSize: 13,
              }}
              labelStyle={{ color: colors.tooltipText, fontWeight: 600 }}
              labelFormatter={(ms) =>
                typeof ms === 'number' ? formatIsoDate(new Date(ms).toISOString().slice(0, 10)) : ''
              }
              formatter={(v, name) => [
                typeof v === 'number' ? formatMoney(v, currency) : '—',
                name === 'yImported' ? `${valueLabel} (imported)` : valueLabel,
              ]}
            />
            {financialYearStart && (
              <ReferenceLine
                x={isoDateToUtcMs(financialYearStart)}
                stroke={colors.guide}
                strokeDasharray="3 3"
                label={{ value: 'FY', position: 'insideTopLeft', fontSize: 11, fill: colors.axis }}
              />
            )}
            {hasImported && (
              <Area
                dataKey="yImported"
                type="linear"
                stroke={colors.imported}
                strokeWidth={2}
                strokeDasharray="4 3"
                fill={colors.imported}
                fillOpacity={0.15}
                isAnimationActive={false}
                connectNulls={false}
                dot={false}
                activeDot={false}
              />
            )}
            <Area
              dataKey="y"
              type={step ? 'stepAfter' : 'linear'}
              stroke={`url(#${gradientId}-line)`}
              strokeWidth={3}
              fill={`url(#${gradientId}-fill)`}
              fillOpacity={1}
              isAnimationActive={false}
              connectNulls={false}
              dot={(props: {
                cx?: number;
                cy?: number;
                index?: number;
                payload?: { entry?: boolean };
              }) =>
                props.payload?.entry && props.cx !== undefined && props.cy !== undefined ? (
                  <circle key={props.index} cx={props.cx} cy={props.cy} r={3} fill={colors.dot} />
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
        <div className="text-xs text-ink-muted">
          {financialYearStart && (
            <p>┆ Financial year started {formatIsoDate(financialYearStart)}</p>
          )}
          {hasImported && <p>┄ Earlier history (imported totals)</p>}
        </div>
      </div>
    </>
  );
}
