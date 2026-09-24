import { createRemoteJWKSet, type JWTVerifyGetKey, type RemoteJWKSetOptions } from 'jose';
import type { AppConfig } from '../config/environment.js';

export const JWKS_RESOLVER = Symbol('JWKS_RESOLVER');

export function createJwksResolver(
  config: AppConfig,
  options: RemoteJWKSetOptions = {},
): JWTVerifyGetKey {
  // Trusted configuration only. Never follow jku/x5u URLs supplied inside a JWT.
  const url = new URL(config.KEYCLOAK_ISSUER + '/protocol/openid-connect/certs');
  return createRemoteJWKSet(url, {
    cacheMaxAge: 10 * 60 * 1000,
    cooldownDuration: 30_000,
    timeoutDuration: 5_000,
    ...options,
  });
}
