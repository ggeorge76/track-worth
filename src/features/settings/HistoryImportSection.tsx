import { useId, useState } from 'react';
import { formatIsoDate } from '@/domain/dates';
import { parseHistoryCsv, replaceNetWorthHistory } from '@/domain/history';
import { formatMoney } from '@/domain/money';
import type { DataFile } from '@/domain/schema';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { inputClass } from '../accounts/formParts';

/** Currencies to offer: those of the accounts (most used first), then the base currency. */
function currencyChoices(data: DataFile): string[] {
  const counts = new Map<string, number>();
  for (const a of data.accounts) counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1);
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  return [...new Set([...used, data.baseCurrency])];
}

/**
 * One-time import of earlier monthly net-worth totals from a spreadsheet CSV (ADR-0017).
 * Development builds only, until the full importer (#2) replaces it.
 */
export function HistoryImportSection({ data }: { data: DataFile }) {
  const save = useUpdateDataFile();
  const ids = { heading: useId(), currency: useId(), file: useId(), text: useId() };
  const choices = currencyChoices(data);
  const [currency, setCurrency] = useState(choices[0] ?? data.baseCurrency);
  const [text, setText] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const parsed = text.trim() === '' ? null : parseHistoryCsv(text, currency);
  const existing = data.netWorthHistory.filter((p) => p.currency === currency).length;
  const months = (n: number) => `${String(n)} ${n === 1 ? 'month' : 'months'}`;

  const run = (change: (file: DataFile) => DataFile, message: string) => {
    setDone(null);
    save.mutate((file) => change(file), {
      onSuccess: () => {
        setDone(message);
      },
    });
  };

  return (
    <section
      aria-labelledby={ids.heading}
      className="mt-4 space-y-3 rounded-2xl bg-surface p-4 border border-dashed border-warn/50"
    >
      <h2 id={ids.heading} className="font-medium">
        Import earlier net-worth history{' '}
        <span className="text-xs font-normal text-warn">(development build only)</span>
      </h2>
      <p className="text-sm text-ink-muted">
        A CSV with a “Month” column (e.g. April-2011) and a “Closing Worth” column. Each month’s
        closing worth is saved for its last day and shown on the net-worth chart before your first
        account entry.
      </p>

      <label htmlFor={ids.currency} className="block text-sm text-ink-soft">
        Currency
      </label>
      <select
        id={ids.currency}
        className={inputClass}
        value={currency}
        onChange={(e) => {
          setCurrency(e.target.value);
        }}
      >
        {choices.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label htmlFor={ids.file} className="block text-sm text-ink-soft">
        CSV file
      </label>
      <input
        id={ids.file}
        type="file"
        accept=".csv,text/csv"
        className="block text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void file.text().then(setText);
        }}
      />
      <label htmlFor={ids.text} className="block text-sm text-ink-soft">
        Or paste it here
      </label>
      <textarea
        id={ids.text}
        rows={4}
        className={`${inputClass} font-mono text-xs`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDone(null);
        }}
      />

      {parsed && !parsed.ok && (
        <p role="alert" className="text-sm text-danger">
          {parsed.error}
        </p>
      )}
      {parsed?.ok && (
        <div className="space-y-1 text-sm text-ink-soft" aria-label="Preview">
          <p>
            {parsed.points.length} months, {formatIsoDate(parsed.points[0]?.date ?? '')} –{' '}
            {formatIsoDate(parsed.points.at(-1)?.date ?? '')}: from{' '}
            {formatMoney(parsed.points[0]?.amountMinor ?? 0, currency)} to{' '}
            {formatMoney(parsed.points.at(-1)?.amountMinor ?? 0, currency)}.
          </p>
          {parsed.notes.map((note) => (
            <p key={note} className="text-warn">
              {note}
            </p>
          ))}
          {existing > 0 && (
            <p>
              This replaces the {months(existing)} already imported in {currency}.
            </p>
          )}
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              run(
                (file) => replaceNetWorthHistory(file, currency, parsed.points),
                `Imported ${String(parsed.points.length)} months.`,
              );
            }}
            className="mt-2 rounded-xl bg-brand px-4 py-2 font-medium text-white hover:bg-brand-strong disabled:opacity-60"
          >
            Import {parsed.points.length} months
          </button>
        </div>
      )}
      {!parsed && existing > 0 && (
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            run(
              (file) => replaceNetWorthHistory(file, currency, []),
              `Removed the earlier history in ${currency}.`,
            );
          }}
          className="text-sm font-medium text-danger underline"
        >
          Remove the imported {months(existing)} in {currency}
        </button>
      )}
      {done && (
        <p role="status" className="text-sm text-positive">
          {done}
        </p>
      )}
    </section>
  );
}
