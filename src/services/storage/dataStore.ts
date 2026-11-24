import { config } from '@/config';
import { localIsoDate } from '@/domain/dates';
import { createEmptyDataFile, parseDataFile, SCHEMA_VERSION, type DataFile } from '@/domain/schema';
import {
  ACCOUNTS_FILE,
  accountsFileSchema,
  balanceFileSchema,
  LEGACY_FILE,
  parseStoredFile,
  SETTINGS_FILE,
  settingsFileSchema,
  type BalanceFile,
} from '@/domain/storage/files';
import {
  assembleDataset,
  MissingBalanceFileError,
  planWrites,
  splitDataset,
  type Layout,
} from '@/domain/storage/layout';
import { BALANCES_DIR, realign } from '@/domain/storage/periods';
import type { FileCache } from '@/services/cache/fileCache';
import { DriveError, type DriveClient, type DriveItem } from '@/services/drive/driveClient';
import type { z } from 'zod';

/**
 * The user's data in Google Drive, split into settings.json, accounts.json and one file per
 * financial year under balances/ (ADR-0014), with a local copy on the device.
 */

export type DriveApi = Pick<
  DriveClient,
  'listChildren' | 'findChild' | 'createFolder' | 'createJson' | 'readJson' | 'updateJson' | 'trash'
>;

export interface StoredRef {
  id: string;
  version: string;
}

/** What this device last read from or wrote to Drive. Passed back to `save`. */
export interface StoreSnapshot {
  rootId: string;
  balancesFolderId: string | null;
  /** Drive id + version of every file known, by path, including balance files not yet listed. */
  files: Record<string, StoredRef>;
  /** The stored content, for working out what a change needs to write. Null before first save. */
  layout: Layout | null;
}

export interface LoadedStore {
  data: DataFile;
  snapshot: StoreSnapshot;
  /** Set when an older single-file format was upgraded during this load. */
  migratedFrom?: number;
}

export type StoreErrorCode = 'conflict' | 'newer-version' | 'invalid' | 'missing-file';

/** Errors with plain-language messages, safe to show to the user. */
export class StoreError extends Error {
  constructor(
    message: string,
    readonly code: StoreErrorCode,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

const NEWER_VERSION =
  'Your data was saved by a newer version of TrackWorth. Please update the app.';
const CONFLICT =
  'Couldn’t save. Your data was changed on another device. Reload to see the latest.';

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** Drive allows duplicate names; listings are oldest-first, so keep the first of each name. */
function byName(items: readonly DriveItem[]): Map<string, DriveItem> {
  const map = new Map<string, DriveItem>();
  for (const item of items) if (!map.has(item.name)) map.set(item.name, item);
  return map;
}

/** Same user data, ignoring timestamps and order of entries. */
function sameData(a: DataFile, b: DataFile): boolean {
  const canonical = (d: DataFile) =>
    JSON.stringify({
      baseCurrency: d.baseCurrency,
      settings: d.settings,
      accounts: d.accounts,
      balances: [...d.balances].sort((x, y) => x.id.localeCompare(y.id)),
      netWorthHistory: d.netWorthHistory,
    });
  return canonical(a) === canonical(b);
}

export interface DataStoreOptions {
  drive: DriveApi;
  cache: FileCache;
  /** Local date, for applying a financial-year change to the current year. */
  today?: () => string;
  now?: () => Date;
  defaultCurrency?: string;
}

export function createDataStore({
  drive,
  cache,
  today = () => localIsoDate(),
  now = () => new Date(),
  defaultCurrency = 'USD',
}: DataStoreOptions) {
  /** File content, from the local copy when Drive's version matches, else downloaded. */
  async function read(path: string, item: DriveItem): Promise<unknown> {
    const cached = await cache.get(path);
    if (cached?.id === item.id && cached.version === item.version) return cached.content;
    const content = await drive.readJson(item.id);
    await cache.put(path, { id: item.id, version: item.version, content });
    return content;
  }

  function parse<T>(schema: z.ZodType<T>, raw: unknown, path: string): T {
    const result = parseStoredFile(schema, raw);
    if (result.ok) return result.value;
    if (result.reason === 'newer-version') throw new StoreError(NEWER_VERSION, 'newer-version');
    throw new StoreError(`Your data couldn’t be read (${path}): ${result.message}`, 'invalid');
  }

  async function save(snapshot: StoreSnapshot, next: DataFile): Promise<StoreSnapshot> {
    const before = snapshot.layout;
    const month = next.settings.financialYearStartMonth;
    let periods = before?.settings.balanceFiles ?? [];
    if (before && before.settings.settings.financialYearStartMonth !== month) {
      periods = realign(periods, today(), month);
    }
    const after = splitDataset(next, periods);
    let files = { ...snapshot.files };
    let balancesFolderId = snapshot.balancesFolderId;
    const stamp = now().toISOString();

    for (const step of planWrites(before, after)) {
      const ref = files[step.path];
      if (step.kind === 'trash') {
        if (ref) {
          await drive.trash(ref.id);
          files = Object.fromEntries(Object.entries(files).filter(([path]) => path !== step.path));
          await cache.remove(step.path);
        }
        continue;
      }
      const content = { ...step.content, updatedAt: stamp };
      let written: StoredRef;
      try {
        if (ref) {
          written = { id: ref.id, version: await drive.updateJson(ref.id, content, ref.version) };
        } else {
          let parent = snapshot.rootId;
          if (step.path.startsWith(`${BALANCES_DIR}/`)) {
            balancesFolderId ??=
              (await drive.findChild(snapshot.rootId, BALANCES_DIR))?.id ??
              (await drive.createFolder(BALANCES_DIR, snapshot.rootId)).id;
            parent = balancesFolderId;
          }
          // Another device may have created this file since we loaded: never create a duplicate.
          if (await drive.findChild(parent, basename(step.path))) {
            throw new DriveError(`${step.path} already exists`, 'conflict');
          }
          const item = await drive.createJson(basename(step.path), parent, content);
          written = { id: item.id, version: item.version };
        }
      } catch (err) {
        if (err instanceof DriveError && err.code === 'conflict')
          throw new StoreError(CONFLICT, 'conflict');
        throw err;
      }
      files[step.path] = written;
      await cache.put(step.path, { ...written, content });
    }
    return { rootId: snapshot.rootId, balancesFolderId, files, layout: after };
  }

  async function load(): Promise<LoadedStore> {
    const folderName = config.drive.folderName;
    const root =
      (await drive.findChild('root', folderName)) ?? (await drive.createFolder(folderName, 'root'));
    const children = byName(await drive.listChildren(root.id));
    const balancesFolder = [...children.values()].find(
      (c) => c.name === BALANCES_DIR && c.isFolder,
    );
    const balanceItems = balancesFolder
      ? byName(await drive.listChildren(balancesFolder.id))
      : new Map<string, DriveItem>();

    // Every file already in Drive, so a save updates it rather than creating a duplicate.
    const files: Record<string, StoredRef> = {};
    for (const name of [SETTINGS_FILE, ACCOUNTS_FILE]) {
      const item = children.get(name);
      if (item) files[name] = { id: item.id, version: item.version };
    }
    for (const [name, item] of balanceItems)
      files[`${BALANCES_DIR}/${name}`] = { id: item.id, version: item.version };
    const base: StoreSnapshot = {
      rootId: root.id,
      balancesFolderId: balancesFolder?.id ?? null,
      files,
      layout: null,
    };

    const settingsItem = children.get(SETTINGS_FILE);
    if (!settingsItem) {
      const legacy = children.get(LEGACY_FILE);
      return legacy ? migrate(base, legacy) : createNew(base);
    }

    const settings = parse(
      settingsFileSchema,
      await read(SETTINGS_FILE, settingsItem),
      SETTINGS_FILE,
    );
    const accountsItem = children.get(ACCOUNTS_FILE);
    if (!accountsItem) throw missingFile(ACCOUNTS_FILE);
    const accounts = parse(
      accountsFileSchema,
      await read(ACCOUNTS_FILE, accountsItem),
      ACCOUNTS_FILE,
    );

    const balances: Record<string, BalanceFile> = {};
    await Promise.all(
      settings.balanceFiles.map(async (period) => {
        const item = balanceItems.get(basename(period.file));
        if (!item) throw missingFile(period.file);
        balances[period.file] = parse(
          balanceFileSchema,
          await read(period.file, item),
          period.file,
        );
      }),
    );

    let data: DataFile;
    try {
      data = assembleDataset(settings, accounts, balances);
    } catch (err) {
      if (err instanceof MissingBalanceFileError) throw missingFile(err.file);
      throw new StoreError(`Your data couldn’t be read: ${String(err)}`, 'invalid');
    }
    return { data, snapshot: { ...base, layout: { settings, accounts, balances } } };
  }

  function missingFile(path: string): StoreError {
    return new StoreError(
      `A file is missing from your TrackWorth folder in Google Drive (${path}). If you deleted it, restore it from Drive’s trash, then reload.`,
      'missing-file',
    );
  }

  async function createNew(base: StoreSnapshot): Promise<LoadedStore> {
    const data = createEmptyDataFile(defaultCurrency, now());
    return { data, snapshot: await save(base, data) };
  }

  /**
   * Upgrade the v1/v2 single file: write the new files, read them back to verify, and only then
   * move the old file to Drive's trash (recoverable for 30 days).
   */
  async function migrate(base: StoreSnapshot, legacy: DriveItem): Promise<LoadedStore> {
    const parsed = parseDataFile(await drive.readJson(legacy.id));
    if (!parsed.ok) {
      if (parsed.reason === 'newer-version') throw new StoreError(NEWER_VERSION, 'newer-version');
      throw new StoreError(`Your data couldn’t be read: ${parsed.message}`, 'invalid');
    }
    await save(base, parsed.data);
    const verified = await load();
    if (!sameData(verified.data, parsed.data)) {
      throw new StoreError(
        'Upgrading your data didn’t check out, so your original file was kept. Please reload to try again.',
        'invalid',
      );
    }
    await drive.trash(legacy.id);
    return { ...verified, migratedFrom: parsed.migratedFrom ?? SCHEMA_VERSION - 1 };
  }

  return { load, save };
}

export type DataStore = ReturnType<typeof createDataStore>;
