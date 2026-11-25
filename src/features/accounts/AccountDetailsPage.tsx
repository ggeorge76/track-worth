import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { goBack, navigate } from '@/app/router';
import { useSwipe } from '@/app/useSwipe';
import { useToday } from '@/app/useToday';
import { BackIcon, PencilIcon } from '@/components/icons';
import { Toast } from '@/components/Toast';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import {
  adjacentAccounts,
  deleteAccount,
  orderByBalanceSource,
  setArchived,
} from '@/domain/accounts';
import { accountHistory, deleteBalance, restoreBalance } from '@/domain/balances';
import { formatIsoDate } from '@/domain/dates';
import { LIQUIDITY_COLORS, LIQUIDITY_LABELS, type Liquidity } from '@/domain/liquidity';
import { formatMoney } from '@/domain/money';
import { describeDateAgo } from '@/domain/relativeDate';
import type { Account, BalanceEntry, DataFile } from '@/domain/schema';
import { balanceStats } from '@/domain/stats';
import { BalanceHistory } from './details/BalanceHistory';
import { BalanceChart } from './details/BalanceChart';
import { ChangeSummary, DeltaBadge } from './details/ChangeSummary';
import { useExchangeRates } from '@/features/fx/useExchangeRates';
import { DeleteAccountSheet } from './details/DeleteAccountSheet';
import { EditAccountSheet, type EditableField } from './details/EditAccountSheet';
import { UpdateBalanceSheet } from './details/UpdateBalanceSheet';

type Popup =
  | { kind: 'none' }
  | { kind: 'edit'; field: EditableField }
  | { kind: 'balance'; entry?: BalanceEntry }
  | { kind: 'delete-account' };

/** Always-visible edit affordance (no hover on touch devices). */
function EditMark() {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-muted"
      aria-hidden="true"
    >
      <PencilIcon width={16} height={16} />
    </span>
  );
}

/** A card that opens an editor when clicked ("editable on click", R-C2), with a visible pencil. */
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
      className="flex w-full items-start justify-between gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-line hover:ring-line-strong active:bg-canvas"
    >
      <span className="flex min-w-0 flex-1 items-stretch gap-3">
        {accent && (
          <span
            className="w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
        )}
        <span className="min-w-0">
          <span className="block text-sm text-ink-muted">{label}</span>
          <span className="mt-1 block break-words text-lg">{children}</span>
        </span>
      </span>
      <EditMark />
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
      className="rounded-full p-2 text-xl leading-none text-ink-muted hover:bg-muted disabled:invisible"
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
/** The balance in the base currency at today's rate (ADR-0018); the account keeps its own. */
function BaseValue({ value, base }: { value: number | null; base: string }) {
  if (value === null) return null;
  return (
    <p className="mt-2 inline-flex rounded-full bg-subtle px-3 py-1 text-sm text-ink-soft ring-1 ring-line">
      ≈ {formatMoney(value, base)} at today’s rate
    </p>
  );
}

export function AccountDetailsPage({ data, accountId }: { data: DataFile; accountId: string }) {
  const today = useToday();
  const [popup, setPopup] = useState<Popup>({ kind: 'none' });
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const save = useUpdateDataFile();
  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);
  const account = data.accounts.find((a) => a.id === accountId);
  const { fx } = useExchangeRates(data);

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
      className="rounded-full p-2 text-ink-muted hover:bg-muted"
    >
      <BackIcon />
    </button>
  );

  if (!account) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        {backButton}
        <p role="alert" className="mt-6 text-ink-muted">
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
  const setArchivedTo = (archived: boolean) => {
    save.mutate((file) => setArchived(file, account.id, archived));
    setToast({ message: archived ? 'Account archived.' : 'Account restored to your list.' });
  };
  const deleteEntry = (entry: BalanceEntry) => {
    save.mutate((file) => deleteBalance(file, entry.id));
    setToast({
      message: `Balance for ${formatIsoDate(entry.date)} deleted.`,
      undo: () => {
        save.mutate((file) => restoreBalance(file, entry));
      },
    });
  };
  const edit = (field: EditableField) => () => {
    setPopup({ kind: 'edit', field });
  };

  return (
    <div {...swipe} className="mx-auto w-full max-w-2xl touch-pan-y px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        {backButton}
        <div className="flex items-center gap-1 text-sm text-ink-muted">
          <NavButton account={previous} direction="previous" />
          {position > 0 && (
            <span aria-label={`Account ${String(position)} of ${String(ordered.length)}`}>
              {position} / {ordered.length}
            </span>
          )}
          <NavButton account={next} direction="next" />
        </div>
      </div>

      {account.archived && (
        <div
          role="note"
          className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-2 text-sm text-ink-soft"
        >
          <span>
            <strong className="font-medium">Archived.</strong> Hidden from your account list and net
            worth; history is kept.
          </span>
          <button
            type="button"
            onClick={() => {
              setArchivedTo(false);
            }}
            className="shrink-0 font-medium underline"
          >
            Unarchive
          </button>
        </div>
      )}

      <section className="relative mt-3 overflow-hidden rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-1 via-accent-2 to-accent-3"
        />
        <header className="flex items-start justify-between gap-3">
          {/* Tapping the title also opens the editor; the pencil button is the accessible control. */}
          <div className="min-w-0 cursor-pointer" onClick={edit('name')}>
            <h1 className="text-2xl font-bold tracking-tight break-words">{account.name}</h1>
            <p className="text-ink-muted">{account.tag}</p>
          </div>
          <button
            type="button"
            onClick={edit('name')}
            aria-label="Edit name and tag"
            title="Edit name and tag"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-muted hover:bg-muted"
          >
            <PencilIcon width={18} height={18} />
          </button>
        </header>

        <p
          className={`mt-4 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl ${current && current.amountMinor < 0 ? 'text-negative' : ''}`}
        >
          {current ? formatMoney(current.amountMinor, account.currency) : '—'}
        </p>
        <p className="text-sm text-ink-muted">
          {current ? `Updated ${describeDateAgo(current.date, today)}` : 'No balance yet'}
        </p>
        {current && account.currency !== fx.base && (
          <BaseValue
            value={fx.toBase(current.amountMinor, account.currency, today)}
            base={fx.base}
          />
        )}
      </section>

      <ChangeSummary
        sincePrevious={stats.sincePrevious}
        sincePreviousMonth={stats.sincePreviousMonth}
        sincePreviousFinancialYear={stats.sincePreviousFinancialYear}
        currency={account.currency}
      />

      <BalanceChart
        account={account}
        entries={history}
        today={today}
        financialYearStartMonth={data.settings.financialYearStartMonth}
      />

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
          <p className="text-sm text-ink-muted">
            {account.kind === 'liability' ? 'All-time high (peak debt)' : 'All-time high'}
          </p>
          {allTimeHigh && current ? (
            <div className="mt-1 flex items-end justify-between gap-3">
              <span>
                <span className="block text-sm text-ink-muted">
                  {formatIsoDate(allTimeHigh.date)}
                </span>
                <span className="text-2xl tabular-nums">
                  {formatMoney(allTimeHigh.amountMinor, account.currency)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-xs text-ink-muted">Now vs then</span>
                <DeltaBadge
                  deltaMinor={current.amountMinor - allTimeHigh.amountMinor}
                  baseMinor={allTimeHigh.amountMinor}
                  currency={account.currency}
                />
              </span>
            </div>
          ) : (
            <p className="mt-1 text-ink-faint">—</p>
          )}
        </div>

        <InfoCard label="Liquidity" onEdit={edit('liquidity')} accent={LIQUIDITY_COLORS[level]}>
          {LIQUIDITY_LABELS[level]}
        </InfoCard>
        <InfoCard label="Currency" onEdit={edit('currency')}>
          {account.currency}
        </InfoCard>
        <InfoCard label="Type" onEdit={edit('kind')}>
          {account.kind === 'asset' ? 'Asset' : 'Liability'}
        </InfoCard>
        <InfoCard label="Balance source" onEdit={edit('balanceSource')}>
          {account.balanceSource ?? <span className="text-ink-faint">Not set</span>}
        </InfoCard>
        <div className="col-span-2">
          <InfoCard label="Notes" onEdit={edit('note')}>
            {account.note ? (
              <span className="whitespace-pre-wrap text-base">{account.note}</span>
            ) : (
              <span className="text-base text-ink-faint">Add notes</span>
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

      <section aria-labelledby="manage-heading" className="mt-10 border-t border-line pt-6">
        <h2 id="manage-heading" className="text-sm font-medium text-ink-muted">
          Manage account
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setArchivedTo(!account.archived);
            }}
            className="rounded-xl border border-line-strong bg-surface px-4 py-2 text-sm text-ink-soft hover:border-line-strong"
          >
            {account.archived ? 'Unarchive account' : 'Archive account'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPopup({ kind: 'delete-account' });
            }}
            className="rounded-xl border border-danger/30 bg-surface px-4 py-2 text-sm text-danger hover:bg-danger-soft"
          >
            Delete account…
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={() => {
          setPopup({ kind: 'balance' });
        }}
        className="fixed right-6 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6 rounded-2xl bg-brand px-6 py-4 text-lg font-medium text-white shadow-lg hover:bg-brand-strong"
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
          onDelete={deleteEntry}
          onClose={close}
        />
      )}
      {popup.kind === 'delete-account' && (
        <DeleteAccountSheet
          account={account}
          entries={history.length}
          onArchive={() => {
            close();
            setArchivedTo(true);
          }}
          onDelete={() => {
            close();
            save.mutate((file) => deleteAccount(file, account.id));
            navigate({ name: 'home' }, { replace: true });
          }}
          onClose={close}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          {...(toast.undo ? { actionLabel: 'Undo', onAction: toast.undo } : {})}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
