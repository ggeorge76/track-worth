import { createDriveClient, DriveError, escapeQueryValue } from './driveClient';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Route = [method: string, match: RegExp, respond: (url: string, body: string) => Response];

/** Tiny fake Drive: first matching route wins; unmatched requests fail the test. */
function fakeFetch(routes: Route[]) {
  const calls: { method: string; url: string; body: string; auth: string | null }[] = [];
  const impl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(
      (input instanceof Request ? input.url : input.toString()).replace(/\+/g, ' '),
    );
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? init.body : '';
    calls.push({ method, url, body, auth: new Headers(init?.headers).get('Authorization') });
    const route = routes.find(([m, re]) => m === method && re.test(url));
    if (!route) throw new Error(`Unexpected request: ${method} ${url}`);
    return Promise.resolve(route[2](url, body));
  });
  return { impl, calls };
}

const client = (fetchImpl: typeof fetch) =>
  createDriveClient({ getAccessToken: () => Promise.resolve('token-123'), fetchImpl });

describe('escapeQueryValue', () => {
  it('escapes quotes and backslashes for Drive queries', () => {
    expect(escapeQueryValue("it's \\ here")).toBe("it\\'s \\\\ here");
  });
});

describe('listing', () => {
  it('lists a folder across pages, marking folders', async () => {
    const { impl, calls } = fakeFetch([
      [
        'GET',
        /pageToken=p2/,
        () =>
          json({
            files: [{ id: '3', name: '2026.json', version: '9', mimeType: 'application/json' }],
          }),
      ],
      [
        'GET',
        /'folder' in parents and trashed = false/,
        () =>
          json({
            nextPageToken: 'p2',
            files: [
              { id: '1', name: 'settings.json', version: '4', mimeType: 'application/json' },
              {
                id: '2',
                name: 'balances',
                version: '1',
                mimeType: 'application/vnd.google-apps.folder',
              },
            ],
          }),
      ],
    ]);
    const items = await client(impl).listChildren('folder');
    expect(items).toEqual([
      { id: '1', name: 'settings.json', version: '4', isFolder: false },
      { id: '2', name: 'balances', version: '1', isFolder: true },
      { id: '3', name: '2026.json', version: '9', isFolder: false },
    ]);
    expect(calls.every((c) => c.auth === 'Bearer token-123')).toBe(true);
  });

  it('finds a child by name', async () => {
    const { impl } = fakeFetch([
      [
        'GET',
        /name = 'TrackWorth' and 'root' in parents/,
        () =>
          json({
            files: [
              { id: 'f', name: 'TrackWorth', mimeType: 'application/vnd.google-apps.folder' },
            ],
          }),
      ],
      ['GET', /name = 'nope'/, () => json({ files: [] })],
    ]);
    const drive = client(impl);
    expect(await drive.findChild('root', 'TrackWorth')).toMatchObject({ id: 'f', isFolder: true });
    expect(await drive.findChild('root', 'nope')).toBeUndefined();
  });
});

describe('creating and reading', () => {
  it('creates a folder and a JSON file in a parent', async () => {
    const { impl, calls } = fakeFetch([
      [
        'POST',
        /drive\/v3\/files\?fields=/,
        () =>
          json({
            id: 'b',
            name: 'balances',
            version: '1',
            mimeType: 'application/vnd.google-apps.folder',
          }),
      ],
      [
        'POST',
        /upload\/drive\/v3\/files\?uploadType=multipart/,
        () => json({ id: 'x', name: '2026.json', version: '1' }),
      ],
    ]);
    const drive = client(impl);
    expect(await drive.createFolder('balances', 'root-id')).toMatchObject({
      id: 'b',
      isFolder: true,
    });
    expect(await drive.createJson('2026.json', 'b', { hello: 1 })).toMatchObject({
      id: 'x',
      version: '1',
    });
    expect(calls[0]?.body).toContain('"parents":["root-id"]');
    expect(calls[1]?.body).toContain('"parents":["b"]');
    expect(calls[1]?.body).toContain('"hello": 1');
  });

  it('reads JSON content', async () => {
    const { impl } = fakeFetch([['GET', /files\/x\?alt=media/, () => json({ a: 1 })]]);
    expect(await client(impl).readJson('x')).toEqual({ a: 1 });
  });

  it('maps 401 to an unauthorized DriveError', async () => {
    const { impl } = fakeFetch([['GET', /.*/, () => json({}, 401)]]);
    await expect(client(impl).readJson('x')).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

describe('updating and trashing', () => {
  it('writes when the version is unchanged', async () => {
    const { impl } = fakeFetch([
      ['GET', /files\/x\?fields=version/, () => json({ version: '7' })],
      ['PATCH', /upload\/drive\/v3\/files\/x/, () => json({ version: '8' })],
    ]);
    await expect(client(impl).updateJson('x', { a: 1 }, '7')).resolves.toBe('8');
  });

  it('refuses to overwrite when another device saved first', async () => {
    const { impl, calls } = fakeFetch([
      ['GET', /files\/x\?fields=version/, () => json({ version: '9' })],
    ]);
    const error = await client(impl)
      .updateJson('x', { a: 1 }, '7')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DriveError);
    expect(error).toMatchObject({ code: 'conflict' });
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('moves a file to the trash', async () => {
    const { impl, calls } = fakeFetch([
      ['PATCH', /drive\/v3\/files\/old/, () => json({ id: 'old' })],
    ]);
    await client(impl).trash('old');
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ trashed: true });
  });
});
