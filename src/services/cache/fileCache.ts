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
  const files = new Map<string, CachedFile>();
  return {
    get: (path) => Promise.resolve(files.get(path)),
    put: (path, file) => {
      files.set(path, file);
      return Promise.resolve();
    },
    remove: (path) => {
      files.delete(path);
      return Promise.resolve();
    },
    clear: () => {
      files.clear();
      return Promise.resolve();
    },
  };
}

const DB_NAME = 'trackworth';
const STORE = 'drive-files';

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

/**
 * IndexedDB-backed cache in the webview (private to the app). Any IndexedDB failure degrades to
 * "not cached": the file is simply read from Drive again, so the app keeps working.
 */
export function createIndexedDbCache(factory: IDBFactory = indexedDB): FileCache {
  let db: Promise<IDBDatabase> | undefined;
  const open = () => {
    db ??= new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        db = undefined;
        reject(request.error ?? new Error('Could not open IndexedDB'));
      };
    });
    return db;
  };
  const store = async (mode: IDBTransactionMode) =>
    (await open()).transaction(STORE, mode).objectStore(STORE);

  return {
    async get(path) {
      try {
        return (await promisify((await store('readonly')).get(path))) as CachedFile | undefined;
      } catch {
        return undefined;
      }
    },
    async put(path, file) {
      try {
        await promisify((await store('readwrite')).put(file, path));
      } catch {
        // Not cached: the next load reads this file from Drive.
      }
    },
    async remove(path) {
      try {
        await promisify((await store('readwrite')).delete(path));
      } catch {
        // Ignore: a stale entry is detected by its version anyway.
      }
    },
    async clear() {
      try {
        await promisify((await store('readwrite')).clear());
      } catch {
        // Ignore: nothing we can do, and cached data is never trusted over Drive's version.
      }
    },
  };
}

/** The app's cache: IndexedDB when available (desktop/Android webview), memory otherwise. */
export const fileCache: FileCache =
  typeof indexedDB === 'undefined' ? createMemoryCache() : createIndexedDbCache();
