import { formatIsoDate } from '@/domain/dates';
import { formatPercent, formatSignedMoney, percentChange } from '@/domain/money';
import type { BalanceChange } from '@/domain/stats';

export function DeltaBadge({
  deltaMinor,
  baseMinor,
  currency,
}: {
  deltaMinor: number;
  baseMinor?: number;
  currency: string;
}) {
  const pct = baseMinor === undefined ? null : percentChange(deltaMinor, baseMinor);
  const tone =
    deltaMinor > 0
      ? 'bg-positive-soft text-positive'
      : deltaMinor < 0
        ? 'bg-negative-soft text-negative'
        : 'bg-subtle text-ink-muted';
  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs tabular-nums ${tone}`}>
      {formatSignedMoney(deltaMinor, currency)}
      {pct !== null && ` · ${formatPercent(pct)}`}
    </span>
  );
}

function ChangeRow({
  label,
  change,
  currency,
}: {
  label: string;
  change: BalanceChange | undefined;
  currency: string;
}) {
  const pct = change ? percentChange(change.deltaMinor, change.base.amountMinor) : null;
  const tone =
    !change || change.deltaMinor === 0
      ? 'text-ink-muted'
      : change.deltaMinor > 0
        ? 'text-positive'
        : 'text-negative';
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt>
        <span className="block text-sm text-ink-soft">{label}</span>
        <span className="block text-xs text-ink-muted">
          {change ? `vs ${formatIsoDate(change.base.date)}` : 'No earlier entry'}
        </span>
      </dt>
      <dd className={`text-right tabular-nums ${tone}`}>
        {change ? (
          <>
            <span className="block font-medium">
              {formatSignedMoney(change.deltaMinor, currency)}
            </span>
            {pct !== null && <span className="block text-xs">{formatPercent(pct)}</span>}
          </>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </dd>
    </div>
  );
}

/** Change since the previous entry, the previous month and the previous financial year (R-V2). */
export function ChangeSummary({
  sincePrevious,
  sincePreviousMonth,
  sincePreviousFinancialYear,
  currency,
}: {
  sincePrevious: BalanceChange | undefined;
  sincePreviousMonth: BalanceChange | undefined;
  sincePreviousFinancialYear: BalanceChange | undefined;
  currency: string;
}) {
  return (
    <dl
      aria-label="Changes"
      className="mt-5 divide-y divide-line rounded-2xl bg-surface shadow-sm ring-1 ring-line"
    >
      <ChangeRow label="Since last entry" change={sincePrevious} currency={currency} />
      <ChangeRow label="This month" change={sincePreviousMonth} currency={currency} />
      <ChangeRow
        label="This financial year"
        change={sincePreviousFinancialYear}
        currency={currency}
      />
    </dl>
  );
}
