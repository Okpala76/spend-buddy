import type {
  KeycloakInitOptions,
  KeycloakLoginOptions,
  KeycloakLogoutOptions,
  KeycloakTokenParsed,
} from 'keycloak-js';

export type AuthUser = {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
};

export type AuthSnapshot = {
  initialized: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  expiresAt: number | null;
  error: string | null;
};

export const INITIAL_AUTH: AuthSnapshot = {
  initialized: false,
  authenticated: false,
  user: null,
  accessToken: null,
  expiresAt: null,
  error: null,
};

/** Small adapter boundary, allowing offline tests without mocking cryptography. */
export interface AuthClient {
  authenticated?: boolean;
  token?: string;
  tokenParsed?: KeycloakTokenParsed;
  init(options: KeycloakInitOptions): Promise<boolean>;
  login(options?: KeycloakLoginOptions): Promise<void>;
  register(options?: KeycloakLoginOptions): Promise<void>;
  createLogoutUrl(options?: KeycloakLogoutOptions): string;
  updateToken(minValidity: number): Promise<boolean>;
  clearToken(): void;
  onAuthSuccess?: () => void;
  onAuthRefreshSuccess?: () => void;
  onAuthRefreshError?: () => void;
  onAuthLogout?: () => void;
  onTokenExpired?: () => void;
}

export function userFromClaims(
  claims: Record<string, unknown>,
  apiClientId: string,
): AuthUser | null {
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  const resourceAccess = claims.resource_access;
  let roles: string[] = [];
  if (resourceAccess && typeof resourceAccess === 'object') {
    const client = (resourceAccess as Record<string, unknown>)[apiClientId];
    if (client && typeof client === 'object') {
      const candidate = (client as Record<string, unknown>).roles;
      if (Array.isArray(candidate))
        roles = candidate.filter((role): role is string => typeof role === 'string');
    }
  }
  const text = (key: string) => (typeof claims[key] === 'string' ? claims[key] : undefined);
  // Claims shown in the UI are informational. NestJS is the authorization boundary.
  return {
    id: claims.sub,
    username: text('preferred_username'),
    email: text('email'),
    firstName: text('given_name'),
    lastName: text('family_name'),
    roles: [...new Set(roles)],
  };
}
