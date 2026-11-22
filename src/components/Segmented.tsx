import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` isn't plain text. */
  ariaLabel?: string;
}

/** Single-choice segmented control (radio group). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  /** Accessible name for the group. */
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-slate-200 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.ariaLabel}
          onClick={() => {
            onChange(o.value);
          }}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            o.value === value ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
