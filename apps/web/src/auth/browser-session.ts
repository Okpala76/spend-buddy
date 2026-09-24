import { readPublicConfig } from '../lib/config';
import { AuthSession } from './session';

declare global {
  interface Window {
    __spendBuddyAuthSession?: AuthSession;
  }
}

export function getBrowserSession(): AuthSession {
  if (typeof window === 'undefined') throw new Error('Browser-only authentication');
  window.__spendBuddyAuthSession ??= new AuthSession({
    apiClientId: process.env.NEXT_PUBLIC_KEYCLOAK_API_CLIENT_ID ?? 'spend-buddy-api',
    redirectUri: window.location.origin + '/',
    navigate: (url) => window.location.assign(url),
    createClient: async () => {
      const config = readPublicConfig();
      const { default: Keycloak } = await import('keycloak-js');
      return new Keycloak({
        url: config.keycloakUrl,
        realm: config.realm,
        clientId: config.clientId,
      });
    },
  });
  return window.__spendBuddyAuthSession;
}
