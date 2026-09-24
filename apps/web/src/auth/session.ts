import { INITIAL_AUTH, userFromClaims, type AuthClient, type AuthSnapshot } from './types';

export type SessionOptions = {
  createClient: () => Promise<AuthClient>;
  apiClientId: string;
  redirectUri: string;
  navigate: (url: string) => void;
};

export class AuthSession {
  private snapshot: AuthSnapshot = INITIAL_AUTH;
  private readonly listeners = new Set<() => void>();
  private client: AuthClient | null = null;
  private initialization: Promise<void> | null = null;
  private refresh: Promise<string | null> | null = null;
  private loggingOut = false;
  private ready = false;

  constructor(private readonly options: SessionOptions) {}

  getSnapshot = (): AuthSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(snapshot: AuthSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  private sync(): void {
    if (this.loggingOut) return;
    const client = this.client;
    const user = client?.tokenParsed
      ? userFromClaims(client.tokenParsed, this.options.apiClientId)
      : null;
    const authenticated = Boolean(client?.authenticated && client.token && user);
    this.publish({
      initialized: true,
      authenticated,
      user: authenticated ? user : null,
      accessToken: authenticated ? (client?.token ?? null) : null,
      expiresAt:
        authenticated && typeof client?.tokenParsed?.exp === 'number'
          ? client.tokenParsed.exp
          : null,
      error: null,
    });
  }

  initialize = (): Promise<void> => {
    // One adapter and one promise per browser page, including Strict Mode remounts.
    this.initialization ??= this.initializeOnce();
    return this.initialization;
  };

  private async initializeOnce(): Promise<void> {
    try {
      const client = await this.options.createClient();
      this.client = client;
      client.onAuthRefreshSuccess = () => this.sync();
      client.onAuthRefreshError = () =>
        this.clearAuth('Your session could not be refreshed. Please log in again.');
      client.onAuthLogout = () => this.publish({ ...INITIAL_AUTH, initialized: true });
      client.onTokenExpired = () => {
        void this.refreshToken().catch(() => undefined);
      };
      await client.init({
        onLoad: 'check-sso',
        flow: 'standard',
        pkceMethod: 'S256',
        responseMode: 'fragment',
        checkLoginIframe: false,
        redirectUri: this.options.redirectUri,
        scope: 'openid profile email',
        enableLogging: false,
      });
      this.ready = true;
      this.sync();
    } catch {
      this.publish({
        ...INITIAL_AUTH,
        initialized: true,
        error:
          'Cannot initialize sign-in. Check your .env.local, realm and redirect URLs, then reload.',
      });
    }
  }

  clearAuth = (error: string | null = null): void => {
    this.client?.clearToken();
    this.publish({ ...INITIAL_AUTH, initialized: true, error });
  };

  private async readyClient(): Promise<AuthClient> {
    await this.initialize();
    if (!this.client || !this.ready)
      throw new Error('Authentication is not ready. Reload and try again.');
    return this.client;
  }

  login = async (): Promise<void> => {
    const client = await this.readyClient();
    await client.login({ redirectUri: this.options.redirectUri });
  };

  register = async (): Promise<void> => {
    const client = await this.readyClient();
    await client.register({ redirectUri: this.options.redirectUri });
  };

  logout = async (): Promise<void> => {
    const client = await this.readyClient();
    // Generate the URL before clearToken so the ID-token hint is still available.
    const url = client.createLogoutUrl({ redirectUri: this.options.redirectUri });
    this.loggingOut = true;
    this.clearAuth();
    this.options.navigate(url);
  };

  refreshToken = async (force = false): Promise<string | null> => {
    await this.initialize();
    if (!this.client?.authenticated || this.loggingOut) return null;
    if (this.refresh) return this.refresh;
    this.refresh = (async () => {
      try {
        await this.client!.updateToken(force ? -1 : 30);
        if (this.loggingOut) {
          this.client!.clearToken();
          return null;
        }
        this.sync();
        return this.snapshot.accessToken;
      } catch {
        this.clearAuth('Your session expired or could not be refreshed. Please log in again.');
        throw new Error('Your session could not be refreshed. Please log in again.');
      }
    })();
    try {
      return await this.refresh;
    } finally {
      this.refresh = null;
    }
  };

  startAutoRefresh = (): (() => void) => {
    const timer = setInterval(() => {
      if (this.snapshot.authenticated) void this.refreshToken().catch(() => undefined);
    }, 20_000);
    return () => clearInterval(timer);
  };
}
