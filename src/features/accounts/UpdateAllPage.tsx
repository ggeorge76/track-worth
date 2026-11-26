import { useId, useState } from 'react';
import { goBack, navigate } from '@/app/router';
import { useToday } from '@/app/useToday';
import { BackIcon } from '@/components/icons';
import { orderByBalanceSource } from '@/domain/accounts';
import { defaultSign, recordBalances, signOf, type Sign } from '@/domain/balances';
import { formatMoney, minorToInput } from '@/domain/money';
import { latestBalance } from '@/domain/netWorth';
import { describeDateAgo } from '@/domain/relativeDate';
import type { Account, DataFile } from '@/domain/schema';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { checkSignedAmount } from './amountInput';
import { inputClass } from './formParts';

interface Row {
  amount: string;
  sign: Sign;
  /** The user typed or tapped "Same" here (so it's theirs to save). */
  touched: boolean;
}

/** What a row starts as for `date`: that date's saved balance, if any, else empty. */
function initialRow(account: Account, data: DataFile, date: string): Row {
  const onDate = data.balances.find((e) => e.accountId === account.id && e.date === date);
  const last = latestBalance(account.id, data.balances, date);
  return onDate
    ? {
        amount: minorToInput(onDate.amountMinor, account.currency),
        sign: signOf(onDate.amountMinor),
        touched: false,
      }
    : {
        amount: '',
        sign: last ? signOf(last.amountMinor) : defaultSign(account.kind),
        touched: false,
      };
}

/**
 * Update every balance on one screen (R-B2): accounts grouped by balance source (the order you
 * read them in), one date for all, the last balance as a hint and a "Same" shortcut. Only rows
 * you filled in or confirmed are saved, in one change, so no account is marked "updated" that
 * you didn't look at.
 */
export function UpdateAllPage({ data }: { data: DataFile }) {
  const today = useToday();
  const save = useUpdateDataFile();
  const dateId = useId();
  const [date, setDate] = useState(today);
  const accounts = orderByBalanceSource(data.accounts.filter((a) => !a.archived));
  const [rows, setRows] = useState<Record<string, Row>>({});
  const rowOf = (a: Account) => rows[a.id] ?? initialRow(a, data, date);
  const setRow = (a: Account, row: Partial<Row>) => {
    setRows((all) => ({ ...all, [a.id]: { ...rowOf(a), ...row, touched: true } }));
  };

  const checked = accounts.map((a) => {
    const row = rowOf(a);
    const result = checkSignedAmount(row.amount, row.sign, a.currency);
    const onDate = data.balances.find((e) => e.accountId === a.id && e.date === date);
    const amountMinor = result.ok ? result.amountMinor : null;
    // Saved: touched rows with an amount that isn't already what's saved for that date.
    const toSave = row.touched && amountMinor !== null && amountMinor !== onDate?.amountMinor;
    return { account: a, row, result, amountMinor, toSave };
  });
  const errors = checked.filter((c) => c.row.touched && !c.result.ok).length;
  const pending = checked.filter((c) => c.toSave);
  const dateOk = date !== '' && date <= today;

  const onSave = async () => {
    try {
      await save.mutateAsync((file, opts) =>
        recordBalances(
          file,
          date,
          pending.map((c) => ({ accountId: c.account.id, amountMinor: c.amountMinor as number })),
          opts,
        ),
      );
      navigate({ name: 'home' }, { replace: true });
    } catch {
      // The save status banner explains; keep what was typed so it can be retried.
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-32">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="rounded-full p-2 text-ink-muted hover:bg-muted"
        >
          <BackIcon />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Update all</h1>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
        <label htmlFor={dateId} className="font-medium">
          Balances on
        </label>
        <input
          id={dateId}
          type="date"
          max={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setRows({}); // start again from that date's saved balances
          }}
          className={`${inputClass} w-auto`}
        />
        {!dateOk && (
          <p role="alert" className="w-full text-sm text-danger">
            Pick a date that isn’t in the future.
          </p>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="mt-10 text-center text-ink-muted">No accounts to update yet.</p>
      ) : (
        <ul aria-label="Accounts to update" className="mt-4 space-y-2">
          {checked.map(({ account, row, result }, i) => {
            const last = latestBalance(account.id, data.balances, date);
            const heading = account.balanceSource;
            // A heading wherever the balance source changes (accounts are ordered by it).
            const showHeading = i === 0 || accounts[i - 1]?.balanceSource !== heading;
            const amountId = `${dateId}-${account.id}`;
            return (
              <li key={account.id}>
                {showHeading && (
                  <h2 className="mt-4 mb-1 px-1 text-xs font-semibold tracking-wider text-ink-muted uppercase">
                    {heading ?? 'No balance source'}
                  </h2>
                )}
                <div className="rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor={amountId} className="min-w-0 truncate font-medium text-ink">
                      {account.name}
                    </label>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {last
                        ? `${formatMoney(last.amountMinor, account.currency)} · ${describeDateAgo(last.date, today)}`
                        : 'No balance yet'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`${account.name}: ${row.sign === 'negative' ? 'negative' : 'positive'}, tap to switch`}
                      aria-pressed={row.sign === 'negative'}
                      onClick={() => {
                        setRow(account, {
                          sign: row.sign === 'negative' ? 'positive' : 'negative',
                        });
                      }}
                      className="h-10 w-10 shrink-0 rounded-xl bg-subtle text-lg font-semibold text-ink ring-1 ring-line"
                    >
                      {row.sign === 'negative' ? '−' : '+'}
                    </button>
                    <input
                      id={amountId}
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.amount}
                      placeholder={last ? minorToInput(last.amountMinor, account.currency) : '0.00'}
                      onChange={(e) => {
                        setRow(account, { amount: e.target.value });
                      }}
                      className={`${inputClass} text-right tabular-nums`}
                    />
                    <span className="w-10 shrink-0 text-xs text-ink-muted">{account.currency}</span>
                    {last && (
                      <button
                        type="button"
                        aria-label={`Same as last for ${account.name}`}
                        onClick={() => {
                          setRow(account, {
                            amount: minorToInput(last.amountMinor, account.currency),
                            sign: signOf(last.amountMinor),
                          });
                        }}
                        className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft"
                      >
                        Same
                      </button>
                    )}
                  </div>
                  {row.touched && !result.ok && (
                    <p role="alert" className="mt-1 text-sm text-danger">
                      {result.error}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:bottom-0">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            {errors > 0
              ? `Fix ${String(errors)} ${errors === 1 ? 'amount' : 'amounts'} first.`
              : `${String(pending.length)} of ${String(accounts.length)} ready to save`}
          </p>
          <button
            type="button"
            disabled={pending.length === 0 || errors > 0 || !dateOk || save.isPending}
            onClick={() => void onSave()}
            className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-strong disabled:opacity-50"
          >
            {save.isPending
              ? 'Saving…'
              : `Save ${String(pending.length)} ${pending.length === 1 ? 'balance' : 'balances'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
