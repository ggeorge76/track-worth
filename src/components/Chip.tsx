import type { ReactNode } from 'react';

/** Toggleable pill, e.g. a tag. `pressed` drives both the style and aria-pressed. */
export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        pressed
          ? 'border-teal-700 bg-teal-700 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  );
}

/** Read-only pill, e.g. the tag shown on an account row. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block max-w-[12rem] truncate rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {children}
    </span>
  );
}
