import { parseDataFile, type DataFile } from '@/domain/schema';
import { sameData, StoreError, type DriveApi } from './dataStore';

/**
 * Backups of the user's real data while sample data is shown (development builds only).
 *
 * - Each backup is a new, timestamped, readable JSON file in `TrackWorth/sample-backups/`; one
 *   is never overwritten, so a leftover backup can't block anything or be lost.
 * - Each is read back and compared before anything is replaced.
 * - A backup is removed (moved to Drive's trash) only after the restore checks out.
 */
export const SAMPLE_BACKUP_FOLDER = 'sample-backups';

export interface BackupInfo {
  id: string;
  name: string;
  /** ISO-8601 UTC, from the file name. */
  takenAt: string;
}

export interface SampleBackups {
  /** Oldest first. */
  list(rootId: string): Promise<BackupInfo[]>;
  /** Writes `data` as a new backup and checks it reads back identically; throws if not. */
  save(rootId: string, data: DataFile, now: Date): Promise<BackupInfo>;
  load(id: string): Promise<DataFile>;
  remove(id: string): Promise<void>;
}

const NAME = /^backup-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z\.json$/;

function nameFor(now: Date): string {
  return `backup-${now.toISOString().replace(/:/g, '-').replace('.', '-')}.json`;
}

function info(item: { id: string; name: string }): BackupInfo | undefined {
  const m = NAME.exec(item.name);
  if (!m) return undefined;
  const [, day, h, min, s, ms = '000'] = m;
  return {
    id: item.id,
    name: item.name,
    takenAt: `${day ?? ''}T${h ?? ''}:${min ?? ''}:${s ?? ''}.${ms}Z`,
  };
}

export function createSampleBackups(drive: DriveApi): SampleBackups {
  async function folder(rootId: string, create: boolean): Promise<string | undefined> {
    const found = await drive.findChild(rootId, SAMPLE_BACKUP_FOLDER);
    if (found) return found.id;
    return create ? (await drive.createFolder(SAMPLE_BACKUP_FOLDER, rootId)).id : undefined;
  }

  async function load(id: string): Promise<DataFile> {
    const parsed = parseDataFile(await drive.readJson(id));
    if (!parsed.ok) {
      throw new StoreError(
        'The backup couldn’t be read. It’s still in your TrackWorth folder; nothing was changed.',
        'invalid',
      );
    }
    return parsed.data;
  }

  return {
    async list(rootId) {
      const id = await folder(rootId, false);
      if (!id) return [];
      return (await drive.listChildren(id))
        .map(info)
        .filter((b): b is BackupInfo => b !== undefined)
        .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    },
    async save(rootId, data, now) {
      const parent = (await folder(rootId, true)) as string;
      const item = await drive.createJson(nameFor(now), parent, data);
      const ok = await load(item.id).then(
        (copy) => sameData(copy, data),
        () => false,
      );
      if (!ok) {
        await drive.trash(item.id);
        throw new StoreError('The backup didn’t check out, so nothing was replaced.', 'invalid');
      }
      return info(item) as BackupInfo;
    },
    load,
    remove: (id) => drive.trash(id),
  };
}
