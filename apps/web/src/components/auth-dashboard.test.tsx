import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-provider';
import { fakeClient, PRIVATE_TEST_TOKEN, testSession } from '../test/auth-fixture';
import { AuthDashboard } from './auth-dashboard';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_URL', 'https://identity.example.com');
  vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_REALM', 'spend-buddy');
  vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_CLIENT_ID', 'spend-buddy-web');
  vi.stubEnv('NEXT_PUBLIC_KEYCLOAK_API_CLIENT_ID', 'spend-buddy-api');
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Spend Buddy identity dashboard', () => {
  it('displays loading state and hides identity until initialized', () => {
    const client = fakeClient();
    vi.mocked(client.init).mockImplementation(() => new Promise(() => undefined));
    const { session } = testSession(client);
    render(
      <AuthProvider session={session}>
        <AuthDashboard />
      </AuthProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    expect(screen.queryByText('User ID')).not.toBeInTheDocument();
  });
  it('shows Login/Register when signed out and initializes only once in Strict Mode', async () => {
    const client = fakeClient();
    const { session } = testSession(client);
    render(
      <StrictMode>
        <AuthProvider session={session}>
          <AuthDashboard />
        </AuthProvider>
      </StrictMode>,
    );
    expect(await screen.findByRole('button', { name: 'Login' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(client.login).toHaveBeenCalledTimes(1);
    expect(client.init).toHaveBeenCalledTimes(1);
  });
  it('displays safe identity and roles but never full access tokens', async () => {
    const { session } = testSession(fakeClient(true));
    render(
      <AuthProvider session={session}>
        <AuthDashboard />
      </AuthProvider>,
    );
    expect(await screen.findByText('user-123')).toBeVisible();
    expect(screen.getByText('testuser')).toBeVisible();
    expect(screen.getByText('user', { exact: true })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeEnabled();
    expect(document.body.textContent).not.toContain(PRIVATE_TEST_TOKEN);
  });
  it('shows missing role guidance for a newly registered unassigned user', async () => {
    const client = fakeClient(true);
    client.tokenParsed!.resource_access = {};
    const { session } = testSession(client);
    render(
      <AuthProvider session={session}>
        <AuthDashboard />
      </AuthProvider>,
    );
    expect(await screen.findByText(/needs a Spend Buddy API role/)).toBeVisible();
  });
  it('403 explains authorization failure and leaves the user signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    const { session } = testSession(fakeClient(true));
    render(
      <AuthProvider session={session}>
        <AuthDashboard />
      </AuthProvider>,
    );
    await screen.findByText('user-123');
    await userEvent.click(screen.getByRole('button', { name: /Call Admin API/ }));
    expect(await screen.findByText(/403 — Signed in/)).toBeVisible();
    expect(screen.getByText('user-123')).toBeVisible();
  });
  it('401 explains authentication failure and removes the stale identity', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const { session } = testSession(fakeClient(true));
    render(
      <AuthProvider session={session}>
        <AuthDashboard />
      </AuthProvider>,
    );
    await screen.findByText('user-123');
    await userEvent.click(screen.getByRole('button', { name: /Call Protected Profile API/ }));
    expect(await screen.findByText(/401 — The API/)).toBeVisible();
    await waitFor(() => expect(screen.queryByText('user-123')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
  });
});
