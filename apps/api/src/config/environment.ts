import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

export const APP_CONFIG = Symbol('APP_CONFIG');

const isLoopback = (hostname: string): boolean =>
  ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.enum(['127.0.0.1', 'localhost', '0.0.0.0', '::']).default('127.0.0.1'),
  FRONTEND_ORIGIN: z.url().refine((value) => {
    const url = new URL(value);
    return url.origin === value && !url.username && !url.password;
  }, 'Must be an exact origin without a path, wildcard or credentials'),
  KEYCLOAK_ISSUER: z.url().refine((value) => {
    const url = new URL(value);
    return (
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password &&
      /^\/realms\/[^/]+$/.test(url.pathname)
    );
  }, 'Must end in /realms/REALM, without a trailing slash, query or credentials'),
  KEYCLOAK_AUDIENCE: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_.-]+$/),
});

export type AppConfig = z.infer<typeof schema>;

export function parseEnvironment(input: Record<string, unknown>): AppConfig {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Report field names, not environment values (which may contain secrets).
    throw new Error(
      'Invalid environment fields: ' +
        [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', '),
    );
  }
  const value = result.data;
  const issuer = new URL(value.KEYCLOAK_ISSUER);
  const origin = new URL(value.FRONTEND_ORIGIN);
  if (
    issuer.protocol !== 'https:' &&
    !(value.NODE_ENV === 'test' && issuer.protocol === 'http:' && isLoopback(issuer.hostname))
  ) {
    throw new Error('KEYCLOAK_ISSUER must use HTTPS (local HTTP allowed only in tests)');
  }
  if (
    origin.protocol !== 'https:' &&
    !(value.NODE_ENV !== 'production' && origin.protocol === 'http:' && isLoopback(origin.hostname))
  ) {
    throw new Error('FRONTEND_ORIGIN must use HTTPS (local HTTP allowed only outside production)');
  }
  return value;
}

export function loadEnvironment(): AppConfig {
  loadDotenv({ quiet: true });
  return parseEnvironment(process.env);
}
