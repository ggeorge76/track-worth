import { useState, type ReactNode } from 'react';
import { DownloadIcon, FileIcon, TableIcon } from '@/components/icons';
import { useToday } from '@/app/useToday';
import { exportFileName, toBackupJson, toBalancesCsv } from '@/domain/export';
import type { DataFile } from '@/domain/schema';
import { ExportError, saveExport } from '@/services/export/saveExport';
import { SettingsCard } from './SettingsCard';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; fileName: string }
  | { kind: 'error'; message: string };

/** Save a copy of the data outside Drive (R-S2, ADR-0016). */
export function ExportSection({ data }: { data: DataFile }) {
  const today = useToday();
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

  const tile = (
    kind: 'backup' | 'balances',
    icon: ReactNode,
    title: string,
    detail: string,
    name: string,
  ) => (
    <button
      type="button"
      aria-label={name}
      disabled={status.kind === 'saving'}
      onClick={() => void save(kind)}
      className="group flex flex-1 items-center gap-3 rounded-xl bg-subtle p-3 text-left ring-1 ring-line transition hover:bg-brand-soft hover:ring-brand/40 disabled:opacity-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brand shadow-sm ring-1 ring-line group-hover:text-brand-strong">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-xs text-ink-muted">{detail}</span>
      </span>
    </button>
  );

  return (
    <SettingsCard
      icon={<DownloadIcon />}
      tone="green"
      title="Export your data"
      description="Your data stays in your Google Drive, in the TrackWorth folder. Save a copy anywhere you like."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        {tile('backup', <FileIcon />, 'Everything', 'Full copy · .json', 'Everything (JSON)')}
        {tile(
          'balances',
          <TableIcon />,
          'Balances',
          'For a spreadsheet · .csv',
          'Balances for a spreadsheet (CSV)',
        )}
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
    </SettingsCard>
  );
}
