import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { formatIsoDate, monthNames } from '@/domain/dates';
import { LIQUIDITY_LABELS, type Liquidity } from '@/domain/liquidity';
import type { Account } from '@/domain/schema';
import type { Choice, MergeQuestion, SettingsPart } from '@/domain/sync/merge';
import { useResolveSync } from './useDataFile';

type Row = { label: string; local: string; remote: string };

const ACCOUNT_FIELDS: { key: keyof Account; label: string; show: (a: Account) => string }[] = [
  { key: 'name', label: 'Name', show: (a) => a.name },
  { key: 'tag', label: 'Tag', show: (a) => a.tag },
  { key: 'kind', label: 'Type', show: (a) => (a.kind === 'asset' ? 'Asset' : 'Liability') },
  { key: 'liquidity', label: 'Liquidity', show: (a) => LIQUIDITY_LABELS[a.liquidity as Liquidity] },
  { key: 'currency', label: 'Currency', show: (a) => a.currency },
  { key: 'balanceSource', label: 'Balance source', show: (a) => a.balanceSource ?? '—' },
  { key: 'note', label: 'Notes', show: (a) => a.note ?? '—' },
  { key: 'archived', label: 'Archived', show: (a) => (a.archived ? 'Yes' : 'No') },
];

function accountRows(local: Account | undefined, remote: Account | undefined): Row[] {
  if (!local || !remote) {
    return [
      { label: 'Account', local: local ? 'Kept' : 'Removed', remote: remote ? 'Kept' : 'Removed' },
    ];
  }
  return ACCOUNT_FIELDS.filter(
    (f) => JSON.stringify(local[f.key]) !== JSON.stringify(remote[f.key]),
  ).map((f) => ({
    label: f.label,
    local: f.show(local),
    remote: f.show(remote),
  }));
}

function historySummary(history: SettingsPart['netWorthHistory']): string {
  const dates = history.map((p) => p.date).sort();
  const [first, last] = [dates[0], dates.at(-1)];
  return first && last
    ? `${String(history.length)} months, ${formatIsoDate(first)} – ${formatIsoDate(last)}`
    : '—';
}

function settingsRows(local: SettingsPart, remote: SettingsPart): Row[] {
  const months = monthNames();
  const rows: Row[] = [
    {
      label: 'Financial year starts in',
      local: months[local.settings.financialYearStartMonth - 1] ?? '',
      remote: months[remote.settings.financialYearStartMonth - 1] ?? '',
    },
    { label: 'Base currency', local: local.baseCurrency, remote: remote.baseCurrency },
    {
      label: 'Earlier net-worth history',
      local: historySummary(local.netWorthHistory),
      remote: historySummary(remote.netWorthHistory),
    },
    {
      label: 'Custom tags',
      local: local.settings.customTags.join(', ') || '—',
      remote: remote.settings.customTags.join(', ') || '—',
    },
  ];
  return rows.filter((r) => r.local !== r.remote);
}

const keyOf = (q: MergeQuestion) => (q.kind === 'account' ? q.id : 'settings');
const titleOf = (q: MergeQuestion) =>
  q.kind === 'account' ? `Account: ${q.local?.name ?? q.remote?.name ?? ''}` : 'Settings';

/**
 * Both this device and Google Drive changed the same account(s) or settings while offline.
 * For each, keep this device's version or Drive's: never a field-by-field merge (ADR-0015).
 */
export function ConflictSheet({
  questions,
  onClose,
}: {
  questions: MergeQuestion[];
  onClose: () => void;
}) {
  const resolve = useResolveSync();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const complete = questions.every((q) => choices[keyOf(q)]);

  return (
    <Sheet open title="Choose what to keep" onClose={onClose}>
      <p className="text-sm text-ink-muted">
        These were changed both on this device and in Google Drive. Balances have already been
        combined automatically. For each item below, keep one version.
      </p>
      <div className="mt-4 space-y-5">
        {questions.map((q) => {
          const key = keyOf(q);
          const rows =
            q.kind === 'account' ? accountRows(q.local, q.remote) : settingsRows(q.local, q.remote);
          return (
            <fieldset key={key} className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
              <legend className="px-1 font-medium">{titleOf(q)}</legend>
              <table className="mt-1 w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="py-1 font-normal" scope="col">
                      <span className="sr-only">Field</span>
                    </th>
                    <th className="py-1 font-normal" scope="col">
                      This device
                    </th>
                    <th className="py-1 font-normal" scope="col">
                      Google Drive
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-t border-line align-top">
                      <th scope="row" className="py-1 pr-2 text-left font-normal text-ink-muted">
                        {r.label}
                      </th>
                      <td className="py-1 pr-2 break-words">{r.local}</td>
                      <td className="py-1 break-words">{r.remote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                role="radiogroup"
                aria-label={`${titleOf(q)}: version to keep`}
                className="mt-3 flex flex-wrap gap-2"
              >
                {(['local', 'remote'] as const).map((choice) => (
                  <label
                    key={choice}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                      choices[key] === choice
                        ? 'border-brand bg-brand-soft'
                        : 'border-line-strong bg-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`choice-${key}`}
                      className="accent-brand"
                      checked={choices[key] === choice}
                      onChange={() => {
                        setChoices({ ...choices, [key]: choice });
                      }}
                    />
                    {choice === 'local' ? 'Keep this device’s' : 'Keep Google Drive’s'}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!complete || resolve.isPending}
        onClick={() => {
          resolve.mutate(choices, { onSuccess: onClose });
        }}
        className="mt-6 w-full rounded-xl bg-brand py-3 font-medium text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {resolve.isPending ? 'Saving…' : 'Apply and upload'}
      </button>
    </Sheet>
  );
}
