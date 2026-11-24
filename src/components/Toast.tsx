import { useEffect } from 'react';

/** A short message at the bottom of the screen, with an optional action (e.g. Undo). */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 6000,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(timer);
    };
  }, [onDismiss, durationMs]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg ring-1 ring-white/10"
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          className="shrink-0 font-medium text-accent-2 underline"
          onClick={() => {
            onAction();
            onDismiss();
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
