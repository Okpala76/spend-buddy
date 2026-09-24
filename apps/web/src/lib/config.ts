export type PublicConfig = {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  apiClientId: string;
  apiUrl: string;
};

export function readPublicConfig(): PublicConfig {
  // Static property access is required for Next.js to inline NEXT_PUBLIC_* values.
  const values = {
    keycloakUrl: process.env.NEXT_PUBLIC_KEYCLOAK_URL,
    realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM,
    clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
    apiClientId: process.env.NEXT_PUBLIC_KEYCLOAK_API_CLIENT_ID,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  };
  if (Object.values(values).some((value) => !value)) {
    throw new Error(
      'Missing frontend configuration. Run npm run setup, then restart the frontend.',
    );
  }
  const config = values as PublicConfig;
  const issuer = new URL(config.keycloakUrl);
  const api = new URL(config.apiUrl);
  if (
    issuer.protocol !== 'https:' ||
    issuer.username ||
    issuer.password ||
    issuer.search ||
    issuer.hash
  ) {
    throw new Error('Keycloak must use an HTTPS URL without credentials or query parameters.');
  }
  const isLocalApi =
    api.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);
  if ((!isLocalApi && api.protocol !== 'https:') || api.origin !== config.apiUrl) {
    throw new Error('API URL must be an HTTPS origin, or local HTTP for development.');
  }
  if (
    ![config.realm, config.clientId, config.apiClientId].every((v) => /^[a-zA-Z0-9_.-]+$/.test(v))
  ) {
    throw new Error('Invalid realm or client identifier.');
  }
  return config;
}
