import { useId, useMemo, useState } from 'react';
import { goBack, navigate } from '@/app/router';
import { CloseIcon } from '@/components/icons';
import { LiquidityPicker } from '@/components/LiquidityPicker';
import { Segmented } from '@/components/Segmented';
import { balanceSources, createAccount } from '@/domain/accounts';
import { currencyCodes, currencyLabel, suggestedCurrency } from '@/domain/currencies';
import { LIQUIDITY_LABELS, type Liquidity } from '@/domain/liquidity';
import type { AccountKind, DataFile } from '@/domain/schema';
import { availableTags } from '@/domain/tags';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { BalanceSourceInput, Field, inputClass, TagPicker } from './formParts';

export function NewAccountPage({ data }: { data: DataFile }) {
  const save = useUpdateDataFile();
  const ids = {
    name: useId(),
    currency: useId(),
    source: useId(),
    sources: useId(),
    notes: useId(),
    newTag: useId(),
  };

  const tags = useMemo(() => availableTags(data), [data]);
  const sources = useMemo(() => balanceSources(data.accounts), [data.accounts]);
  const currencies = useMemo(() => currencyCodes(), []);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('asset');
  const [tag, setTag] = useState<string | null>(null);
  const [liquidity, setLiquidity] = useState<Liquidity>(3);
  const [currency, setCurrency] = useState(() =>
    suggestedCurrency(
      data.accounts.map((a) => a.currency),
      data.baseCurrency,
    ),
  );
  const [balanceSource, setBalanceSource] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ name?: string; tag?: string; form?: string }>({});

  const onSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Give the account a name.';
    if (!tag) next.tag = 'Pick a tag, or add a new one.';
    setErrors(next);
    if (next.name || next.tag || !tag) return;

    let createdId = '';
    try {
      await save.mutateAsync((file, opts) => {
        const result = createAccount(
          file,
          { name, kind, tag, liquidity, currency, note, balanceSource },
          opts,
        );
        createdId = result.account.id;
        return result.data;
      });
    } catch {
      // The save status banner explains what went wrong.
      return;
    }
    // Replace this screen so "back" from the new account returns to the start page.
    navigate({ name: 'account', id: createdId }, { replace: true });
  };

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      noValidate
      className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-4"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Cancel"
          className="rounded-full p-2 text-slate-600 hover:bg-slate-200"
        >
          <CloseIcon />
        </button>
        <h1 className="text-xl font-semibold">New account</h1>
      </div>

      <Field label="Name" htmlFor={ids.name} error={errors.name}>
        <input
          id={ids.name}
          className={inputClass}
          value={name}
          maxLength={100}
          placeholder="e.g. 💵 Savings, Home loan"
          autoFocus
          aria-invalid={!!errors.name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </Field>

      <Field label="Type">
        <Segmented
          label="Type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'asset', label: 'Asset' },
            { value: 'liability', label: 'Liability' },
          ]}
        />
      </Field>

      <Field label="Tag" error={errors.tag}>
        <TagPicker tags={tags} value={tag} onChange={setTag} />
      </Field>

      <Field label={`Liquidity: ${LIQUIDITY_LABELS[liquidity]}`}>
        <LiquidityPicker multiple={false} selected={[liquidity]} onToggle={setLiquidity} />
      </Field>

      <Field label="Currency" htmlFor={ids.currency}>
        <select
          id={ids.currency}
          className={inputClass}
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value);
          }}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {currencyLabel(c)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Balance source (optional)" htmlFor={ids.source}>
        <BalanceSourceInput
          id={ids.source}
          value={balanceSource}
          onChange={setBalanceSource}
          sources={sources}
        />
        <p className="text-xs text-slate-500">
          Accounts with the same source are kept together when you update balances.
        </p>
      </Field>

      <Field label="Notes (optional)" htmlFor={ids.notes}>
        <textarea
          id={ids.notes}
          className={`${inputClass} min-h-24`}
          value={note}
          maxLength={2000}
          onChange={(e) => {
            setNote(e.target.value);
          }}
        />
      </Field>

      <button
        type="submit"
        disabled={save.isPending}
        className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {save.isPending ? 'Saving…' : 'Create account'}
      </button>
    </form>
  );
}
