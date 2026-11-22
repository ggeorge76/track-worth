import { useId, useState } from 'react';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { defaultSign, signedAmount, signOf, upsertBalance, type Sign } from '@/domain/balances';
import { formatIsoDate } from '@/domain/dates';
import { formatMoney, minorToInput, parseMoneyInput } from '@/domain/money';
import type { Account, BalanceEntry } from '@/domain/schema';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { Field, inputClass } from '../formParts';

export interface UpdateBalanceSheetProps {
  account: Account;
  /** All of this account's entries (to warn when a date already has one). */
  history: readonly BalanceEntry[];
  today: string;
  /** Pre-fill from an existing entry (editing), else a new entry for today. */
  initial?: BalanceEntry | undefined;
  onClose: () => void;
}

function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  );
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
  onClose,
}: UpdateBalanceSheetProps) {
  const save = useUpdateDataFile();
  const ids = { date: useId(), amount: useId() };
  const [date, setDate] = useState(initial?.date ?? today);
  const [sign, setSign] = useState<Sign>(
    initial ? signOf(initial.amountMinor) : defaultSign(account.kind),
  );
  const [amount, setAmount] = useState(
    initial ? minorToInput(initial.amountMinor, account.currency) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const magnitude = amount.trim() === '' ? null : parseMoneyInput(amount, account.currency);
  const existing = history.find((e) => e.date === date);
  const preview = magnitude === null ? null : signedAmount(magnitude, sign);

  const onSave = async () => {
    if (!date || date > today) {
      setError('Pick a date that isn’t in the future.');
      return;
    }
    if (amount.trim().startsWith('-')) {
      setError('Type the amount without a minus sign, and choose − above.');
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
          {existing && existing !== initial && (
            <p className="text-sm text-amber-800">
              This replaces the {formatMoney(existing.amountMinor, account.currency)} already saved
              for {formatIsoDate(existing.date)}.
            </p>
          )}
        </Field>

        <Field label="Amount" htmlFor={ids.amount}>
          <div className="flex gap-2">
            <div className="w-28 shrink-0">
              <Segmented
                label="Positive or negative"
                value={sign}
                onChange={setSign}
                options={[
                  { value: 'positive', label: '+', ariaLabel: 'Positive' },
                  { value: 'negative', label: '−', ariaLabel: 'Negative' },
                ]}
              />
            </div>
            <div className="relative flex-1">
              <input
                id={ids.amount}
                className={`${inputClass} pr-16 text-right tabular-nums`}
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder="0.00"
                value={amount}
                aria-describedby={`${ids.amount}-currency`}
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
              />
              <span
                id={`${ids.amount}-currency`}
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500"
              >
                {currencySymbol(account.currency)} {account.currency}
              </span>
            </div>
          </div>
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
      </form>
    </Sheet>
  );
}
