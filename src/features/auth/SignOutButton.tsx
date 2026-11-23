import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { DATA_FILE_KEY, type LoadedDataFile } from '@/features/data/useDataFile';
import { useAuth } from './authContext';

/**
 * Signs out. Signing out deletes this device's copy, so if changes are still waiting to upload
 * it asks first (ADR-0015).
 */
export function SignOutButton() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [waiting, setWaiting] = useState(0);

  const onClick = () => {
    const pending = queryClient.getQueryData<LoadedDataFile>(DATA_FILE_KEY)?.pending ?? 0;
    if (pending > 0) setWaiting(pending);
    else void signOut();
  };

  return (
    <>
      <button type="button" onClick={onClick} className="text-slate-500 hover:text-slate-900">
        Sign out
      </button>
      {waiting > 0 && (
        <Sheet
          open
          title="Sign out and lose changes?"
          onClose={() => {
            setWaiting(0);
          }}
        >
          <p className="text-slate-700">
            {waiting === 1 ? '1 change hasn’t' : `${String(waiting)} changes haven’t`} been uploaded
            to Google Drive yet. Signing out deletes {waiting === 1 ? 'it' : 'them'} from this
            device.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            To keep {waiting === 1 ? 'it' : 'them'}, stay signed in until you’re back online and the
            upload finishes.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              autoFocus
              onClick={() => {
                setWaiting(0);
              }}
              className="flex-1 rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
            >
              Stay signed in
            </button>
            <button
              type="button"
              onClick={() => {
                setWaiting(0);
                void signOut();
              }}
              className="flex-1 rounded-xl border border-red-300 py-3 font-medium text-red-700 hover:bg-red-50"
            >
              Sign out anyway
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
