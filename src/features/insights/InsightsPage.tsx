import { useId, useState } from 'react';
import { Pie, PieChart } from 'recharts';
import { goBack } from '@/app/router';
import { BackIcon } from '@/components/icons';
import { Segmented } from '@/components/Segmented';
import {
  breakdown,
  type BreakdownRow,
  type BreakdownSection,
  type GroupBy,
} from '@/domain/breakdown';
import { LIQUIDITY_COLORS } from '@/domain/liquidity';
import { formatMoney } from '@/domain/money';
import type { DataFile } from '@/domain/schema';
import { trendCurrencies } from '@/domain/trend';

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

/** Distinct colours for tags, in order of size; any beyond these share a neutral grey. */
const TAG_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#a855f7', // purple
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
];
const OTHER_COLOR = '#94a3b8';

const colorOf = (row: BreakdownRow, index: number) =>
  row.level ? LIQUIDITY_COLORS[row.level] : (TAG_COLORS[index] ?? OTHER_COLOR);

function Section({
  title,
  empty,
  section,
  currency,
}: {
  title: string;
  empty: string;
  section: BreakdownSection;
  currency: string;
}) {
  const headingId = useId();
  // A donut can only show parts of a positive whole; slices of zero or less are left out.
  const slices = section.rows
    .map((row, i) => ({ row, color: colorOf(row, i) }))
    .filter(({ row }) => row.share !== null && row.amountMinor > 0);

  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-medium">
          {title}
        </h2>
        {section.rows.length > 0 && (
          <span className="tabular-nums text-ink-muted">
            {formatMoney(section.totalMinor, currency)}
          </span>
        )}
      </div>
      {section.rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">{empty}</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {slices.length > 0 && (
            <div aria-hidden="true" className="shrink-0">
              <PieChart width={128} height={128}>
                <Pie
                  data={slices.map(({ row, color }) => ({
                    name: row.label,
                    value: row.amountMinor,
                    fill: color,
                  }))}
                  dataKey="value"
                  innerRadius={34}
                  outerRadius={62}
                  paddingAngle={slices.length > 1 ? 1 : 0}
                  stroke="none"
                  isAnimationActive={false}
                />
              </PieChart>
            </div>
          )}
          <ul className="w-full space-y-2">
            {section.rows.map((row, i) => (
              <li key={row.key} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOf(row, i) }}
                  />
                  <span className="break-words">
                    {row.label}{' '}
                    <span className="text-ink-faint">
                      · {row.accounts} {row.accounts === 1 ? 'account' : 'accounts'}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(row.amountMinor, currency)}
                  {row.share !== null && (
                    <span className="ml-2 inline-block w-10 text-right text-ink-muted">
                      {percent.format(row.share)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Where the money sits (R-D5): by tag or by liquidity, one currency at a time. */
export function InsightsPage({ data }: { data: DataFile }) {
  const currencies = trendCurrencies(data);
  const [picked, setPicked] = useState<string>();
  const [groupBy, setGroupBy] = useState<GroupBy>('tag');
  const currency = picked && currencies.includes(picked) ? picked : currencies[0];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="rounded-full p-2 text-ink-muted hover:bg-muted"
        >
          <BackIcon />
        </button>
        <h1 className="text-xl font-semibold">Insights</h1>
      </div>

      {!currency ? (
        <p className="mt-10 text-center text-ink-muted">
          Nothing to show yet. Add a balance to an account to see where your money is.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="w-56">
              <Segmented
                label="Group by"
                value={groupBy}
                options={[
                  { value: 'tag', label: 'Tag' },
                  { value: 'liquidity', label: 'Liquidity' },
                ]}
                onChange={setGroupBy}
              />
            </div>
            {currencies.length > 1 && (
              <div className="w-48">
                <Segmented
                  label="Currency"
                  value={currency}
                  options={currencies.map((c) => ({ value: c, label: c }))}
                  onChange={setPicked}
                />
              </div>
            )}
          </div>
          {(() => {
            const result = breakdown(data, currency, groupBy);
            return (
              <>
                <Section
                  title="Assets"
                  empty="No asset balances yet."
                  section={result.assets}
                  currency={currency}
                />
                <Section
                  title="Liabilities"
                  empty="No liability balances yet."
                  section={result.liabilities}
                  currency={currency}
                />
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
