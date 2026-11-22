import { useId, useState, type ReactNode } from 'react';
import { Chip } from '@/components/Chip';
import { PlusIcon } from '@/components/icons';

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20';

export function Field({
  label,
  htmlFor,
  children,
  error,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : (
        <p className="text-sm font-medium text-slate-700">{label}</p>
      )}
      {children}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Pick exactly one tag from `tags`, or type a new one (emoji allowed). */
export function TagPicker({
  tags,
  value,
  onChange,
}: {
  tags: readonly string[];
  value: string | null;
  onChange: (tag: string) => void;
}) {
  const inputId = useId();
  const [extra, setExtra] = useState<string[]>(() =>
    value && !tags.some((t) => same(t, value)) ? [value] : [],
  );
  const [draft, setDraft] = useState<string | null>(null);
  const options = [...tags, ...extra.filter((t) => !tags.some((x) => same(x, t)))];

  const commit = () => {
    const tag = draft?.trim();
    setDraft(null);
    if (!tag) return;
    const existing = options.find((t) => same(t, tag));
    if (!existing) setExtra([...extra, tag]);
    onChange(existing ?? tag);
  };

  return (
    <div role="radiogroup" aria-label="Tag" className="flex flex-wrap gap-2">
      {options.map((t) => (
        <Chip
          key={t}
          pressed={value === t}
          onClick={() => {
            onChange(t);
          }}
        >
          {t}
        </Chip>
      ))}
      {draft === null ? (
        <button
          type="button"
          onClick={() => {
            setDraft('');
          }}
          className="flex items-center gap-1 rounded-full border border-dashed border-slate-400 px-3 py-1.5 text-sm text-slate-600"
        >
          <PlusIcon width={16} height={16} /> New tag
        </button>
      ) : (
        <span className="flex items-center gap-1">
          <label htmlFor={inputId} className="sr-only">
            New tag
          </label>
          <input
            id={inputId}
            autoFocus
            maxLength={40}
            value={draft}
            placeholder="e.g. 🪙 Gold"
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm"
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                setDraft(null);
              }
            }}
          />
          <button type="button" onClick={commit} className="px-2 text-sm font-medium text-teal-700">
            Add
          </button>
        </span>
      )}
    </div>
  );
}

/** Text input offering previously used balance sources. */
export function BalanceSourceInput({
  id,
  value,
  onChange,
  sources,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  sources: readonly string[];
}) {
  const listId = useId();
  return (
    <>
      <input
        id={id}
        className={inputClass}
        list={listId}
        value={value}
        maxLength={60}
        placeholder="Where you check this balance, e.g. HDFC NetBanking"
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
      <datalist id={listId}>
        {sources.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
