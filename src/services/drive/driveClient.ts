import { config } from '@/config';
import { httpFetch } from '@/services/platform';

/**
 * Thin Google Drive v3 REST client for the single data file (ADR-0005).
 * Uses fetch directly (no gapi) to keep the bundle small and the code testable.
 *
 * Concurrency: every write checks the file's Drive `version` first. If it changed since we
 * read it (another device saved), we throw a `conflict` instead of overwriting.
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

export interface DriveFileContent {
  fileId: string;
  version: string;
  content: unknown;
}

interface FileMeta {
  id: string;
  version?: string;
}

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

  async function findOne(q: string): Promise<FileMeta | undefined> {
    const params = new URLSearchParams({
      q,
      fields: 'files(id,version)',
      spaces: 'drive',
      pageSize: '1',
      orderBy: 'createdTime',
    });
    const res = await request(`${API}/files?${params.toString()}`);
    const body = (await res.json()) as { files?: FileMeta[] };
    return body.files?.[0];
  }

  async function findFolder(): Promise<FileMeta | undefined> {
    const name = escapeQueryValue(config.drive.folderName);
    return findOne(
      `name = '${name}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`,
    );
  }

  async function findDataFile(folderId: string): Promise<FileMeta | undefined> {
    const name = escapeQueryValue(config.drive.fileName);
    const parent = escapeQueryValue(folderId);
    return findOne(`name = '${name}' and '${parent}' in parents and trashed = false`);
  }

  async function createFolder(): Promise<FileMeta> {
    const res = await request(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: config.drive.folderName,
        mimeType: FOLDER_MIME,
        parents: ['root'],
      }),
    });
    return (await res.json()) as FileMeta;
  }

  async function createDataFile(folderId: string, content: unknown): Promise<FileMeta> {
    const boundary = `trackworth-${crypto.randomUUID()}`;
    const metadata = {
      name: config.drive.fileName,
      parents: [folderId],
      mimeType: 'application/json',
    };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(content, null, 2)}\r\n` +
      `--${boundary}--`;
    const res = await request(`${UPLOAD}/files?uploadType=multipart&fields=id,version`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return (await res.json()) as FileMeta;
  }

  async function getVersion(fileId: string): Promise<string> {
    const res = await request(`${API}/files/${encodeURIComponent(fileId)}?fields=version`);
    const meta = (await res.json()) as FileMeta;
    return meta.version ?? '';
  }

  async function readContent(fileId: string): Promise<unknown> {
    const res = await request(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
    return (await res.json()) as unknown;
  }

  return {
    /**
     * Load the data file at the fixed path, creating folder and file on first run.
     * `createInitial` is only called when no file exists.
     */
    async loadOrCreate(createInitial: () => unknown): Promise<DriveFileContent> {
      const folder = (await findFolder()) ?? (await createFolder());
      const existing = await findDataFile(folder.id);
      if (!existing) {
        const content = createInitial();
        const created = await createDataFile(folder.id, content);
        return { fileId: created.id, version: created.version ?? '', content };
      }
      const version = await getVersion(existing.id);
      const content = await readContent(existing.id);
      return { fileId: existing.id, version, content };
    },

    /** Overwrite the data file if nobody else changed it since `expectedVersion`. */
    async save(fileId: string, content: unknown, expectedVersion: string): Promise<string> {
      const current = await getVersion(fileId);
      if (current !== expectedVersion) {
        throw new DriveError('The data file was changed on another device', 'conflict');
      }
      const res = await request(
        `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=version`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(content, null, 2),
        },
      );
      const meta = (await res.json()) as FileMeta;
      return meta.version ?? '';
    },
  };
}

export type DriveClient = ReturnType<typeof createDriveClient>;
