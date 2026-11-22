import { useState } from 'react';
import { formatIsoDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { BalanceEntry } from '@/domain/schema';
import { DeltaBadge } from './ChangeSummary';

const COLLAPSED = 3;

/** Newest-first list of entries; short by default, all on demand (R-V6). */
export function BalanceHistory({
  history,
  currency,
  onEdit,
}: {
  history: readonly BalanceEntry[];
  currency: string;
  onEdit: (entry: BalanceEntry) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? history : history.slice(0, COLLAPSED);

  return (
    <section aria-labelledby="history-heading" className="mt-8">
      <h2 id="history-heading" className="text-lg font-medium">
        Balance history
      </h2>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No balances yet. Use “Update” to add the first one.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-200">
            {visible.map((entry, i) => {
              const previous = history[i + 1];
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(entry);
                    }}
                    aria-label={`Edit balance for ${formatIsoDate(entry.date)}: ${formatMoney(entry.amountMinor, currency)}`}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span>
                      <span className="block text-sm text-slate-700">
                        {formatIsoDate(entry.date)}
                      </span>
                      {previous && (
                        <DeltaBadge
                          deltaMinor={entry.amountMinor - previous.amountMinor}
                          currency={currency}
                        />
                      )}
                    </span>
                    <span
                      className={`tabular-nums ${entry.amountMinor < 0 ? 'text-rose-700' : ''}`}
                    >
                      {formatMoney(entry.amountMinor, currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {history.length > COLLAPSED && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => {
                setShowAll(!showAll);
              }}
              className="w-full border-t border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {showAll ? 'Show less' : `See all ${String(history.length)} entries`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
