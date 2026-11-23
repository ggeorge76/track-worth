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
 * (R-B5). The sheet is mounted only while open, so its fields reset each time.
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
  const [date, setDate] = useState(initial?.date ?? today);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [sign, setSign] = useState<Sign>(
    initial ? signOf(initial.amountMinor) : defaultSign(account.kind),
  );
  const [amount, setAmount] = useState(
    initial ? minorToInput(initial.amountMinor, account.currency) : '',
  );
  const [error, setError] = useState<string | null>(null);

  // The entries as they were when the sheet opened. Saving shows the new entry at once (before
  // the upload finishes), and it must not then be reported as one this save "replaces".
  const [historyAtOpen] = useState(history);

  const checked = checkSignedAmount(amount, sign, account.currency);
  const existing = historyAtOpen.find((e) => e.date === date);
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
        <p className="text-sm text-slate-600">{account.name}</p>

        <Field label="Date" htmlFor={ids.date}>
          <input
            id={ids.date}
            type="date"
            className={inputClass}
            value={date}
            max={today}
            onChange={(e) => {
              setDate(e.target.value);
            }}
          />
          {existing && existing.id !== initial?.id && (
            <p className="text-sm text-amber-800">
              This replaces the {formatMoney(existing.amountMinor, account.currency)} already saved
              for {formatIsoDate(existing.date)}.
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
            onAmountChange={setAmount}
            autoFocus
          />
          <p className="text-sm text-slate-500" aria-live="polite">
            {preview === null ? ' ' : `Will be saved as ${formatMoney(preview, account.currency)}`}
          </p>
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={save.isPending}
          className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {initial && onDelete && (
          <div className="border-t border-slate-200 pt-4 text-center">
            {confirmingDelete ? (
              <div role="group" aria-label="Confirm delete" className="space-y-3">
                <p className="text-sm text-slate-700">
                  Delete the balance for {formatIsoDate(initial.date)}?
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(initial);
                      onClose();
                    }}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
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
                className="text-sm font-medium text-red-700 hover:underline"
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
