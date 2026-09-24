import { describe, expect, it, vi } from 'vitest';
import { fakeClient, PRIVATE_TEST_TOKEN, testSession } from '../test/auth-fixture';
import { userFromClaims } from './types';

describe('Keycloak session lifecycle', () => {
  it('initializes once even when called concurrently (React Strict Mode)', async () => {
    const client = fakeClient();
    const { session, createClient } = testSession(client);
    await Promise.all([session.initialize(), session.initialize(), session.initialize()]);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(client.init).toHaveBeenCalledTimes(1);
    expect(client.init).toHaveBeenCalledWith(
      expect.objectContaining({
        onLoad: 'check-sso',
        flow: 'standard',
        pkceMethod: 'S256',
        responseMode: 'fragment',
        checkLoginIframe: false,
      }),
    );
    expect(session.getSnapshot()).toMatchObject({
      initialized: true,
      authenticated: false,
      accessToken: null,
    });
  });
  it('maps signed-in UI claims without persisting tokens', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const { session } = testSession(fakeClient(true));
    await session.initialize();
    expect(session.getSnapshot()).toMatchObject({
      authenticated: true,
      accessToken: PRIVATE_TEST_TOKEN,
      user: { id: 'user-123', roles: ['user'] },
    });
    expect(local).not.toHaveBeenCalled();
  });
  it('uses a fresh token after updateToken(30) and coalesces refreshes', async () => {
    const client = fakeClient(true);
    const { session } = testSession(client);
    await session.initialize();
    vi.mocked(client.updateToken).mockImplementation(async () => {
      client.token = 'refreshed-token';
      return true;
    });
    const results = await Promise.all([session.refreshToken(), session.refreshToken()]);
    expect(results).toEqual(['refreshed-token', 'refreshed-token']);
    expect(client.updateToken).toHaveBeenCalledTimes(1);
    expect(client.updateToken).toHaveBeenCalledWith(30);
  });
  it('manual refresh forces renewal with -1', async () => {
    const client = fakeClient(true);
    const { session } = testSession(client);
    await session.initialize();
    await session.refreshToken(true);
    expect(client.updateToken).toHaveBeenCalledWith(-1);
  });
  it('refresh failure clears identity and tokens', async () => {
    const client = fakeClient(true);
    const { session } = testSession(client);
    await session.initialize();
    vi.mocked(client.updateToken).mockRejectedValue(new Error('sensitive vendor error'));
    await expect(session.refreshToken()).rejects.toThrow('Please log in again');
    expect(client.clearToken).toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({
      authenticated: false,
      accessToken: null,
      user: null,
    });
    expect(session.getSnapshot().error).not.toContain('sensitive');
  });
  it('refresh failure event clears state', async () => {
    const client = fakeClient(true);
    const { session } = testSession(client);
    await session.initialize();
    client.onAuthRefreshError?.();
    expect(session.getSnapshot().authenticated).toBe(false);
  });
  it('builds logout URL before clearing the token and navigates to Keycloak', async () => {
    const client = fakeClient(true);
    const { session, navigate } = testSession(client);
    await session.initialize();
    await session.logout();
    expect(client.createLogoutUrl).toHaveBeenCalledWith({ redirectUri: 'http://localhost:3000/' });
    expect(vi.mocked(client.createLogoutUrl).mock.invocationCallOrder[0]!).toBeLessThan(
      vi.mocked(client.clearToken).mock.invocationCallOrder[0]!,
    );
    expect(navigate).toHaveBeenCalledWith('https://identity.example.com/logout?id_token_hint=test');
    expect(session.getSnapshot().accessToken).toBeNull();
  });
  it('does not restore a session if an in-flight refresh finishes after logout', async () => {
    const client = fakeClient(true);
    const { session } = testSession(client);
    await session.initialize();
    let finish: () => void = () => undefined;
    vi.mocked(client.updateToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => {
            client.token = 'late-token';
            client.authenticated = true;
            resolve(true);
          };
        }),
    );
    const refreshing = session.refreshToken();
    await Promise.resolve();
    await session.logout();
    finish();
    expect(await refreshing).toBeNull();
    expect(session.getSnapshot().authenticated).toBe(false);
    expect(client.token).toBeUndefined();
  });
  it('login and registration use Keycloak redirects, not password collection', async () => {
    const client = fakeClient();
    const { session } = testSession(client);
    await session.login();
    await session.register();
    expect(client.login).toHaveBeenCalledWith({ redirectUri: 'http://localhost:3000/' });
    expect(client.register).toHaveBeenCalledWith({ redirectUri: 'http://localhost:3000/' });
  });
  it('initialization failure shows a safe error and prevents actions on a broken adapter', async () => {
    const client = fakeClient();
    vi.mocked(client.init).mockRejectedValue(new Error('vendor internals'));
    const { session } = testSession(client);
    await session.initialize();
    expect(session.getSnapshot()).toMatchObject({ initialized: true, authenticated: false });
    expect(session.getSnapshot().error).toContain('Cannot initialize');
    await expect(session.login()).rejects.toThrow('not ready');
  });
  it('does not refresh a signed-out session', async () => {
    const client = fakeClient();
    const { session } = testSession(client);
    expect(await session.refreshToken()).toBeNull();
    expect(client.updateToken).not.toHaveBeenCalled();
  });
});

describe('Frontend display claims', () => {
  it('uses only the API client roles, not realm or unrelated roles', () => {
    expect(
      userFromClaims(
        {
          sub: 'a',
          realm_access: { roles: ['admin'] },
          resource_access: {
            other: { roles: ['admin'] },
            'spend-buddy-api': { roles: ['user', 42, 'user'] },
          },
        },
        'spend-buddy-api',
      )?.roles,
    ).toEqual(['user']);
  });
  it('does not invent a user without a subject or an application role without assignment', () => {
    expect(userFromClaims({}, 'spend-buddy-api')).toBeNull();
    expect(userFromClaims({ sub: 'a' }, 'spend-buddy-api')?.roles).toEqual([]);
  });
});
