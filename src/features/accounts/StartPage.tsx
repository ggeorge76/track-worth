import { useState } from 'react';
import { hrefFor } from '@/app/router';
import { useToday } from '@/app/useToday';
import { FilterIcon, GroupIcon, PlusIcon, WalletIcon } from '@/components/icons';
import {
  buildAccountList,
  DEFAULT_LIST_OPTIONS,
  isFiltered,
  matchesFilter,
  tagsInUse,
  type ListOptions,
} from '@/domain/accountList';
import { formatMoney } from '@/domain/money';
import { netWorthByCurrency } from '@/domain/netWorth';
import type { DataFile } from '@/domain/schema';
import { NetWorthTrend } from '@/features/trends/NetWorthTrend';
import { AccountRow } from './AccountRow';
import { FilterSheet } from './FilterSheet';

export function StartPage({ data }: { data: DataFile }) {
  const today = useToday();
  const [options, setOptions] = useState<ListOptions>(DEFAULT_LIST_OPTIONS);
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = isFiltered(options);
  // Every figure on this page follows the tag/liquidity filter. Archived accounts never count
  // towards net worth, even when shown.
  const counted = filtered
    ? { ...data, accounts: data.accounts.filter((a) => matchesFilter(a, options)) }
    : data;
  const totals = Object.entries(netWorthByCurrency(counted));
  const { groups, shown, total } = buildAccountList(data.accounts, data.balances, options);
  const openFilter = () => {
    setFilterOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      <section aria-labelledby="net-worth-heading">
        <h1 id="net-worth-heading" className="text-sm tracking-wide text-slate-500">
          Net worth{filtered && ' · filtered'}
        </h1>
        {totals.length === 0 ? (
          <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-400">—</p>
        ) : (
          totals.map(([currency, t]) => (
            <p key={currency} className="mt-1 text-4xl font-semibold tabular-nums">
              {formatMoney(t.netMinor, currency)}
            </p>
          ))
        )}
        <NetWorthTrend data={counted} />
      </section>

      {data.accounts.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-slate-600">No accounts yet.</p>
          <a
            href={hrefFor({ name: 'new-account' })}
            className="mt-4 inline-block rounded-xl bg-teal-700 px-5 py-2.5 font-medium text-white hover:bg-teal-800"
          >
            Add your first account
          </a>
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={openFilter}
              className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700"
            >
              <WalletIcon />
              {shown === total
                ? `${String(total)} accounts`
                : `${String(shown)} of ${String(total)} accounts`}
            </button>
            <button
              type="button"
              aria-pressed={options.groupByTag}
              aria-label="Group by tag"
              title="Group by tag"
              onClick={() => {
                setOptions({ ...options, groupByTag: !options.groupByTag });
              }}
              className={`rounded-xl p-2.5 ${
                options.groupByTag ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <GroupIcon />
            </button>
            <button
              type="button"
              onClick={openFilter}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${
                filtered ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-900'
              }`}
            >
              Filter
              <FilterIcon />
            </button>
          </div>

          {shown === 0 && total === 0 ? (
            <p className="mt-8 text-center text-slate-600">
              All your accounts are archived.{' '}
              <button
                type="button"
                className="font-medium text-teal-700 underline"
                onClick={() => {
                  setOptions({ ...options, showArchived: true });
                }}
              >
                Show archived accounts
              </button>
            </p>
          ) : shown === 0 ? (
            <p className="mt-8 text-center text-slate-600">
              No accounts match these filters.{' '}
              <button
                type="button"
                className="font-medium text-teal-700 underline"
                onClick={() => {
                  setOptions({ ...options, tags: [], liquidity: [] });
                }}
              >
                Clear filters
              </button>
            </p>
          ) : (
            groups.map((group) =>
              group.tag === null ? (
                <ul key="all" aria-label="Accounts" className="mt-3 divide-y divide-slate-200">
                  {group.rows.map((row) => (
                    <AccountRow key={row.account.id} row={row} today={today} />
                  ))}
                </ul>
              ) : (
                <section key={group.tag} aria-label={group.tag} className="mt-5">
                  <h2 className="text-sm font-medium text-slate-500">
                    {group.tag} <span className="text-slate-400">· {group.rows.length}</span>
                  </h2>
                  <ul className="mt-1 divide-y divide-slate-200">
                    {group.rows.map((row) => (
                      <AccountRow key={row.account.id} row={row} today={today} />
                    ))}
                  </ul>
                </section>
              ),
            )
          )}
        </>
      )}

      <a
        href={hrefFor({ name: 'new-account' })}
        aria-label="Add account"
        title="Add account"
        className="fixed bottom-6 right-6 rounded-2xl bg-blue-600 p-4 text-white shadow-lg hover:bg-blue-700"
      >
        <PlusIcon width={28} height={28} />
      </a>

      <FilterSheet
        open={filterOpen}
        onClose={() => {
          setFilterOpen(false);
        }}
        options={options}
        onChange={setOptions}
        tags={tagsInUse(data.accounts)}
      />
    </div>
  );
}
