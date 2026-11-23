import { useId, useState } from 'react';
import { goBack } from '@/app/router';
import { BackIcon } from '@/components/icons';
import { Segmented } from '@/components/Segmented';
import { breakdown, type BreakdownSection } from '@/domain/breakdown';
import { formatMoney } from '@/domain/money';
import type { DataFile } from '@/domain/schema';
import { trendCurrencies } from '@/domain/trend';

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

function Section({
  title,
  section,
  currency,
  tone,
}: {
  title: string;
  section: BreakdownSection;
  currency: string;
  tone: 'asset' | 'liability';
}) {
  const headingId = useId();
  if (section.rows.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-medium">
          {title}
        </h2>
        <span className="tabular-nums text-slate-600">
          {formatMoney(section.totalMinor, currency)}
        </span>
      </div>
      <ul className="mt-3 space-y-3">
        {section.rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">
                {row.label}{' '}
                <span className="text-slate-400">
                  · {row.accounts} {row.accounts === 1 ? 'account' : 'accounts'}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatMoney(row.amountMinor, currency)}
                {row.share !== null && (
                  <span className="ml-2 inline-block w-10 text-right text-slate-500">
                    {percent.format(row.share)}
                  </span>
                )}
              </span>
            </div>
            {row.share !== null && (
              <div className="mt-1 h-2 rounded-full bg-slate-100" aria-hidden="true">
                <div
                  className={`h-2 rounded-full ${tone === 'asset' ? 'bg-teal-600' : 'bg-rose-500'}`}
                  style={{ width: `${String(Math.max(0, Math.min(1, row.share)) * 100)}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Where the money sits (R-D5): breakdown by tag and by liquidity, one currency at a time. */
export function InsightsPage({ data }: { data: DataFile }) {
  const currencies = trendCurrencies(data);
  const [picked, setPicked] = useState<string>();
  const currency = picked && currencies.includes(picked) ? picked : currencies[0];
  const result = currency ? breakdown(data, currency) : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="rounded-full p-2 text-slate-600 hover:bg-slate-200"
        >
          <BackIcon />
        </button>
        <h1 className="text-xl font-semibold">Insights</h1>
      </div>

      {!currency || !result ? (
        <p className="mt-10 text-center text-slate-600">
          Nothing to show yet. Add a balance to an account to see where your money is.
        </p>
      ) : (
        <>
          {currencies.length > 1 && (
            <div className="mt-4 max-w-xs">
              <Segmented
                label="Currency"
                value={currency}
                options={currencies.map((c) => ({ value: c, label: c }))}
                onChange={setPicked}
              />
            </div>
          )}
          <Section
            title="Assets by tag"
            section={result.assetsByTag}
            currency={currency}
            tone="asset"
          />
          <Section
            title="Assets by liquidity"
            section={result.assetsByLiquidity}
            currency={currency}
            tone="asset"
          />
          <Section
            title="Liabilities by tag"
            section={result.liabilitiesByTag}
            currency={currency}
            tone="liability"
          />
          <p className="mt-4 text-xs text-slate-500">
            Latest balance of each account in {currency}. Archived accounts aren’t included.
          </p>
        </>
      )}
    </div>
  );
}
