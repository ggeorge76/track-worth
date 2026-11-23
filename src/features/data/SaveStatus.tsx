import { useMutationState, useQueryClient } from '@tanstack/react-query';
import { SAVE_MUTATION_KEY, SaveError } from './useDataFile';

/**
 * "Saving…" while a change is being saved, and a message if it couldn't even be saved on this
 * device. Upload status (offline, waiting, decisions) is shown by SyncStatus.
 */
export function SaveStatus() {
  const queryClient = useQueryClient();
  const states = useMutationState({
    filters: { mutationKey: SAVE_MUTATION_KEY },
    select: (mutation) => ({ status: mutation.state.status, error: mutation.state.error }),
  });

  const saving = states.some((s) => s.status === 'pending');
  const latest = states.at(-1);
  const error = latest?.status === 'error' ? latest.error : null;

  if (error) {
    const message =
      error instanceof SaveError ? error.message : "Couldn't save your change. Please try again.";
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 bg-red-50 px-6 py-2 text-sm text-red-800"
      >
        <span>{message}</span>
        <button
          type="button"
          className="font-medium underline"
          onClick={() => {
            const cache = queryClient.getMutationCache();
            for (const m of cache.findAll({ mutationKey: SAVE_MUTATION_KEY })) cache.remove(m);
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return saving ? (
    <p role="status" className="px-6 py-1 text-xs text-slate-500">
      Saving…
    </p>
  ) : null;
}
