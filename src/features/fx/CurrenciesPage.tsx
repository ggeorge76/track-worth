import { useId, useState } from 'react';
import { goBack } from '@/app/router';
import { BackIcon, PencilIcon } from '@/components/icons';
import { COMMON_CURRENCIES, currencyLabel } from '@/domain/currencies';
import { formatIsoDate } from '@/domain/dates';
import { convertMinor } from '@/domain/fx';
import { formatMoney, parseMoneyInput } from '@/domain/money';
import type { DataFile } from '@/domain/schema';
import { inputClass } from '@/features/accounts/formParts';
import { useToday } from '@/app/useToday';
import { useExchangeRates, useSetRateOverride, type ExchangeRates } from './useExchangeRates';

/** Shown on the page besides the user's own account currencies. */
const LISTED = [
  ...COMMON_CURRENCIES,
  'CNY',
  'HKD',
  'NZD',
  'SAR',
  'QAR',
  'KWD',
  'SEK',
  'NOK',
  'ZAR',
  'MYR',
  'THB',
  'KRW',
];

const rateFormat = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 });

function RateRow({
  code,
  amountMinor,
  rates,
}: {
  code: string;
  amountMinor: number | null;
  rates: ExchangeRates;
}) {
  const today = useToday();
  const ids = { input: useId() };
  const setOverride = useSetRateOverride(rates.base);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const rate = rates.fx.rate(code, today); // base units per 1 `code`
  const own = rates.overrides[code];
  const value =
    rate === null || amountMinor === null
      ? null
      : convertMinor(amountMinor, rates.base, code, 1 / rate);
  const draftValue = Number(draft.replace(/,/g, ''));
  const draftOk = draft.trim() !== '' && Number.isFinite(draftValue) && draftValue > 0;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-medium text-ink">{currencyLabel(code)}</span>
          <span className="block text-xs text-ink-muted">
            {rate === null ? (
              'No rate yet'
            ) : (
              <>
                1 {code} = {rateFormat.format(rate)} {rates.base}
                {own !== undefined && (
                  <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 font-medium text-brand-ink">
                    your rate
                  </span>
                )}
              </>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-right font-semibold tabular-nums">
            {value === null ? '—' : formatMoney(value, code)}
          </span>
          <button
            type="button"
            aria-label={`Set your own rate for ${code}`}
            title="Set your own rate"
            onClick={() => {
              setDraft(rate === null ? '' : rateFormat.format(rate).replace(/,/g, ''));
              setEditing(!editing);
            }}
            className="rounded-full p-1.5 text-ink-muted hover:bg-subtle hover:text-ink"
          >
            <PencilIcon width={16} height={16} />
          </button>
        </span>
      </div>
      {editing && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draftOk) return;
            setOverride.mutate({ currency: code, value: draftValue });
            setEditing(false);
          }}
        >
          <label htmlFor={ids.input} className="text-ink-muted">
            1 {code} =
          </label>
          <input
            id={ids.input}
            inputMode="decimal"
            className={`${inputClass} w-32`}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
          />
          <span className="text-ink-muted">{rates.base}</span>
          <button
            type="submit"
            disabled={!draftOk}
            className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            Use my rate
          </button>
          {own !== undefined && (
            <button
              type="button"
              onClick={() => {
                setOverride.mutate({ currency: code, value: null });
                setEditing(false);
              }}
              className="rounded-lg px-3 py-1.5 font-medium text-brand hover:bg-brand-soft"
            >
              Use the published rate
            </button>
          )}
        </form>
      )}
    </li>
  );
}

/**
 * Exchange rates and a converter (ADR-0018): the base currency at the top with an amount to
 * convert (1 by default), and its value in common and the user's own currencies.
 */
export function CurrenciesPage({ data }: { data: DataFile }) {
  const rates = useExchangeRates(data, { always: true });
  const amountId = useId();
  const [amount, setAmount] = useState('1');
  const amountMinor = parseMoneyInput(amount, rates.base);
  const accountCurrencies = data.accounts.map((a) => a.currency);
  const codes = [...new Set([...accountCurrencies, ...LISTED])].filter((c) => c !== rates.base);
  const latest = rates.loaded?.stored?.table.latest.date;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 pb-10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="rounded-full p-2 text-ink-muted hover:bg-muted"
        >
          <BackIcon />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Currencies</h1>
      </div>

      <section className="relative mt-5 overflow-hidden rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-1 via-accent-2 to-accent-3"
        />
        <label
          htmlFor={amountId}
          className="text-xs font-semibold tracking-wider text-ink-muted uppercase"
        >
          Amount in {currencyLabel(rates.base)}
        </label>
        <input
          id={amountId}
          inputMode="decimal"
          className="mt-1 w-full bg-transparent text-4xl font-bold tracking-tight tabular-nums outline-none"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
          }}
        />
        {amountMinor === null && amount.trim() !== '' && (
          <p role="alert" className="text-sm text-danger">
            Enter an amount, like 1,234.50.
          </p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          {rates.loading
            ? 'Getting exchange rates…'
            : latest
              ? `Rates from ${formatIsoDate(latest)} · central-bank reference rates via Frankfurter`
              : (rates.loaded?.problem ?? 'No exchange rates yet.')}
        </p>
        {latest && rates.loaded?.problem && (
          <p role="note" className="mt-1 text-xs text-warn">
            {rates.loaded.problem}
          </p>
        )}
      </section>

      <ul
        aria-label="Converted amounts"
        className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line"
      >
        {codes.map((code) => (
          <RateRow key={code} code={code} amountMinor={amountMinor} rates={rates} />
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        Your own rate replaces the published one for today’s values on this device; past values keep
        the rate of their month.
      </p>
    </div>
  );
}
