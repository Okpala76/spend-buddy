import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { APP_CONFIG, type AppConfig } from '../config/environment.js';
import { JWKS_RESOLVER } from './jwks.js';
import type { AuthenticatedUser } from './auth.types.js';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export function readApiRoles(claim: unknown, audience: string): string[] {
  if (!record(claim)) return [];
  const client = claim[audience];
  if (!record(client) || !Array.isArray(client.roles)) return [];
  return [...new Set(client.roles.filter((role): role is string => typeof role === 'string'))];
}

@Injectable()
export class JwtVerifierService {
  private readonly logger = new Logger(JwtVerifierService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(JWKS_RESOLVER) private readonly getKey: JWTVerifyGetKey,
  ) {}

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      if (token.length > 16_384) throw new Error('Token too large');
      const { payload } = await jwtVerify(token, this.getKey, {
        algorithms: ['RS256'],
        issuer: this.config.KEYCLOAK_ISSUER,
        audience: this.config.KEYCLOAK_AUDIENCE,
        requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud'],
        clockTolerance: 5,
      });
      // Keycloak access-token payloads have typ=Bearer. Reject ID/refresh tokens.
      if (payload.typ !== 'Bearer' || typeof payload.sub !== 'string' || !payload.sub.trim()) {
        throw new Error('Wrong token kind or missing subject');
      }
      if (typeof payload.iat !== 'number' || payload.iat > Date.now() / 1000 + 5) {
        throw new Error('Invalid issued-at claim');
      }
      return {
        subject: payload.sub,
        username: optionalString(payload.preferred_username),
        email: optionalString(payload.email),
        issuer: this.config.KEYCLOAK_ISSUER,
        audience: typeof payload.aud === 'string' ? [payload.aud] : (payload.aud ?? []),
        roles: readApiRoles(payload.resource_access, this.config.KEYCLOAK_AUDIENCE),
      };
    } catch {
      this.logger.warn({ event: 'access_token_rejected' });
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
