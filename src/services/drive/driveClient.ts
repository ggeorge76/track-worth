import { httpFetch } from '@/services/platform';

/**
 * Thin Google Drive v3 REST client: generic folder and JSON-file operations used by the data
 * store (ADR-0014). Uses fetch directly (no gapi) to keep the bundle small and testable.
 *
 * Concurrency: `updateJson` checks the file's Drive `version` first. If it changed since we read
 * it (another device saved), it throws a `conflict` instead of overwriting.
 */

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type DriveErrorCode = 'unauthorized' | 'conflict' | 'not-found' | 'http';

export class DriveError extends Error {
  constructor(
    message: string,
    readonly code: DriveErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DriveError';
  }
}

/** A file or folder as listed by Drive. */
export interface DriveItem {
  id: string;
  name: string;
  version: string;
  isFolder: boolean;
}

interface RawItem {
  id: string;
  name?: string;
  version?: string;
  mimeType?: string;
}

const toItem = (raw: RawItem): DriveItem => ({
  id: raw.id,
  name: raw.name ?? '',
  version: raw.version ?? '',
  isFolder: raw.mimeType === FOLDER_MIME,
});

export interface DriveClientOptions {
  /** Returns a valid access token (refreshed by the Rust side when needed). */
  getAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function createDriveClient({ getAccessToken, fetchImpl = httpFetch }: DriveClientOptions) {
  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await getAccessToken()}`);
    const res = await fetchImpl(url, { ...init, headers });
    if (res.status === 401) throw new DriveError('Google session expired', 'unauthorized', 401);
    if (res.status === 404) throw new DriveError('File not found in Drive', 'not-found', 404);
    if (!res.ok) throw new DriveError(`Drive request failed (${res.status})`, 'http', res.status);
    return res;
  }

  const ITEM_FIELDS = 'id,name,version,mimeType';

  async function list(q: string): Promise<DriveItem[]> {
    const items: DriveItem[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q,
        fields: `nextPageToken,files(${ITEM_FIELDS})`,
        spaces: 'drive',
        pageSize: '1000',
        orderBy: 'createdTime',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await request(`${API}/files?${params.toString()}`);
      const body = (await res.json()) as { files?: RawItem[]; nextPageToken?: string };
      items.push(...(body.files ?? []).map(toItem));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return items;
  }

  const inFolder = (parentId: string) =>
    `'${escapeQueryValue(parentId)}' in parents and trashed = false`;

  async function getVersion(fileId: string): Promise<string> {
    const res = await request(`${API}/files/${encodeURIComponent(fileId)}?fields=version`);
    return ((await res.json()) as RawItem).version ?? '';
  }

  return {
    /** Everything (not trashed) directly inside a folder; `'root'` is My Drive. */
    listChildren(parentId: string): Promise<DriveItem[]> {
      return list(inFolder(parentId));
    },

    /** The oldest child with this name, if any (duplicates can exist in Drive). */
    async findChild(parentId: string, name: string): Promise<DriveItem | undefined> {
      const items = await list(`name = '${escapeQueryValue(name)}' and ${inFolder(parentId)}`);
      return items[0];
    },

    async createFolder(name: string, parentId: string): Promise<DriveItem> {
      const res = await request(`${API}/files?fields=${ITEM_FIELDS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
      });
      return toItem((await res.json()) as RawItem);
    },

    async createJson(name: string, parentId: string, content: unknown): Promise<DriveItem> {
      const boundary = `trackworth-${crypto.randomUUID()}`;
      const metadata = { name, parents: [parentId], mimeType: 'application/json' };
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(content, null, 2)}\r\n` +
        `--${boundary}--`;
      const res = await request(`${UPLOAD}/files?uploadType=multipart&fields=${ITEM_FIELDS}`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      return toItem((await res.json()) as RawItem);
    },

    async readJson(fileId: string): Promise<unknown> {
      const res = await request(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
      return (await res.json()) as unknown;
    },

    /** Overwrite a JSON file if nobody else changed it since `expectedVersion`; returns the new version. */
    async updateJson(fileId: string, content: unknown, expectedVersion: string): Promise<string> {
      const current = await getVersion(fileId);
      if (current !== expectedVersion) {
        throw new DriveError('The file was changed on another device', 'conflict');
      }
      const res = await request(
        `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=version`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(content, null, 2),
        },
      );
      return ((await res.json()) as RawItem).version ?? '';
    },

    /** Move a file to Drive's trash (recoverable for 30 days). */
    async trash(fileId: string): Promise<void> {
      await request(`${API}/files/${encodeURIComponent(fileId)}?fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      });
    },
  };
}

export type DriveClient = ReturnType<typeof createDriveClient>;
