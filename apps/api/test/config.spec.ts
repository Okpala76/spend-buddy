import { describe, expect, it } from '@jest/globals';
import { parseEnvironment } from '../src/config/environment.js';
import { readApiRoles } from '../src/auth/jwt-verifier.service.js';

const valid = {
  NODE_ENV: 'development',
  FRONTEND_ORIGIN: 'http://localhost:3000',
  KEYCLOAK_ISSUER: 'https://identity.example.com/realms/test',
  KEYCLOAK_AUDIENCE: 'spend-buddy-api',
};

describe('Fail-fast environment validation', () => {
  it('validates and coerces a port with safe loopback binding by default', () => {
    expect(parseEnvironment({ ...valid, PORT: '3001' })).toMatchObject({
      PORT: 3001,
      HOST: '127.0.0.1',
    });
  });
  it.each([
    '*',
    'http://localhost:3000/',
    'https://user:password@example.com',
    'https://example.com/path',
  ])('rejects unsafe origin %s', (origin) => {
    expect(() => parseEnvironment({ ...valid, FRONTEND_ORIGIN: origin })).toThrow();
  });
  it('rejects HTTP identity servers outside loopback tests', () => {
    expect(() =>
      parseEnvironment({ ...valid, KEYCLOAK_ISSUER: 'http://localhost:8080/realms/test' }),
    ).toThrow();
  });
  it('requires HTTPS frontend in production', () => {
    expect(() => parseEnvironment({ ...valid, NODE_ENV: 'production' })).toThrow();
  });
  it('missing issuer fails without dumping values', () => {
    expect(() => parseEnvironment({ ...valid, KEYCLOAK_ISSUER: undefined })).toThrow(
      'KEYCLOAK_ISSUER',
    );
  });
  it('errors do not contain arbitrary environment content', () => {
    try {
      parseEnvironment({ ...valid, KEYCLOAK_ISSUER: 'secret-value' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-value');
    }
  });
});

describe('Defensive API-role extraction', () => {
  it.each([null, undefined, 'user', [], 1, { 'spend-buddy-api': null }])(
    'ignores malformed resource_access',
    (claim) => {
      expect(readApiRoles(claim, 'spend-buddy-api')).toEqual([]);
    },
  );
  it('only keeps unique strings from the configured audience', () => {
    expect(
      readApiRoles(
        { 'spend-buddy-api': { roles: ['user', 7, 'user'] }, other: { roles: ['admin'] } },
        'spend-buddy-api',
      ),
    ).toEqual(['user']);
  });
});
