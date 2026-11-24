import { useId, useState } from 'react';
import { useToday } from '@/app/useToday';
import { exportFileName, toBackupJson, toBalancesCsv } from '@/domain/export';
import type { DataFile } from '@/domain/schema';
import { ExportError, saveExport } from '@/services/export/saveExport';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; fileName: string }
  | { kind: 'error'; message: string };

const buttonClass =
  'rounded-xl bg-subtle px-4 py-2 text-left font-medium text-ink ring-1 ring-line hover:bg-muted disabled:opacity-50';

/** Save a copy of the data outside Drive (R-S2, ADR-0016). */
export function ExportSection({ data }: { data: DataFile }) {
  const today = useToday();
  const headingId = useId();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function save(kind: 'backup' | 'balances') {
    const fileName = exportFileName(kind, today);
    const contents = kind === 'backup' ? toBackupJson(data) : toBalancesCsv(data);
    setStatus({ kind: 'saving' });
    try {
      const result = await saveExport(fileName, contents);
      setStatus(result === 'saved' ? { kind: 'saved', fileName } : { kind: 'idle' });
    } catch (err) {
      setStatus({
        kind: 'error',
        message:
          err instanceof ExportError ? err.message : 'Couldn’t save the file. Please try again.',
      });
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="mt-4 space-y-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line"
    >
      <h2 id={headingId} className="font-medium">
        Export your data
      </h2>
      <p className="text-sm text-ink-muted">
        Your data stays in your Google Drive, in the TrackWorth folder. You can also save a copy
        anywhere you like.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className={buttonClass}
          disabled={status.kind === 'saving'}
          onClick={() => void save('backup')}
        >
          Everything (JSON)
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={status.kind === 'saving'}
          onClick={() => void save('balances')}
        >
          Balances for a spreadsheet (CSV)
        </button>
      </div>
      {status.kind === 'saved' && (
        <p role="status" className="text-sm text-positive">
          Saved {status.fileName}.
        </p>
      )}
      {status.kind === 'error' && (
        <p role="alert" className="text-sm text-danger">
          {status.message}
        </p>
      )}
    </section>
  );
}
