'use client';

import { useState } from 'react';
import { useAuth } from '../auth/auth-provider';
import { ApiError, createApiClient, type ApiEndpoint, type ApiResult } from '../lib/api';
import { readPublicConfig } from '../lib/config';
import { Icon } from './icon';

type Result = {
  endpoint: string;
  data: ApiResult | null;
  error: string | null;
  status: number | null;
};

export function AuthDashboard() {
  const auth = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const disabled = !auth.initialized || busy !== null;

  async function perform(label: string, action: () => Promise<void>) {
    setBusy(label);
    setNotice(null);
    try {
      await action();
    } catch {
      setNotice(
        'The action could not complete. Check your connection and authentication configuration.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function callApi(endpoint: ApiEndpoint, withoutToken = false) {
    setBusy(endpoint);
    setResult(null);
    try {
      const config = readPublicConfig();
      const request = createApiClient({
        baseUrl: config.apiUrl,
        getToken: () => auth.refreshToken(),
        onUnauthorized: () =>
          auth.clearAuth('The API rejected this session. Check configuration or log in again.'),
      });
      const data = await request(endpoint, withoutToken ? false : undefined);
      setResult({ endpoint, data, error: null, status: data.status });
    } catch (error) {
      setResult({
        endpoint,
        data: null,
        status: error instanceof ApiError ? error.status : null,
        error:
          error instanceof ApiError
            ? error.message
            : 'Check your frontend environment configuration.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Spend Buddy home">
          <span className="brand-mark">
            <Icon name="wallet" size={25} />
          </span>
          spend<span>buddy</span>
          <span className="brand-dot">.</span>
        </a>
        <p className="sidebar-label">YOUR WORKSPACE</p>
        <nav aria-label="Workspace">
          <a className="nav-item active" href="#overview">
            <Icon name="shield" />
            Auth overview
            <span className="nav-dot" />
          </a>
          <a className="nav-item" href="#identity">
            <Icon name="user" />
            Your identity
          </a>
          <a className="nav-item" href="#api">
            <Icon name="code" />
            API playground
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Icon name="key" />
          </span>
          <strong>A secure first step.</strong>
          <p>Your money story starts with an identity you control.</p>
          <span className="small-label">SELF-HOSTED KEYCLOAK</span>
        </div>
        <div className="sidebar-footer">
          <span className="environment-dot" />
          LOCAL DEVELOPMENT<span>v0.1</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="separator">/</span>
            <span>Authentication</span>
          </div>
          <span className="local-badge">
            localhost:3000 <span className="environment-dot" />
          </span>
        </header>
        <main id="overview">
          <div className="section-heading">
            <span className="eyebrow">THE FOUNDATION</span>
            <span className="outline-badge">Phase 01 · Authentication lab</span>
          </div>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <h1 id="hero-title">
                A good start for
                <br />
                <em>smarter spending.</em>
              </h1>
              <p>
                One identity. A protected API. Get to know the secure foundation of your Spend Buddy
                workspace.
              </p>
              <div className="hero-meta">
                <Icon name="shield" size={16} />
                <span>Authorization Code + PKCE S256</span>
              </div>
            </div>
            <div className="identity-illustration" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="id-ticket">
                <span className="ticket-label">SPEND BUDDY / IDENTITY</span>
                <div className="ticket-center">
                  <span className="ticket-avatar">
                    <Icon name="user" size={34} />
                  </span>
                  <div>
                    <strong>Your identity.</strong>
                    <span>Your control.</span>
                  </div>
                </div>
                <div className="ticket-bottom">
                  <span className="ticket-dots">•••• •••• ••••</span>
                  <span className="ticket-check">
                    <Icon name="check" size={18} />
                  </span>
                </div>
              </div>
              <span className="floating-shield">
                <Icon name="shield" size={26} />
              </span>
            </div>
          </section>

          <section className="architecture-strip" aria-label="Application architecture">
            <div>
              <span className="step-number">01</span>
              <span>
                <strong>Frontend</strong>
                <small>Next.js · :3000</small>
              </span>
              <Icon name="arrow" size={17} />
            </div>
            <div>
              <span className="step-number">02</span>
              <span>
                <strong>Identity</strong>
                <small>Keycloak · spend-buddy</small>
              </span>
              <Icon name="arrow" size={17} />
            </div>
            <div>
              <span className="step-number">03</span>
              <span>
                <strong>Protected API</strong>
                <small>NestJS · :3001</small>
              </span>
              <Icon name="shield" size={17} />
            </div>
          </section>

          <div className="content-grid">
            <section className="card" id="identity" aria-labelledby="identity-title">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">YOUR SESSION</span>
                  <h2 id="identity-title">Identity & access</h2>
                </div>
                <span className={'status-pill ' + (auth.authenticated ? 'positive' : '')}>
                  <span className="status-dot" />
                  {!auth.initialized
                    ? 'Connecting'
                    : auth.authenticated
                      ? 'Signed in'
                      : auth.error
                        ? 'Needs attention'
                        : 'Signed out'}
                </span>
              </div>
              {auth.error && (
                <div role="alert" className="alert">
                  {auth.error}
                </div>
              )}
              {!auth.initialized ? (
                <div className="empty-state" role="status">
                  <div className="loading-ring" />
                  <h3>Checking your session…</h3>
                  <p>Connecting to your Keycloak realm.</p>
                </div>
              ) : auth.authenticated && auth.user ? (
                <>
                  <div className="user-summary">
                    <span className="user-avatar">
                      <Icon name="user" size={27} />
                    </span>
                    <div>
                      <h3>{auth.user.firstName || auth.user.username || 'Spend Buddy user'}</h3>
                      <p>{auth.user.email || 'No email claim provided'}</p>
                    </div>
                  </div>
                  <dl className="identity-details">
                    <div>
                      <dt>Username</dt>
                      <dd>{auth.user.username || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Full name</dt>
                      <dd>
                        {[auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ') ||
                          'Not provided'}
                      </dd>
                    </div>
                    <div>
                      <dt>User ID</dt>
                      <dd className="mono">{auth.user.id}</dd>
                    </div>
                    <div>
                      <dt>API roles</dt>
                      <dd className="roles">
                        {auth.user.roles.length
                          ? auth.user.roles.map((role) => (
                              <span key={role} className="role-tag">
                                {role}
                              </span>
                            ))
                          : 'No API roles assigned'}
                      </dd>
                    </div>
                    <div>
                      <dt>Access token expires</dt>
                      <dd>
                        {auth.expiresAt
                          ? new Date(auth.expiresAt * 1000).toLocaleTimeString()
                          : 'Unavailable'}
                      </dd>
                    </div>
                  </dl>
                  {!auth.hasRole('user') && !auth.hasRole('admin') && (
                    <p className="hint warning">
                      Sign-in works, but this account needs a Spend Buddy API role before it can
                      access the profile endpoint.
                    </p>
                  )}
                  <div className="button-row">
                    <button
                      className="button secondary"
                      disabled={disabled}
                      onClick={() =>
                        void perform('refresh', async () => {
                          const token = await auth.refreshToken(true);
                          if (token) setNotice('Access token refreshed. Tokens remain in memory.');
                        })
                      }
                    >
                      <Icon name="refresh" size={16} />
                      Refresh Token
                    </button>
                    <button
                      className="button quiet"
                      disabled={disabled}
                      onClick={() => void perform('logout', auth.logout)}
                    >
                      <Icon name="logout" size={16} />
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <span className="large-icon">
                    <Icon name="key" size={29} />
                  </span>
                  <h3>Your workspace starts here</h3>
                  <p>
                    Sign in with your test account or create a new one. Keycloak handles your
                    credentials.
                  </p>
                  <div className="button-row centered">
                    <button
                      className="button primary"
                      disabled={disabled}
                      onClick={() => void perform('login', auth.login)}
                    >
                      Login
                      <Icon name="arrow" size={16} />
                    </button>
                    <button
                      className="button secondary"
                      disabled={disabled}
                      onClick={() => void perform('register', auth.register)}
                    >
                      Register
                    </button>
                  </div>
                </div>
              )}
              {notice && (
                <p className="hint" role="status">
                  {notice}
                </p>
              )}
              <div className="card-footnote">
                <Icon name="shield" size={15} />
                Passwords stay with Keycloak. Tokens stay in memory.
              </div>
            </section>

            <section className="card" id="api" aria-labelledby="api-title">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">MAKE A REQUEST</span>
                  <h2 id="api-title">API playground</h2>
                </div>
                <span className="code-label">REST / JWT</span>
              </div>
              <p className="card-intro">
                See authentication and permissions in action. NestJS verifies each protected
                request.
              </p>
              <div className="endpoint-list">
                <button
                  className="endpoint"
                  disabled={busy !== null}
                  onClick={() => void callApi('/auth/public')}
                >
                  <span className="http-method">GET</span>
                  <span>
                    <strong>Call Public API</strong>
                    <small>/api/auth/public</small>
                  </span>
                  <span className="endpoint-access">Anyone</span>
                  <Icon name="arrow" size={16} />
                </button>
                <button
                  className="endpoint"
                  disabled={disabled}
                  onClick={() => void callApi('/auth/profile')}
                >
                  <span className="http-method">GET</span>
                  <span>
                    <strong>Call Protected Profile API</strong>
                    <small>/api/auth/profile</small>
                  </span>
                  <span className="endpoint-access">user / admin</span>
                  <Icon name="arrow" size={16} />
                </button>
                <button
                  className="endpoint"
                  disabled={disabled}
                  onClick={() => void callApi('/auth/admin')}
                >
                  <span className="http-method">GET</span>
                  <span>
                    <strong>Call Admin API</strong>
                    <small>/api/auth/admin</small>
                  </span>
                  <span className="endpoint-access">admin</span>
                  <Icon name="arrow" size={16} />
                </button>
              </div>
              <div className="diagnostic-row">
                <button disabled={busy !== null} onClick={() => void callApi('/health')}>
                  Check API health
                </button>
                <span>·</span>
                <button
                  disabled={busy !== null}
                  onClick={() => void callApi('/auth/profile', true)}
                >
                  Test without token
                </button>
              </div>
              <div className="response-panel" aria-live="polite">
                <div className="response-heading">
                  <span>RESPONSE</span>
                  <span>
                    {busy?.startsWith('/')
                      ? 'Sending…'
                      : result?.status
                        ? 'HTTP ' + result.status
                        : 'Ready'}
                  </span>
                </div>
                {result ? (
                  <pre className={result.error ? 'response-error' : ''}>
                    {result.error ?? JSON.stringify(result.data?.data, null, 2)}
                  </pre>
                ) : (
                  <div className="response-empty">
                    <Icon name="code" size={24} />
                    <span>Pick an endpoint to see its response.</span>
                  </div>
                )}
              </div>
              <p className="hint">
                A normal user should get <strong>200</strong> on Profile and <strong>403</strong> on
                Admin. Without a token: <strong>401</strong>.
              </p>
            </section>
          </div>
          <footer className="page-footer">
            <span>
              <span className="environment-dot" />
              Authentication starter · no financial data stored
            </span>
            <span>Next.js + NestJS + Keycloak</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
