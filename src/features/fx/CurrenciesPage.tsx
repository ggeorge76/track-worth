import { useId, useState } from 'react';
import { goBack } from '@/app/router';
import { BackIcon, PencilIcon } from '@/components/icons';
import { COMMON_CURRENCIES, currencyFlag, currencyLabel } from '@/domain/currencies';
import { formatIsoDate } from '@/domain/dates';
import { convertMinor } from '@/domain/fx';
import { formatAmountInput, formatMoney, parseMoneyInput } from '@/domain/money';
import type { DataFile } from '@/domain/schema';
import { inputClass } from '@/features/accounts/formParts';
import { useToday } from '@/app/useToday';
import { useExchangeRates, useSetRateOverride, type ExchangeRates } from './useExchangeRates';

/** The currency's flag (decorative: the code and name say which currency it is). */
function Flag({ code }: { code: string }) {
  const flag = currencyFlag(code);
  return flag ? (
    <span aria-hidden="true" className="mr-2">
      {flag}
    </span>
  ) : null;
}

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

/**
 * Base-currency units per 1 `code` today, for any currency including the base itself. Rates are
 * fetched against the settings base; a different view currency uses cross rates through it.
 */
function useRateOf(rates: ExchangeRates) {
  const today = useToday();
  return (code: string) => rates.fx.rate(code, today);
}

function RateRow({
  code,
  view,
  amountMinor,
  rates,
  onSelect,
}: {
  code: string;
  /** The currency at the top of the page (for this view only). */
  view: string;
  amountMinor: number | null;
  rates: ExchangeRates;
  onSelect: (code: string, valueMinor: number) => void;
}) {
  const ids = { input: useId() };
  const rateOf = useRateOf(rates);
  const setOverride = useSetRateOverride(rates.base);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [rowRate, viewRate] = [rateOf(code), rateOf(view)];
  // 1 `code` in `view` units.
  const rate = rowRate === null || viewRate === null ? null : rowRate / viewRate;
  const own = rates.overrides[code];
  // Own rates are kept against the settings base, so they're set while viewing that.
  const canSetOwn = view === rates.base && code !== rates.base;
  const value =
    rate === null || amountMinor === null ? null : convertMinor(amountMinor, view, code, 1 / rate);
  const draftValue = Number(draft.replace(/,/g, ''));
  const draftOk = draft.trim() !== '' && Number.isFinite(draftValue) && draftValue > 0;

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          disabled={value === null}
          aria-label={`Show amounts in ${code}`}
          title={`Show amounts in ${code}`}
          onClick={() => {
            if (value !== null) onSelect(code, value);
          }}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span className="min-w-0">
            <span className="block font-medium text-ink">
              <Flag code={code} />
              {currencyLabel(code)}
            </span>
            <span className="block text-xs text-ink-muted">
              {rate === null ? (
                'No rate yet'
              ) : (
                <>
                  1 {code} = {rateFormat.format(rate)} {view}
                  {own !== undefined && view === rates.base && (
                    <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 font-medium text-brand-ink">
                      your rate
                    </span>
                  )}
                </>
              )}
            </span>
          </span>
          <span className="shrink-0 text-right font-semibold tabular-nums">
            {value === null ? '—' : formatMoney(value, code)}
          </span>
        </button>
        {canSetOwn && (
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
        )}
      </div>
      {editing && canSetOwn && (
        <form
          className="flex flex-wrap items-center gap-2 px-4 pb-3 text-sm"
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
 * Exchange rates and a converter (ADR-0018): a currency at the top with an amount to convert (the
 * base currency and 1 at first), and its value in common and the user's own currencies. Tapping a
 * currency moves it to the top with the amount it showed, for this view only (Settings keep the
 * base currency).
 */
export function CurrenciesPage({ data }: { data: DataFile }) {
  const rates = useExchangeRates(data, { always: true });
  const rateOf = useRateOf(rates);
  const amountId = useId();
  const [view, setView] = useState<string | null>(null);
  const [amount, setAmount] = useState('1');
  const top = view ?? rates.base;
  const amountMinor = parseMoneyInput(amount, top);
  const accountCurrencies = data.accounts.map((a) => a.currency);
  const codes = [...new Set([rates.base, ...accountCurrencies, ...LISTED])].filter(
    (c) => c !== top,
  );
  const latest = rates.loaded?.stored?.table.latest.date;
  /** The top amount in the settings base currency (for "Back to …"). */
  const convertBack = (minor: number) => {
    const r = rateOf(top);
    return r === null ? null : convertMinor(minor, top, rates.base, r);
  };
  const select = (code: string, valueMinor: number) => {
    setView(code === rates.base ? null : code);
    setAmount(formatAmountInput(valueMinor, code));
  };

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
        <div className="flex items-start justify-between gap-3">
          <label
            htmlFor={amountId}
            className="text-xs font-semibold tracking-wider text-ink-muted uppercase"
          >
            <Flag code={top} />
            Amount in {currencyLabel(top)}
          </label>
          {view !== null && (
            <button
              type="button"
              onClick={() => {
                const back = amountMinor === null ? null : convertBack(amountMinor);
                setView(null);
                setAmount(back === null ? '1' : formatAmountInput(back, rates.base));
              }}
              className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink hover:bg-brand hover:text-white"
            >
              Back to {rates.base}
            </button>
          )}
        </div>
        <input
          id={amountId}
          inputMode="decimal"
          className="mt-1 w-full bg-transparent text-4xl font-bold tracking-tight tabular-nums outline-none"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
          }}
          onBlur={() => {
            // Show what was typed grouped the reader's way (10,00,000), once they're done.
            if (amountMinor !== null) setAmount(formatAmountInput(amountMinor, top));
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
          <RateRow
            key={code}
            code={code}
            view={top}
            amountMinor={amountMinor}
            rates={rates}
            onSelect={select}
          />
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        Tap a currency to convert from it instead (just here; your base currency stays {rates.base}
        ). Your own rate replaces the published one for today’s values on this device; past values
        keep the rate of their month.
      </p>
    </div>
  );
}
