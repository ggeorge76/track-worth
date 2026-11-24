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
          ? 'border-brand bg-brand text-white'
          : 'border-line-strong bg-surface text-ink-soft hover:border-line-strong'
      }`}
    >
      {children}
    </button>
  );
}

/** Read-only pill, e.g. the tag shown on an account row. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block max-w-[12rem] truncate rounded-full border border-line bg-subtle px-2 py-0.5 text-xs text-ink-muted">
      {children}
    </span>
  );
}
