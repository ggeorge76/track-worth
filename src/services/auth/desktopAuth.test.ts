import { AuthError, fetchUserProfile, toAuthError } from './desktopAuth';

describe('toAuthError', () => {
  it('maps a Rust { code, message } error', () => {
    const err = toAuthError({ code: 'scope-denied', message: 'Drive access needed' });
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toMatchObject({ code: 'scope-denied', message: 'Drive access needed' });
  });

  it('falls back to a generic error for anything else', () => {
    expect(toAuthError('boom')).toMatchObject({ code: 'failed' });
  });
});

describe('fetchUserProfile', () => {
  const ok = (body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body))));

  it('uses the display name from the OAuth profile', async () => {
    const fetchImpl = ok({ name: 'Ada Lovelace', email: 'ada@example.com' });
    await expect(fetchUserProfile('tok', fetchImpl)).resolves.toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), {
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('falls back to the email when the profile has no name', async () => {
    const user = await fetchUserProfile('tok', ok({ email: 'ada@example.com' }));
    expect(user.name).toBe('ada@example.com');
  });

  it('throws on HTTP errors', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('', { status: 401 })));
    await expect(fetchUserProfile('tok', fetchImpl)).rejects.toBeInstanceOf(AuthError);
  });
});
