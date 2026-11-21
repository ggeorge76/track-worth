import { openUrl } from '@tauri-apps/plugin-opener';
import { releaseNotesUrl } from '@/config';
import { useAppUpdate } from './useAppUpdate';

/** Non-blocking banner offering a new release. Nothing changes until the user confirms. */
export function UpdatePrompt() {
  const { update, phase, progress, apply, dismiss } = useAppUpdate();

  if (!update) return null;

  const busy = phase === 'installing' || phase === 'restarting';
  const status =
    phase === 'installing'
      ? progress === null
        ? 'Downloading…'
        : `Downloading… ${Math.round(progress * 100)}%`
      : phase === 'restarting'
        ? 'Restarting…'
        : null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Update available"
      className="fixed inset-x-4 bottom-4 mx-auto max-w-md space-y-3 rounded-lg bg-slate-900 p-4 text-white shadow-lg"
    >
      <p>
        TrackWorth {update.version} is available.{' '}
        <button
          type="button"
          className="underline"
          onClick={() => void openUrl(releaseNotesUrl(update.version))}
        >
          What’s new
        </button>
      </p>
      {status && <p className="text-sm text-slate-300">{status}</p>}
      {phase === 'failed' && (
        <p role="alert" className="text-sm text-amber-300">
          The update couldn’t be installed. Please try again later.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-3 py-1 text-slate-300 disabled:opacity-60"
          onClick={dismiss}
          disabled={busy}
        >
          Later
        </button>
        <button
          type="button"
          className="rounded bg-teal-600 px-3 py-1 font-medium disabled:opacity-60"
          onClick={() => void apply()}
          disabled={busy}
        >
          {phase === 'failed' ? 'Try again' : 'Update and restart'}
        </button>
      </div>
    </div>
  );
}
