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
import { useOutOfView } from './useOutOfView';
import { AccountRow } from './AccountRow';
import { FilterSheet } from './FilterSheet';

export function StartPage({ data }: { data: DataFile }) {
  const today = useToday();
  const [options, setOptions] = useState<ListOptions>(DEFAULT_LIST_OPTIONS);
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = isFiltered(options);
  // Every figure on this page follows the tag/liquidity filter. Archived accounts never count
  // towards net worth, even when shown.
  // Earlier history is a plain total that can't be split by tag or liquidity (ADR-0017).
  const counted = filtered
    ? {
        ...data,
        accounts: data.accounts.filter((a) => matchesFilter(a, options)),
        netWorthHistory: [],
      }
    : data;
  const totals = Object.entries(netWorthByCurrency(counted));
  const { groups, shown, total } = buildAccountList(data.accounts, data.balances, options);
  // The app header is 56 px tall (h-14 in App.tsx).
  const [headline, scrolledPast] = useOutOfView<HTMLDivElement>(56);
  const netWorthText =
    totals.length === 0
      ? '—'
      : totals.map(([currency, t]) => formatMoney(t.netMinor, currency)).join(' · ');
  const openFilter = () => {
    setFilterOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      {/* Once the big number scrolls away, a smaller copy stays in view under the header. It
          repeats the heading's content, so it's hidden from assistive technology. */}
      <div
        aria-hidden="true"
        className={`fixed inset-x-0 top-14 z-20 transition-all duration-200 ${
          scrolledPast
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-2xl items-baseline justify-between gap-3 border-b border-line bg-surface/90 px-4 py-2 shadow-sm backdrop-blur sm:rounded-b-2xl sm:border-x">
          <span className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
            Net worth{filtered && ' · filtered'}
          </span>
          <span className="text-xl font-bold tracking-tight tabular-nums">{netWorthText}</span>
        </div>
      </div>
      <section
        aria-labelledby="net-worth-heading"
        className="relative overflow-hidden rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6"
      >
        {/* A thin band of the logo's green → cyan → blue across the top of the card. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-1 via-accent-2 to-accent-3"
        />
        <div className="flex items-start justify-between gap-3">
          <h1
            id="net-worth-heading"
            className="text-xs font-semibold tracking-wider text-ink-muted uppercase"
          >
            Net worth{filtered && ' · filtered'}
          </h1>
          {totals.length > 0 && (
            <a
              href={hrefFor({ name: 'insights' })}
              className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink hover:bg-brand hover:text-white"
            >
              See where your money is →
            </a>
          )}
        </div>
        <div ref={headline}>
          {totals.length === 0 ? (
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-ink-faint">—</p>
          ) : (
            totals.map(([currency, t]) => (
              <p
                key={currency}
                className="mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl"
              >
                {formatMoney(t.netMinor, currency)}
              </p>
            ))
          )}
        </div>
        <NetWorthTrend data={counted} />
      </section>

      {data.accounts.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-ink-muted">No accounts yet.</p>
          <a
            href={hrefFor({ name: 'new-account' })}
            className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-strong"
          >
            Add your first account
          </a>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={openFilter}
              className="flex flex-1 items-center gap-2 rounded-xl bg-surface px-4 py-2 text-sm font-medium text-ink-soft shadow-sm ring-1 ring-line hover:ring-line-strong"
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
                options.groupByTag
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-surface text-ink-soft shadow-sm ring-1 ring-line hover:ring-line-strong'
              }`}
            >
              <GroupIcon />
            </button>
            <button
              type="button"
              onClick={openFilter}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${
                filtered
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-surface font-medium text-ink-soft shadow-sm ring-1 ring-line hover:ring-line-strong'
              }`}
            >
              Filter
              <FilterIcon />
            </button>
          </div>

          {shown === 0 && total === 0 ? (
            <p className="mt-8 text-center text-ink-muted">
              All your accounts are archived.{' '}
              <button
                type="button"
                className="font-medium text-brand underline"
                onClick={() => {
                  setOptions({ ...options, showArchived: true });
                }}
              >
                Show archived accounts
              </button>
            </p>
          ) : shown === 0 ? (
            <p className="mt-8 text-center text-ink-muted">
              No accounts match these filters.{' '}
              <button
                type="button"
                className="font-medium text-brand underline"
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
                <ul
                  key="all"
                  aria-label="Accounts"
                  className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line"
                >
                  {group.rows.map((row) => (
                    <AccountRow key={row.account.id} row={row} today={today} />
                  ))}
                </ul>
              ) : (
                <section key={group.tag} aria-label={group.tag} className="mt-5">
                  <h2 className="px-1 text-xs font-semibold tracking-wider text-ink-muted uppercase">
                    {group.tag} <span className="text-ink-faint">· {group.rows.length}</span>
                  </h2>
                  <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
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
        className="fixed right-6 bottom-6 rounded-2xl bg-gradient-to-br from-accent-2 to-brand p-4 text-white shadow-lg shadow-brand/30 transition-transform hover:scale-105 hover:shadow-xl"
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
