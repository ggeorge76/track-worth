import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useToday } from '@/app/useToday';
import { WalletIcon } from '@/components/icons';
import { formatIsoDate } from '@/domain/dates';
import { exportFileName, toBackupJson } from '@/domain/export';
import { isSampleData, sampleDataFile } from '@/domain/sampleData';
import type { DataFile } from '@/domain/schema';
import { useAuth } from '@/features/auth/authContext';
import {
  DATA_FILE_KEY,
  useDataFile,
  useUpdateDataFile,
  type LoadedDataFile,
} from '@/features/data/useDataFile';
import { createDriveClient } from '@/services/drive/driveClient';
import { saveExport } from '@/services/export/saveExport';
import { sameData } from '@/services/storage/dataStore';
import {
  createSampleBackups,
  SAMPLE_BACKUP_FOLDER,
  type BackupInfo,
} from '@/services/storage/sampleBackup';
import { SettingsCard } from './SettingsCard';

const when = (b: BackupInfo) =>
  `${formatIsoDate(b.takenAt.slice(0, 10))}, ${b.takenAt.slice(11, 16)} UTC`;

/**
 * Swaps in made-up data for screenshots, and back (development builds only).
 * - Loading writes a new, verified backup of the real data to Drive first (never overwriting one).
 * - Restore is offered only while sample data is showing, so a leftover backup can never
 *   overwrite real data. It writes the latest backup back, checks the result, and only then
 *   moves that backup to Drive's trash.
 * - Any backup can also be saved to the device, as a fallback.
 */
export function SampleDataSection({ data }: { data: DataFile }) {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const save = useUpdateDataFile();
  const today = useToday();
  const state = useDataFile().data;
  const rootId = state?.synced.snapshot.rootId;
  const backups = useMemo(
    () => createSampleBackups(createDriveClient({ getAccessToken })),
    [getAccessToken],
  );
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const listed = useQuery({
    queryKey: ['sample-backups', rootId],
    enabled: rootId !== undefined,
    networkMode: 'always',
    retry: false,
    queryFn: () => backups.list(rootId as string),
  });
  const latest = listed.data?.at(-1);
  const showingSample = isSampleData(data);
  // Swapping everything needs a settled, online state: nothing waiting to upload or to decide.
  const ready =
    !!state && !state.offline && state.pending === 0 && !state.decision && rootId !== undefined;

  const run = useMutation({
    networkMode: 'always',
    mutationFn: async (
      action: { kind: 'load' } | { kind: 'restore' | 'remove' | 'download'; backup: BackupInfo },
    ): Promise<string> => {
      if (!rootId) throw new Error('Your data is still loading.');
      switch (action.kind) {
        case 'load':
          await backups.save(rootId, data, new Date());
          await save.mutateAsync((file) => sampleDataFile(today, file));
          return 'Sample data is showing. Your data is backed up.';
        case 'restore': {
          const real = await backups.load(action.backup.id);
          await save.mutateAsync(() => real);
          const after = queryClient.getQueryData<LoadedDataFile>(DATA_FILE_KEY);
          if (!after || after.pending > 0 || !sameData(after.data, real)) {
            return 'Your data is restored on this device but not uploaded yet, so the backup was kept. Try again when online.';
          }
          await backups.remove(action.backup.id);
          return 'Your data is back. The backup was moved to Drive’s trash.';
        }
        case 'remove':
          await backups.remove(action.backup.id);
          return 'Old backup moved to Drive’s trash.';
        case 'download': {
          const copy = await backups.load(action.backup.id);
          const saved = await saveExport(
            exportFileName('backup', action.backup.takenAt.slice(0, 10)),
            toBackupJson(copy),
          );
          return saved === 'saved' ? 'Backup saved to this device.' : '';
        }
      }
    },
    onMutate: () => {
      setMessage(null);
      setConfirming(false);
    },
    onSuccess: (text) => {
      setMessage(text ? { error: false, text } : null);
    },
    onError: (e) => {
      setMessage({ error: true, text: e.message });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['sample-backups', rootId] }),
  });

  const busy = run.isPending || save.isPending;
  const button =
    'rounded-xl px-4 py-2 font-medium disabled:opacity-60 ring-1 ring-line hover:bg-brand-soft bg-subtle text-ink';
  const primary =
    'rounded-xl bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-strong disabled:opacity-60';

  return (
    <SettingsCard
      icon={<WalletIcon />}
      tone="amber"
      title={
        <>
          Sample data{' '}
          <span className="ml-1 rounded-full bg-warn-soft px-2 py-0.5 align-middle text-xs font-medium text-warn">
            Debug builds only
          </span>
        </>
      }
      description="Show made-up data for screenshots, then put your own back. Keep other devices closed meanwhile."
      className="border border-dashed border-warn/50"
    >
      {listed.isPending ? (
        <p className="text-sm text-ink-muted">Checking for backups…</p>
      ) : showingSample ? (
        latest ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-soft">
              Sample data is showing. Your own data is backed up in{' '}
              <code>TrackWorth/{SAMPLE_BACKUP_FOLDER}</code> ({when(latest)}).
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !ready}
                onClick={() => {
                  run.mutate({ kind: 'restore', backup: latest });
                }}
                className={primary}
              >
                {busy ? 'Working…' : 'Restore my data'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  run.mutate({ kind: 'download', backup: latest });
                }}
                className={button}
              >
                Save backup to this device
              </button>
            </div>
          </div>
        ) : (
          <p role="alert" className="text-sm text-danger">
            Sample data is showing, but no backup was found in{' '}
            <code>TrackWorth/{SAMPLE_BACKUP_FOLDER}</code>. Check Drive’s trash and the version
            history of <code>settings.json</code> and <code>accounts.json</code>.
          </p>
        )
      ) : (
        <div className="space-y-3">
          {confirming ? (
            <div role="group" aria-label="Confirm sample data" className="space-y-2">
              <p className="text-sm text-ink-soft">
                Your data is backed up to <code>TrackWorth/{SAMPLE_BACKUP_FOLDER}</code> and checked
                first; then ten made-up accounts replace it until you restore.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !ready}
                  onClick={() => {
                    run.mutate({ kind: 'load' });
                  }}
                  className={primary}
                >
                  Back up and show sample data
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                  }}
                  className="rounded-xl px-4 py-2 font-medium text-ink-soft hover:bg-subtle"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || !ready}
              onClick={() => {
                setConfirming(true);
              }}
              className={button}
            >
              Load sample data
            </button>
          )}
          {listed.data && listed.data.length > 0 && (
            <div className="rounded-xl bg-subtle p-3 text-sm ring-1 ring-line">
              <p className="text-ink-soft">
                {listed.data.length === 1
                  ? '1 old backup'
                  : `${String(listed.data.length)} old backups`}{' '}
                from earlier sample sessions. Your current data is your own, so they aren’t
                restored.
              </p>
              <ul className="mt-2 space-y-1">
                {listed.data.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink-muted">{when(b)}</span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Save backup from ${when(b)} to this device`}
                        onClick={() => {
                          run.mutate({ kind: 'download', backup: b });
                        }}
                        className="font-medium text-brand hover:underline disabled:opacity-60"
                      >
                        Save to device
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Remove backup from ${when(b)}`}
                        onClick={() => {
                          run.mutate({ kind: 'remove', backup: b });
                        }}
                        className="font-medium text-danger hover:underline disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {!ready && (
        <p className="text-xs text-ink-muted">Needs a connection and everything uploaded first.</p>
      )}
      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={`text-sm ${message.error ? 'text-danger' : 'text-positive'}`}
        >
          {message.text}
        </p>
      )}
    </SettingsCard>
  );
}
