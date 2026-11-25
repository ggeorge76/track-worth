import { useId, useState } from 'react';
import { HistoryIcon, UploadIcon } from '@/components/icons';
import { formatIsoDate } from '@/domain/dates';
import { parseHistoryCsv, replaceNetWorthHistory } from '@/domain/history';
import { formatMoney } from '@/domain/money';
import type { DataFile } from '@/domain/schema';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { inputClass } from '../accounts/formParts';
import { SettingsCard } from './SettingsCard';

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
  const ids = { currency: useId(), file: useId(), text: useId() };
  const choices = currencyChoices(data);
  const [currency, setCurrency] = useState(choices[0] ?? data.baseCurrency);
  const [text, setText] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const load = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setDone(null);
    void file.text().then(setText);
  };

  const parsed = text.trim() === '' ? null : parseHistoryCsv(text, currency);
  const imported = data.netWorthHistory
    .filter((p) => p.currency === currency)
    .sort((a, b) => b.date.localeCompare(a.date));
  const existing = imported.length;
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
    <SettingsCard
      icon={<HistoryIcon />}
      tone="amber"
      title={
        <>
          Import earlier net-worth history{' '}
          <span className="ml-1 rounded-full bg-warn-soft px-2 py-0.5 align-middle text-xs font-medium text-warn">
            Debug builds only
          </span>
        </>
      }
      description="A CSV with a “Month” column (e.g. April-2011) and a “Closing Worth” column. Each month’s closing worth is shown on the net-worth chart before your first account entry."
      className="border border-dashed border-warn/50"
    >
      <div>
        <label htmlFor={ids.currency} className="mb-1 block text-sm font-medium text-ink-soft">
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
      </div>

      {/* The whole box is the file picker's label, so clicking anywhere opens it; files can also
          be dropped on it (this needs `dragDropEnabled: false` in tauri.conf.json, otherwise the
          desktop window takes the drop). The input is visually hidden but keyboard-focusable. */}
      <label
        htmlFor={ids.file}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          load(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition focus-within:ring-2 focus-within:ring-brand ${
          dragging
            ? 'border-brand bg-brand-soft'
            : 'border-line-strong bg-subtle hover:border-brand hover:bg-brand-soft'
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-brand shadow-sm ring-1 ring-line">
          <UploadIcon />
        </span>
        <span className="font-semibold text-brand">
          {fileName ? 'Choose a different file' : 'Choose a CSV file'}
        </span>
        <span className="text-xs text-ink-muted">
          {fileName ? `Loaded ${fileName}` : 'or drag it here'}
        </span>
        <input
          id={ids.file}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="sr-only"
          onChange={(e) => {
            load(e.target.files?.[0]);
          }}
        />
      </label>

      <details className="group text-sm" open={text !== '' && !fileName}>
        <summary className="cursor-pointer font-medium text-ink-muted hover:text-ink">
          Or paste the CSV text
        </summary>
        <label htmlFor={ids.text} className="sr-only">
          Or paste it here
        </label>
        <textarea
          id={ids.text}
          rows={4}
          className={`${inputClass} mt-2 font-mono text-xs`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
            setDone(null);
          }}
        />
      </details>

      {parsed && !parsed.ok && (
        <p role="alert" className="text-sm text-danger">
          {parsed.error}
        </p>
      )}
      {parsed?.ok && (
        <div
          className="space-y-1 rounded-xl bg-subtle p-3 text-sm text-ink-soft ring-1 ring-line"
          aria-label="Preview"
        >
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
            className="mt-2 rounded-xl bg-brand px-4 py-2 font-semibold text-white shadow-sm hover:bg-brand-strong disabled:opacity-60"
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
      {existing > 0 && (
        <details className="rounded-xl bg-subtle ring-1 ring-line">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink">
            View the imported {months(existing)} in {currency}
          </summary>
          <div className="max-h-80 overflow-y-auto border-t border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Imported net worth in {currency}, newest first</caption>
              <thead className="sticky top-0 bg-subtle text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">
                    Month end
                  </th>
                  <th scope="col" className="px-3 py-1.5 text-right font-medium">
                    Net worth
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {imported.map((point) => (
                  <tr key={point.date}>
                    <td className="px-3 py-1.5 text-ink-soft">{formatIsoDate(point.date)}</td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${point.amountMinor < 0 ? 'text-negative' : ''}`}
                    >
                      {formatMoney(point.amountMinor, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {done && (
        <p role="status" className="text-sm text-positive">
          {done}
        </p>
      )}
    </SettingsCard>
  );
}
