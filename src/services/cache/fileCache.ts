/**
 * Local copy of the Drive files on this device (ADR-0014). Each entry is keyed by the file's path
 * in the TrackWorth folder (e.g. `balances/2025.json`) and remembers the Drive `version` it was
 * read or written at, so unchanged files are never downloaded again.
 *
 * Drive stays the source of truth. The cache is cleared on sign-out and on interactive sign-in
 * (which may be a different Google account).
 */
export interface CachedFile {
  id: string;
  version: string;
  content: unknown;
}

export interface FileCache {
  get(path: string): Promise<CachedFile | undefined>;
  put(path: string, file: CachedFile): Promise<void>;
  remove(path: string): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryCache(): FileCache {
  return fileCacheOn(createMemoryStore());
}

const DB_NAME = 'trackworth';
const DB_VERSION = 2;
/** Object stores: the local copy of Drive files (ADR-0014) and the workspace (ADR-0015). */
export const STORES = ['drive-files', 'workspace'] as const;
export type StoreName = (typeof STORES)[number];

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    };
  });
}

/** A tiny key-value store on one IndexedDB object store. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

const databases = new WeakMap<IDBFactory, Promise<IDBDatabase>>();

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  let db = databases.get(factory);
  if (!db) {
    db = new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name);
        }
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        databases.delete(factory);
        reject(request.error ?? new Error('Could not open IndexedDB'));
      };
    });
    databases.set(factory, db);
  }
  return db;
}

/**
 * IndexedDB-backed key-value store in the webview (private to the app). Reads that fail return
 * `undefined` and writes that fail are skipped, so the app keeps working without it.
 */
export function createIndexedDbStore(
  name: StoreName,
  factory: IDBFactory = indexedDB,
): KeyValueStore {
  const objectStore = async (mode: IDBTransactionMode) =>
    (await openDatabase(factory)).transaction(name, mode).objectStore(name);
  return {
    async get(key) {
      try {
        return (await promisify((await objectStore('readonly')).get(key))) as unknown;
      } catch {
        return undefined;
      }
    },
    async put(key, value) {
      try {
        await promisify((await objectStore('readwrite')).put(value, key));
      } catch {
        // Not stored: the app falls back to reading from Drive.
      }
    },
    async remove(key) {
      try {
        await promisify((await objectStore('readwrite')).delete(key));
      } catch {
        // Ignore.
      }
    },
    async clear() {
      try {
        await promisify((await objectStore('readwrite')).clear());
      } catch {
        // Ignore.
      }
    },
  };
}

export function createMemoryStore(): KeyValueStore {
  const values = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(values.get(key)),
    put: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      values.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      values.clear();
      return Promise.resolve();
    },
  };
}

/** The local copy of Drive files, on a key-value store. */
export function fileCacheOn(kv: KeyValueStore): FileCache {
  return {
    get: async (path) => (await kv.get(path)) as CachedFile | undefined,
    put: (path, file) => kv.put(path, file),
    remove: (path) => kv.remove(path),
    clear: () => kv.clear(),
  };
}

/** IndexedDB-backed file cache (kept for callers/tests that pass a factory). */
export function createIndexedDbCache(factory: IDBFactory = indexedDB): FileCache {
  return fileCacheOn(createIndexedDbStore('drive-files', factory));
}

/** The app's cache: IndexedDB when available (desktop/Android webview), memory otherwise. */
export const fileCache: FileCache =
  typeof indexedDB === 'undefined' ? createMemoryCache() : createIndexedDbCache();
