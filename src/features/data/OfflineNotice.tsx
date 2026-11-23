import { useAuth } from '@/features/auth/authContext';
import { useDataFile } from './useDataFile';

/** Shown while Google Drive can't be reached and the app is showing the device's copy (ADR-0015). */
export function OfflineNotice() {
  const { state } = useAuth();
  const query = useDataFile();
  const offline =
    query.data?.offline === true || (state.status === 'signed-in' && state.offline === true);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 bg-amber-50 px-6 py-2 text-sm text-amber-900"
    >
      <span>
        <strong className="font-medium">Offline.</strong> Showing the data saved on this device.
        Changes can’t be saved until you’re back online.
      </span>
      <button
        type="button"
        className="shrink-0 font-medium underline"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        {query.isFetching ? 'Trying…' : 'Try again'}
      </button>
    </div>
  );
}
