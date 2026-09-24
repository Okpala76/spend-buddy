import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './api';

describe('API request client', () => {
  function setup(response = new Response(JSON.stringify({ status: 'ok' }), { status: 200 })) {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    const getToken = vi.fn<() => Promise<string | null>>().mockResolvedValue('fresh-token');
    const onUnauthorized = vi.fn();
    return {
      fetcher,
      getToken,
      onUnauthorized,
      request: createApiClient({
        baseUrl: 'http://localhost:3001',
        fetcher,
        getToken,
        onUnauthorized,
      }),
    };
  }
  it('refreshes BEFORE sending the current bearer token', async () => {
    const { fetcher, getToken, request } = setup();
    await request('/auth/profile');
    expect(getToken.mock.invocationCallOrder[0]!).toBeLessThan(
      fetcher.mock.invocationCallOrder[0]!,
    );
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/profile',
      expect.objectContaining({
        headers: { Accept: 'application/json', Authorization: 'Bearer fresh-token' },
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });
  it('sends public requests without any token or refresh', async () => {
    const { fetcher, getToken, request } = setup();
    await request('/auth/public');
    expect(getToken).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
  });
  it('the explicit no-token diagnostic never includes Authorization', async () => {
    const { fetcher, getToken, request } = setup();
    await request('/auth/profile', false);
    expect(getToken).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
  });
  it('401 clears the local session and explains authentication failure', async () => {
    const { onUnauthorized, request } = setup(new Response('{}', { status: 401 }));
    await expect(request('/auth/profile')).rejects.toMatchObject({
      status: 401,
      kind: 'auth',
      message: expect.stringContaining('authenticate'),
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
  it('403 preserves the session and explains missing permission', async () => {
    const { onUnauthorized, request } = setup(new Response('{}', { status: 403 }));
    await expect(request('/auth/admin')).rejects.toMatchObject({
      status: 403,
      kind: 'forbidden',
      message: expect.stringContaining('required API role'),
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
  it('does not send protected requests without a token', async () => {
    const { getToken, fetcher, request } = setup();
    getToken.mockResolvedValue(null);
    await expect(request('/auth/profile')).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not send a stale token when refresh fails', async () => {
    const { getToken, fetcher, request } = setup();
    getToken.mockRejectedValue(new Error('refresh failed'));
    await expect(request('/auth/profile')).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('network failures are distinct from HTTP authentication failures', async () => {
    const { fetcher, request } = setup();
    fetcher.mockRejectedValue(new TypeError('secret networking detail'));
    await expect(request('/auth/public')).rejects.toMatchObject({ status: null, kind: 'network' });
  });
  it('unexpected HTML is a response error, not a session error', async () => {
    const { request } = setup(new Response('<html>upstream error</html>', { status: 200 }));
    await expect(request('/auth/public')).rejects.toMatchObject({
      kind: 'server',
      message: expect.stringContaining('non-JSON'),
    });
  });
  it('does not expose server error bodies', async () => {
    const { request } = setup(new Response('private upstream information', { status: 500 }));
    await expect(request('/auth/public')).rejects.toMatchObject({
      kind: 'server',
      message: 'The API returned HTTP 500. Try again later.',
    });
  });
});
