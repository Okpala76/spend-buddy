import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { exportJWK, generateKeyPair, SignJWT, type JWK, type JWTPayload } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { APP_CONFIG, type AppConfig } from '../src/config/environment.js';
import { configureApp } from '../src/configure-app.js';
import { createJwksResolver, JWKS_RESOLVER } from '../src/auth/jwks.js';

describe('Authentication and authorization with real signed JWTs and local JWKS', () => {
  let app: INestApplication;
  let jwksServer: Server;
  let config: AppConfig;
  let signingKey: CryptoKey;
  let otherKey: CryptoKey;
  let keys: JWK[];
  let fetchCount = 0;

  beforeAll(async () => {
    const first = await generateKeyPair('RS256');
    const second = await generateKeyPair('RS256');
    signingKey = first.privateKey;
    otherKey = second.privateKey;
    keys = [{ ...(await exportJWK(first.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }];
    jwksServer = createServer((_req, res) => {
      fetchCount += 1;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
    const port = (jwksServer.address() as AddressInfo).port;
    config = {
      NODE_ENV: 'test',
      PORT: 3001,
      HOST: '127.0.0.1',
      FRONTEND_ORIGIN: 'http://localhost:3000',
      KEYCLOAK_ISSUER: 'http://127.0.0.1:' + port + '/realms/test',
      KEYCLOAK_AUDIENCE: 'spend-buddy-api',
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(JWKS_RESOLVER)
      .useValue(createJwksResolver(config, { cooldownDuration: 0 }))
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApp(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    jwksServer?.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      jwksServer.close((error) => (error ? reject(error) : resolve())),
    );
  });

  async function token(
    overrides: JWTPayload = {},
    key = signingKey,
    kid = 'test-key',
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      iss: config.KEYCLOAK_ISSUER,
      aud: config.KEYCLOAK_AUDIENCE,
      sub: 'test-subject',
      typ: 'Bearer',
      iat: now,
      exp: now + 300,
      preferred_username: 'testuser',
      email: 'test@example.invalid',
      resource_access: { 'spend-buddy-api': { roles: ['user'] } },
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
      .sign(key);
  }

  function call(path: string, jwt: string) {
    return request(app.getHttpServer())
      .get('/api/auth/' + path)
      .set('Authorization', 'Bearer ' + jwt);
  }

  it('health and public endpoints require no token and never fetch signing keys', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'spend-buddy-api' });
    await request(app.getHttpServer()).get('/api/auth/public').expect(200);
    expect(fetchCount).toBe(0);
  });
  it('missing token returns 401 and WWW-Authenticate, never a stack trace', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/profile').expect(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body).not.toHaveProperty('stack');
    expect(response.body).toHaveProperty('requestId');
  });
  it.each(['Basic abc', 'Bearer', 'Bearer not-a-jwt', 'Bearer a.b.c extra', 'Bearer a.b.c,other'])(
    'rejects malformed Authorization: %s',
    async (header) => {
      await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', header)
        .expect(401);
    },
  );
  it('a normal user accesses profile, safe output excludes the token and raw claims', async () => {
    const jwt = await token();
    const response = await call('profile', jwt).expect(200);
    expect(response.body).toEqual({
      subject: 'test-subject',
      username: 'testuser',
      email: 'test@example.invalid',
      roles: ['user'],
    });
    expect(JSON.stringify(response.body)).not.toContain(jwt);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('caches JWKS across successive requests', async () => {
    const before = fetchCount;
    await call('profile', await token()).expect(200);
    await call('profile', await token()).expect(200);
    expect(fetchCount).toBe(before);
  });
  it('accepts an audience array containing the API', async () => {
    await call('profile', await token({ aud: ['account', 'spend-buddy-api'] })).expect(200);
  });
  it('normal user is forbidden from admin', async () => {
    await call('admin', await token()).expect(403);
  });
  it('an admin may access admin AND profile, without also holding user', async () => {
    const jwt = await token({ resource_access: { 'spend-buddy-api': { roles: ['admin'] } } });
    await call('admin', jwt).expect(200);
    await call('profile', jwt).expect(200);
  });
  it('rejects an invalid signature', async () => {
    await call('profile', await token({}, otherKey)).expect(401);
  });
  it('rejects tampered payloads', async () => {
    const jwt = await token();
    const [header, , signature] = jwt.split('.');
    const payload = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64url');
    await call('profile', header + '.' + payload + '.' + signature).expect(401);
  });
  it.each([
    ['expired', { exp: Math.floor(Date.now() / 1000) - 60 }],
    ['wrong issuer', { iss: 'https://attacker.invalid/realms/test' }],
    ['wrong audience', { aud: 'another-api' }],
    ['future not-before', { nbf: Math.floor(Date.now() / 1000) + 600 }],
    ['future issued-at', { iat: Math.floor(Date.now() / 1000) + 600 }],
    ['missing subject', { sub: undefined }],
    ['empty subject', { sub: '' }],
    ['missing expiry', { exp: undefined }],
    ['missing issued-at', { iat: undefined }],
    ['ID token masquerading as API token', { typ: 'ID' }],
    ['refresh token', { typ: 'Refresh' }],
  ] as [string, JWTPayload][])('rejects %s', async (_label, claims) => {
    await call('profile', await token(claims)).expect(401);
  });
  it('rejects symmetric algorithms even for an otherwise well-formed JWT', async () => {
    const jwt = await new SignJWT({ sub: 'test', typ: 'Bearer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(config.KEYCLOAK_ISSUER)
      .setAudience(config.KEYCLOAK_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(crypto.getRandomValues(new Uint8Array(32)));
    await call('profile', jwt).expect(401);
  });
  it('ignores realm roles, other client roles, and untrusted role headers/query strings', async () => {
    const jwt = await token({
      resource_access: { 'other-api': { roles: ['user', 'admin'] } },
      realm_access: { roles: ['user', 'admin'] },
    });
    await call('profile?role=user', jwt).set('X-Roles', 'admin').expect(403);
    await call('admin', jwt).expect(403);
  });
  it('malformed role collections do not grant access', async () => {
    await call(
      'profile',
      await token({ resource_access: { 'spend-buddy-api': { roles: 'admin' } } }),
    ).expect(403);
  });
  it('supports a new signing key without a restart', async () => {
    const rotated = await generateKeyPair('RS256');
    keys.push({
      ...(await exportJWK(rotated.publicKey)),
      kid: 'rotated-key',
      alg: 'RS256',
      use: 'sig',
    });
    const before = fetchCount;
    await call('profile', await token({}, rotated.privateKey, 'rotated-key')).expect(200);
    expect(fetchCount).toBe(before + 1);
    await call('profile', await token()).expect(200);
  });
  it('CORS allows the exact frontend, including preflight, with no cookies', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/auth/profile')
      .set('Origin', config.FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(config.FRONTEND_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });
  it('does not reflect arbitrary origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/public')
      .set('Origin', 'https://attacker.invalid')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).not.toBe('https://attacker.invalid');
    // The browser enforces the origin comparison; CORS is not API authentication.
  });
});
