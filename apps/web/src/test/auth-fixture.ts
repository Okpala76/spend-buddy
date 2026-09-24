import { vi } from 'vitest';
import { AuthSession } from '../auth/session';
import type { AuthClient } from '../auth/types';

export const PRIVATE_TEST_TOKEN = 'PRIVATE_ACCESS_TOKEN_DO_NOT_RENDER';

export function fakeClient(authenticated = false): AuthClient {
  const client: AuthClient = {
    authenticated,
    token: authenticated ? PRIVATE_TEST_TOKEN : undefined,
    tokenParsed: authenticated
      ? {
          sub: 'user-123',
          preferred_username: 'testuser',
          email: 'test@example.invalid',
          given_name: 'Test',
          family_name: 'User',
          exp: Math.floor(Date.now() / 1000) + 300,
          resource_access: { 'spend-buddy-api': { roles: ['user'] } },
        }
      : undefined,
    init: vi.fn().mockResolvedValue(authenticated),
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    createLogoutUrl: vi
      .fn()
      .mockReturnValue('https://identity.example.com/logout?id_token_hint=test'),
    updateToken: vi.fn().mockResolvedValue(false),
    clearToken: vi.fn(() => {
      client.authenticated = false;
      client.token = undefined;
      client.tokenParsed = undefined;
      client.onAuthLogout?.();
    }),
  };
  return client;
}

export function testSession(client: AuthClient) {
  const createClient = vi.fn().mockResolvedValue(client);
  const navigate = vi.fn();
  const session = new AuthSession({
    createClient,
    navigate,
    apiClientId: 'spend-buddy-api',
    redirectUri: 'http://localhost:3000/',
  });
  return { session, createClient, navigate };
}
