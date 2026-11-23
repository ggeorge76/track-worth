import { useState } from 'react';
import { useAuth } from '@/features/auth/authContext';
import { ConflictSheet } from './ConflictSheet';
import { useDataFile } from './useDataFile';

const changes = (n: number) => (n === 1 ? '1 change' : `${String(n)} changes`);

/**
 * One line under the header saying whether everything is uploaded (ADR-0015): offline, changes
 * waiting to upload, an upload problem being retried, or a decision needed.
 */
export function SyncStatus() {
  const { state: auth } = useAuth();
  const query = useDataFile();
  const [reviewing, setReviewing] = useState(false);
  const sync = query.data;

  const offline = sync?.offline === true || (auth.status === 'signed-in' && auth.offline === true);
  const pending = sync?.pending ?? 0;

  let tone = 'bg-amber-50 text-amber-900';
  let message: React.ReactNode = null;
  let action: 'retry' | 'review' | null = 'retry';
  if (sync?.decision) {
    tone = 'bg-sky-50 text-sky-900';
    message = (
      <>
        <strong className="font-medium">Needs your decision.</strong> Some things were changed both
        on this device and in Google Drive.
      </>
    );
    action = 'review';
  } else if (offline && pending > 0) {
    message = (
      <>
        <strong className="font-medium">Offline.</strong> {changes(pending)} saved on this device,
        waiting to upload.
      </>
    );
  } else if (offline) {
    message = (
      <>
        <strong className="font-medium">Offline.</strong> Showing the data saved on this device.
        Changes you make are kept here and uploaded when you’re back online.
      </>
    );
  } else if (pending > 0) {
    message = (
      <>
        {changes(pending)} waiting to upload. {sync?.uploadError ?? ''}
      </>
    );
  } else {
    action = null;
  }

  if (!message) return null;

  return (
    <>
      <div
        role="status"
        className={`flex items-center justify-between gap-3 px-6 py-2 text-sm ${tone}`}
      >
        <span>{message}</span>
        {action === 'review' ? (
          <button
            type="button"
            className="shrink-0 font-medium underline"
            onClick={() => {
              setReviewing(true);
            }}
          >
            Review
          </button>
        ) : (
          action === 'retry' && (
            <button
              type="button"
              className="shrink-0 font-medium underline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? 'Trying…' : 'Try again'}
            </button>
          )
        )}
      </div>
      {reviewing && sync?.decision && (
        <ConflictSheet
          questions={sync.decision.questions}
          onClose={() => {
            setReviewing(false);
          }}
        />
      )}
    </>
  );
}
