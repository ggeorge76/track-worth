import { createDriveClient, DriveError, escapeQueryValue } from './driveClient';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Route = [method: string, match: RegExp, respond: () => Response];

/** Tiny fake Drive: first matching route wins; unmatched requests fail the test. */
function fakeFetch(routes: Route[]) {
  const calls: { method: string; url: string; auth: string | null }[] = [];
  const impl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init?.method ?? 'GET';
    calls.push({ method, url, auth: new Headers(init?.headers).get('Authorization') });
    const route = routes.find(
      ([m, re]) => m === method && re.test(decodeURIComponent(url.replace(/\+/g, ' '))),
    );
    if (!route) throw new Error(`Unexpected request: ${method} ${url}`);
    return Promise.resolve(route[2]());
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

describe('driveClient.loadOrCreate', () => {
  it('reads the existing file at the fixed path', async () => {
    const { impl, calls } = fakeFetch([
      [
        'GET',
        /mimeType = 'application\/vnd.google-apps.folder'/,
        () => json({ files: [{ id: 'folder1' }] }),
      ],
      ['GET', /'folder1' in parents/, () => json({ files: [{ id: 'file1' }] })],
      ['GET', /files\/file1\?fields=version/, () => json({ version: '7' })],
      ['GET', /files\/file1\?alt=media/, () => json({ hello: 'world' })],
    ]);
    const result = await client(impl).loadOrCreate(() => ({}));
    expect(result).toEqual({ fileId: 'file1', version: '7', content: { hello: 'world' } });
    expect(calls.every((c) => c.auth === 'Bearer token-123')).toBe(true);
  });

  it('creates folder and file on first run', async () => {
    const { impl, calls } = fakeFetch([
      ['GET', /mimeType = 'application\/vnd.google-apps.folder'/, () => json({ files: [] })],
      ['POST', /drive\/v3\/files\?fields=id/, () => json({ id: 'newFolder' })],
      ['GET', /'newFolder' in parents/, () => json({ files: [] })],
      [
        'POST',
        /upload\/drive\/v3\/files\?uploadType=multipart/,
        () => json({ id: 'newFile', version: '1' }),
      ],
    ]);
    const initial = { schemaVersion: 1 };
    const result = await client(impl).loadOrCreate(() => initial);
    expect(result).toEqual({ fileId: 'newFile', version: '1', content: initial });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2);
  });

  it('maps 401 to an unauthorized DriveError', async () => {
    const { impl } = fakeFetch([['GET', /.*/, () => json({}, 401)]]);
    await expect(client(impl).loadOrCreate(() => ({}))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });
});

describe('driveClient.save', () => {
  it('writes when the version is unchanged', async () => {
    const { impl } = fakeFetch([
      ['GET', /files\/file1\?fields=version/, () => json({ version: '7' })],
      ['PATCH', /upload\/drive\/v3\/files\/file1/, () => json({ version: '8' })],
    ]);
    await expect(client(impl).save('file1', { a: 1 }, '7')).resolves.toBe('8');
  });

  it('refuses to overwrite when another device saved first', async () => {
    const { impl, calls } = fakeFetch([
      ['GET', /files\/file1\?fields=version/, () => json({ version: '9' })],
    ]);
    const error = await client(impl)
      .save('file1', { a: 1 }, '7')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DriveError);
    expect(error).toMatchObject({ code: 'conflict' });
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});
