import { useId, useMemo, useState } from 'react';
import { LiquidityPicker } from '@/components/LiquidityPicker';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { balanceSources, updateAccount, type AccountPatch } from '@/domain/accounts';
import { accountHistory, allEntriesHaveDefaultSign } from '@/domain/balances';
import { currencyCodes, currencyLabel } from '@/domain/currencies';
import { LIQUIDITY_LABELS, type Liquidity } from '@/domain/liquidity';
import { formatMoney, fractionDigits } from '@/domain/money';
import type { Account, AccountKind, DataFile } from '@/domain/schema';
import { availableTags } from '@/domain/tags';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { BalanceSourceInput, Field, inputClass, TagPicker } from '../formParts';

export type EditableField = 'name' | 'kind' | 'liquidity' | 'currency' | 'balanceSource' | 'note';

const TITLES: Record<EditableField, string> = {
  name: 'Name & tag',
  kind: 'Type',
  liquidity: 'Liquidity',
  currency: 'Currency',
  balanceSource: 'Balance source',
  note: 'Notes',
};

/** Edit one aspect of an account (R-C2). Mounted only while open, so fields reset each time. */
export function EditAccountSheet({
  data,
  account,
  field,
  onClose,
}: {
  data: DataFile;
  account: Account;
  field: EditableField;
  onClose: () => void;
}) {
  const save = useUpdateDataFile();
  const id = useId();
  const tags = useMemo(() => availableTags(data), [data]);
  const sources = useMemo(() => balanceSources(data.accounts), [data.accounts]);
  const currencies = useMemo(() => currencyCodes(), []);

  const history = useMemo(
    () => accountHistory(data.balances, account.id),
    [data.balances, account.id],
  );
  const [kind, setKind] = useState<AccountKind>(account.kind);
  // Pre-tick when the balances look like they were entered with the old type's default sign.
  const [flipSigns, setFlipSigns] = useState(() =>
    allEntriesHaveDefaultSign(history, account.kind),
  );
  const [name, setName] = useState(account.name);
  const [tag, setTag] = useState(account.tag);
  const [liquidity, setLiquidity] = useState(account.liquidity as Liquidity);
  const [currency, setCurrency] = useState(account.currency);
  const [balanceSource, setBalanceSource] = useState(account.balanceSource ?? '');
  const [note, setNote] = useState(account.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const patch = (): AccountPatch | null => {
    switch (field) {
      case 'name':
        if (!name.trim()) {
          setError('Give the account a name.');
          return null;
        }
        return { name, tag };
      case 'kind':
        return { kind };
      case 'liquidity':
        return { liquidity };
      case 'currency':
        return { currency };
      case 'balanceSource':
        return { balanceSource };
      case 'note':
        return { note };
    }
  };

  const onSave = async () => {
    const changes = patch();
    if (!changes) return;
    try {
      const options = { flipSigns: field === 'kind' && flipSigns };
      await save.mutateAsync((file) => updateAccount(file, account.id, changes, options));
      onClose();
    } catch {
      // The save status banner explains what went wrong.
    }
  };

  const decimalsChange = fractionDigits(currency) !== fractionDigits(account.currency);

  return (
    <Sheet open title={TITLES[field]} onClose={onClose}>
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        {field === 'name' && (
          <>
            <Field label="Name" htmlFor={id} error={error ?? undefined}>
              <input
                id={id}
                className={inputClass}
                value={name}
                maxLength={100}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                }}
              />
            </Field>
            <Field label="Tag">
              <TagPicker tags={tags} value={tag} onChange={setTag} />
            </Field>
          </>
        )}

        {field === 'kind' && (
          <>
            <Segmented
              label="Type"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'asset', label: 'Asset' },
                { value: 'liability', label: 'Liability' },
              ]}
            />
            {kind !== account.kind && history.length > 0 && (
              <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-teal-700"
                    checked={flipSigns}
                    onChange={(e) => {
                      setFlipSigns(e.target.checked);
                    }}
                  />
                  <span>
                    Also flip the sign of the{' '}
                    {history.length === 1
                      ? 'existing balance'
                      : `${String(history.length)} existing balances`}
                  </span>
                </label>
                {history[0] && (
                  <p className="pl-8 text-sm text-slate-500">
                    Current balance: {formatMoney(history[0].amountMinor, account.currency)} →{' '}
                    <span className="font-medium text-slate-700">
                      {formatMoney(
                        flipSigns ? -history[0].amountMinor || 0 : history[0].amountMinor,
                        account.currency,
                      )}
                    </span>
                  </p>
                )}
                <p className="pl-8 text-xs text-slate-500">
                  Tick this if the type was chosen wrongly and balances were saved with the wrong
                  sign. New balances will default to {kind === 'asset' ? 'positive' : 'negative'}.
                </p>
              </div>
            )}
          </>
        )}

        {field === 'liquidity' && (
          <Field label={LIQUIDITY_LABELS[liquidity]}>
            <LiquidityPicker multiple={false} selected={[liquidity]} onToggle={setLiquidity} />
          </Field>
        )}

        {field === 'currency' && (
          <Field label="Currency" htmlFor={id}>
            <select
              id={id}
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
            <p className="text-sm text-slate-500">
              Amounts keep their numbers, e.g. 1,234.50 {account.currency} becomes 1,234.50{' '}
              {currency}. No exchange rate is applied.
              {decimalsChange &&
                ' This currency uses different decimal places, so amounts are rounded.'}
            </p>
          </Field>
        )}

        {field === 'balanceSource' && (
          <Field label="Balance source" htmlFor={id}>
            <BalanceSourceInput
              id={id}
              value={balanceSource}
              onChange={setBalanceSource}
              sources={sources}
            />
            <p className="text-xs text-slate-500">
              Accounts with the same source are kept together when you swipe between accounts. Leave
              empty to remove.
            </p>
          </Field>
        )}

        {field === 'note' && (
          <Field label="Notes" htmlFor={id}>
            <textarea
              id={id}
              className={`${inputClass} min-h-32`}
              value={note}
              maxLength={2000}
              autoFocus
              placeholder="Account details, a link to your banking site, …"
              onChange={(e) => {
                setNote(e.target.value);
              }}
            />
          </Field>
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
