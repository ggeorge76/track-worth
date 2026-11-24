import { useId, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { defaultSign, signOf, upsertBalance, type Sign } from '@/domain/balances';
import { formatIsoDate } from '@/domain/dates';
import { formatMoney, minorToInput } from '@/domain/money';
import type { Account, BalanceEntry } from '@/domain/schema';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { checkSignedAmount } from '../amountInput';
import { Field, inputClass, SignedAmountInput } from '../formParts';

export interface UpdateBalanceSheetProps {
  account: Account;
  /** All of this account's entries (to warn when a date already has one). */
  history: readonly BalanceEntry[];
  today: string;
  /** Pre-fill from an existing entry (editing), else a new entry for today. */
  initial?: BalanceEntry | undefined;
  /** When editing an existing entry: delete it (the page offers Undo). */
  onDelete?: ((entry: BalanceEntry) => void) | undefined;
  onClose: () => void;
}

/**
 * Record a balance (R-B1). Saving on a date that already has an entry updates that entry
 * (R-B5); picking a date fills in its balance, or else the latest one before it, so it can be
 * edited rather than retyped. The sheet is mounted only while open, so its fields reset each time.
 */
export function UpdateBalanceSheet({
  account,
  history,
  today,
  initial,
  onDelete,
  onClose,
}: UpdateBalanceSheetProps) {
  const save = useUpdateDataFile();
  const ids = { date: useId(), amount: useId() };
  // The entries as they were when the sheet opened. Saving shows the new entry at once (before
  // the upload finishes), and it must not then be treated as one that was already there.
  const [historyAtOpen] = useState(history);
  const entryOn = (d: string) => historyAtOpen.find((e) => e.date === d);
  /**
   * What to fill in for a date: its own balance if it has one, else the latest balance before it
   * (balances often stay the same, so updating is a quick check rather than retyping).
   */
  const fillFor = (d: string) =>
    entryOn(d) ??
    historyAtOpen
      .filter((e) => e.date < d)
      .reduce<BalanceEntry | undefined>(
        (last, e) => (!last || e.date > last.date ? e : last),
        undefined,
      );

  const [date, setDate] = useState(initial?.date ?? today);
  const start = initial ?? fillFor(today);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [sign, setSign] = useState<Sign>(
    start ? signOf(start.amountMinor) : defaultSign(account.kind),
  );
  const [amount, setAmount] = useState(
    start ? minorToInput(start.amountMinor, account.currency) : '',
  );
  /** The amount shown was filled in and not changed by the user (so it can be swapped out). */
  const [amountIsFilled, setAmountIsFilled] = useState(!!start);
  const [error, setError] = useState<string | null>(null);

  const changeDate = (next: string) => {
    setDate(next);
    const fill = fillFor(next);
    if (fill) {
      setSign(signOf(fill.amountMinor));
      setAmount(minorToInput(fill.amountMinor, account.currency));
      setAmountIsFilled(true);
    } else if (amountIsFilled) {
      // Nothing on or before this date: clear the filled-in value, but keep what was typed.
      setSign(defaultSign(account.kind));
      setAmount('');
      setAmountIsFilled(false);
    }
  };

  const checked = checkSignedAmount(amount, sign, account.currency);
  const existing = entryOn(date);
  const preview = checked.ok ? checked.amountMinor : null;

  const onSave = async () => {
    if (!date || date > today) {
      setError('Pick a date that isn’t in the future.');
      return;
    }
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    if (preview === null) {
      setError('Enter an amount, like 1,234.50.');
      return;
    }
    setError(null);
    try {
      await save.mutateAsync((file, opts) =>
        upsertBalance(file, { accountId: account.id, date, amountMinor: preview }, opts),
      );
      onClose();
    } catch {
      // The save status banner explains what went wrong; keep the sheet open to retry.
    }
  };

  return (
    <Sheet open title={initial ? 'Edit balance' : 'Update balance'} onClose={onClose}>
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        <p className="text-sm text-ink-muted">{account.name}</p>

        <Field label="Date" htmlFor={ids.date}>
          <input
            id={ids.date}
            type="date"
            className={inputClass}
            value={date}
            max={today}
            onChange={(e) => {
              changeDate(e.target.value);
            }}
          />
          {existing && existing.id !== initial?.id && (
            <p className="text-sm text-ink-muted">
              {formatIsoDate(existing.date)} already has a balance. Saving updates it.
            </p>
          )}
        </Field>

        <Field label="Amount" htmlFor={ids.amount}>
          <SignedAmountInput
            id={ids.amount}
            currency={account.currency}
            sign={sign}
            onSignChange={setSign}
            amount={amount}
            onAmountChange={(value) => {
              setAmount(value);
              setAmountIsFilled(false);
            }}
            autoFocus
          />
          <p className="text-sm text-ink-muted" aria-live="polite">
            {preview === null ? ' ' : `Will be saved as ${formatMoney(preview, account.currency)}`}
          </p>
        </Field>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={save.isPending}
          className="w-full rounded-xl bg-brand py-3 font-medium text-white hover:bg-brand-strong disabled:opacity-60"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {initial && onDelete && (
          <div className="border-t border-line pt-4 text-center">
            {confirmingDelete ? (
              <div role="group" aria-label="Confirm delete" className="space-y-3">
                <p className="text-sm text-ink-soft">
                  Delete the balance for {formatIsoDate(initial.date)}?
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                    }}
                    className="rounded-xl border border-line-strong px-4 py-2 text-sm"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(initial);
                      onClose();
                    }}
                    className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(true);
                }}
                className="text-sm font-medium text-danger hover:underline"
              >
                Delete this entry
              </button>
            )}
          </div>
        )}
      </form>
    </Sheet>
  );
}
