import { useEffect, useState, type ReactNode } from 'react';
import { goBack, navigate } from '@/app/router';
import { useSwipe } from '@/app/useSwipe';
import { useToday } from '@/app/useToday';
import { BackIcon } from '@/components/icons';
import { adjacentAccounts, orderByBalanceSource } from '@/domain/accounts';
import { accountHistory } from '@/domain/balances';
import { formatIsoDate } from '@/domain/dates';
import { LIQUIDITY_COLORS, LIQUIDITY_LABELS, type Liquidity } from '@/domain/liquidity';
import { formatMoney } from '@/domain/money';
import { describeDateAgo } from '@/domain/relativeDate';
import type { Account, BalanceEntry, DataFile } from '@/domain/schema';
import { balanceStats } from '@/domain/stats';
import { BalanceHistory } from './details/BalanceHistory';
import { ChangeSummary, DeltaBadge } from './details/ChangeSummary';
import { EditAccountSheet, type EditableField } from './details/EditAccountSheet';
import { UpdateBalanceSheet } from './details/UpdateBalanceSheet';

type Popup =
  | { kind: 'none' }
  | { kind: 'edit'; field: EditableField }
  | { kind: 'balance'; entry?: BalanceEntry };

/** A card that opens an editor when clicked ("editable on click", R-C2). */
function InfoCard({
  label,
  onEdit,
  children,
  accent,
}: {
  label: string;
  onEdit: () => void;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${label.toLocaleLowerCase()}`}
      className="flex w-full items-stretch justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-slate-300"
    >
      <span className="min-w-0">
        <span className="block text-sm text-slate-500">{label}</span>
        <span className="mt-1 block break-words text-lg">{children}</span>
      </span>
      {accent && (
        <span
          className="w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function NavButton({
  account,
  direction,
}: {
  account: Account | undefined;
  direction: 'previous' | 'next';
}) {
  return (
    <button
      type="button"
      disabled={!account}
      aria-label={
        account
          ? `${direction === 'previous' ? 'Previous' : 'Next'} account: ${account.name}`
          : undefined
      }
      title={account?.name}
      onClick={() => {
        if (account) navigate({ name: 'account', id: account.id }, { replace: true });
      }}
      className="rounded-full p-2 text-xl leading-none text-slate-600 hover:bg-slate-200 disabled:invisible"
    >
      <span aria-hidden="true">{direction === 'previous' ? '‹' : '›'}</span>
    </button>
  );
}

/**
 * Account details (R-V1–R-V8). Swipe (touch), ←/→ keys or the ‹ › buttons move to the
 * previous/next account in balance-source order (R-C6). These replace the history entry, so
 * Back always returns to where you came from.
 */
export function AccountDetailsPage({ data, accountId }: { data: DataFile; accountId: string }) {
  const today = useToday();
  const [popup, setPopup] = useState<Popup>({ kind: 'none' });
  const account = data.accounts.find((a) => a.id === accountId);

  const ordered = orderByBalanceSource(data.accounts.filter((a) => !a.archived));
  const { previous, next } = adjacentAccounts(ordered, accountId);
  const goTo = (target: Account | undefined) => {
    if (target) navigate({ name: 'account', id: target.id }, { replace: true });
  };
  const swipe = useSwipe({
    onLeft: () => {
      goTo(next);
    },
    onRight: () => {
      goTo(previous);
    },
  });

  // ←/→ when nothing else wants the keys (no popup open, not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') goTo(previous);
      else if (e.key === 'ArrowRight') goTo(next);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  const backButton = (
    <button
      type="button"
      onClick={goBack}
      aria-label="Back"
      className="rounded-full p-2 text-slate-600 hover:bg-slate-200"
    >
      <BackIcon />
    </button>
  );

  if (!account) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        {backButton}
        <p role="alert" className="mt-6 text-slate-600">
          This account doesn’t exist. It may have been removed on another device.
        </p>
      </div>
    );
  }

  const history = accountHistory(data.balances, account.id);
  const stats = balanceStats(
    data.balances,
    account.id,
    account.kind,
    today,
    data.settings.financialYearStartMonth,
  );
  const { current, allTimeHigh } = stats;
  const level = account.liquidity as Liquidity;
  const position = ordered.findIndex((a) => a.id === account.id) + 1;
  const close = () => {
    setPopup({ kind: 'none' });
  };
  const edit = (field: EditableField) => () => {
    setPopup({ kind: 'edit', field });
  };

  return (
    <div {...swipe} className="mx-auto w-full max-w-2xl touch-pan-y px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        {backButton}
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <NavButton account={previous} direction="previous" />
          {position > 0 && (
            <span aria-label={`Account ${String(position)} of ${String(ordered.length)}`}>
              {position} / {ordered.length}
            </span>
          )}
          <NavButton account={next} direction="next" />
        </div>
      </div>

      <header className="mt-3">
        <h1 className="text-2xl font-semibold">
          <button
            type="button"
            onClick={edit('name')}
            className="text-left hover:underline"
            aria-label={`${account.name}. Edit name and tag`}
          >
            {account.name}
          </button>
        </h1>
        <p>
          <button
            type="button"
            onClick={edit('name')}
            className="text-slate-600 hover:underline"
            aria-label={`Tag: ${account.tag}. Edit name and tag`}
          >
            {account.tag}
          </button>
        </p>
      </header>

      <p
        className={`mt-4 text-4xl font-semibold tabular-nums ${current && current.amountMinor < 0 ? 'text-rose-700' : ''}`}
      >
        {current ? formatMoney(current.amountMinor, account.currency) : '—'}
      </p>
      <p className="text-sm text-slate-500">
        {current ? `Updated ${describeDateAgo(current.date, today)}` : 'No balance yet'}
      </p>

      <ChangeSummary
        sincePrevious={stats.sincePrevious}
        sincePreviousMonth={stats.sincePreviousMonth}
        sincePreviousFinancialYear={stats.sincePreviousFinancialYear}
        currency={account.currency}
      />

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">
            {account.kind === 'liability' ? 'All-time high (peak debt)' : 'All-time high'}
          </p>
          {allTimeHigh && current ? (
            <div className="mt-1 flex items-end justify-between gap-3">
              <span>
                <span className="block text-sm text-slate-500">
                  {formatIsoDate(allTimeHigh.date)}
                </span>
                <span className="text-2xl tabular-nums">
                  {formatMoney(allTimeHigh.amountMinor, account.currency)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-xs text-slate-500">Now vs then</span>
                <DeltaBadge
                  deltaMinor={current.amountMinor - allTimeHigh.amountMinor}
                  baseMinor={allTimeHigh.amountMinor}
                  currency={account.currency}
                />
              </span>
            </div>
          ) : (
            <p className="mt-1 text-slate-400">—</p>
          )}
        </div>

        <InfoCard label="Liquidity" onEdit={edit('liquidity')} accent={LIQUIDITY_COLORS[level]}>
          {LIQUIDITY_LABELS[level]}
        </InfoCard>
        <InfoCard label="Currency" onEdit={edit('currency')}>
          {account.currency}
        </InfoCard>
        <div className="col-span-2">
          <InfoCard label="Balance source" onEdit={edit('balanceSource')}>
            {account.balanceSource ?? <span className="text-slate-400">Not set</span>}
          </InfoCard>
        </div>
        <div className="col-span-2">
          <InfoCard label="Notes" onEdit={edit('note')}>
            {account.note ? (
              <span className="whitespace-pre-wrap text-base">{account.note}</span>
            ) : (
              <span className="text-base text-slate-400">Add notes</span>
            )}
          </InfoCard>
        </div>
      </div>

      <BalanceHistory
        history={history}
        currency={account.currency}
        onEdit={(entry) => {
          setPopup({ kind: 'balance', entry });
        }}
      />

      <button
        type="button"
        onClick={() => {
          setPopup({ kind: 'balance' });
        }}
        className="fixed bottom-6 right-6 rounded-2xl bg-blue-600 px-6 py-4 text-lg font-medium text-white shadow-lg hover:bg-blue-700"
      >
        Update
      </button>

      {popup.kind === 'edit' && (
        <EditAccountSheet data={data} account={account} field={popup.field} onClose={close} />
      )}
      {popup.kind === 'balance' && (
        <UpdateBalanceSheet
          account={account}
          history={history}
          today={today}
          initial={popup.entry}
          onClose={close}
        />
      )}
    </div>
  );
}
