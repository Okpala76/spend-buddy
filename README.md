# Spend Buddy

A working authentication foundation for Spend Buddy: a Next.js frontend, a NestJS API, and your existing self-hosted Keycloak realm. This is **Phase 1: authentication**, not yet an expense tracker.

The app provides Keycloak login, registration and logout; in-memory tokens with refresh; a signed-in identity panel; and public, user and admin API checks. No application database, bank connection, transaction data or Keycloak admin credentials are needed.

## Start here

Use **Node.js 22.23.2** (the tested version) and npm 10 or newer. Node 24 is allowed by the package engines but was not the final verification runtime. These commands work in PowerShell, Command Prompt, macOS and Linux shells.

Unzip the archive, open a terminal inside its `spend-buddy` folder, then run:

```sh
npm ci
npm run setup
npm run dev
```

Open **http://localhost:3000**. Use `localhost`, not `127.0.0.1`, in the browser: redirect URIs and CORS origins must match exactly. The API runs at http://localhost:3001/api.

`npm run setup` creates `apps/web/.env.local` and `apps/api/.env` from the included examples. It **preserves existing files**. The examples already contain your public Keycloak URL and client IDs; there are no passwords or client secrets to fill in. Internet access is needed to install packages and to sign in to Keycloak.

Press Ctrl+C to stop both apps. If ports 3000 or 3001 are occupied, stop the conflicting local service or deliberately update the app ports, environment values and Keycloak redirects together. Do not change or stop anything on your VPS for this starter.

## First login checklist

1. Check the existing realm/client configuration against [docs/KEYCLOAK.md](docs/KEYCLOAK.md). The starter assumes the renamed realm is exactly `spend-buddy`.
2. Open the frontend. A brief redirect to Keycloak for `check-sso` can happen on page load; the application then returns signed out if there is no existing session.
3. Click **Login** and enter your test account credentials on the Keycloak page, not in this application or in source files.
4. The identity panel should display the account and its `spend-buddy-api` roles.
5. **Call Public API** should return 200. **Call Protected Profile API** should return 200 for a user with the API `user` or `admin` role.
6. **Call Admin API** should return 403 for the ordinary test user. That is a successful authorization test, not a login error.
7. **Test without token** deliberately calls the protected profile endpoint without a token and should return 401. It does not clear a valid session.
8. Try **Refresh token** and **Logout**. Logout clears local identity and navigates to Keycloak to end the SSO session.

Registration creates an identity in Keycloak only. This starter does **not** automatically grant an API role to new users. Assign `spend-buddy-api` → `user` explicitly when testing a newly registered account, then obtain a fresh token. Never make `admin` a default role.

## What is included

| Location                   | Responsibility                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/web`                 | Next.js App Router UI, Keycloak browser adapter, session lifecycle and API client          |
| `apps/api`                 | NestJS routes, JWT signature/claim verification, default-on authentication and role guards |
| `scripts/setup.mjs`        | Cross-platform, non-overwriting environment setup                                          |
| `.github/workflows/ci.yml` | Install, format, lint, types, offline tests and production builds                          |
| `docs/KEYCLOAK.md`         | Existing realm/client settings and manual test matrix                                      |
| `docs/ARCHITECTURE.md`     | Trust boundaries, security choices and extension guidance                                  |
| `docs/VERIFICATION.md`     | What was actually checked and what remains manual                                          |
| `docs/OPENCODE_HANDOFF.md` | Context and guardrails for continuing development                                          |

One root `package-lock.json` controls both workspaces. Run installs from the repository root. The ZIP intentionally excludes `node_modules`, generated builds and local environment files.

## Configuration

### Frontend: `apps/web/.env.local`

```dotenv
NEXT_PUBLIC_KEYCLOAK_URL=https://auth.ogalandlord.com.ng
NEXT_PUBLIC_KEYCLOAK_REALM=spend-buddy
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=spend-buddy-web
NEXT_PUBLIC_KEYCLOAK_API_CLIENT_ID=spend-buddy-api
NEXT_PUBLIC_API_URL=http://localhost:3001
```

These are public values, compiled into the browser bundle. Never place secrets in a `NEXT_PUBLIC_*` variable. Restart development after editing them; rebuild before starting a compiled frontend.

### Backend: `apps/api/.env`

```dotenv
NODE_ENV=development
PORT=3001
HOST=127.0.0.1
FRONTEND_ORIGIN=http://localhost:3000
KEYCLOAK_ISSUER=https://auth.ogalandlord.com.ng/realms/spend-buddy
KEYCLOAK_AUDIENCE=spend-buddy-api
```

The issuer is an exact match, with **no trailing slash**. Its JWKS URL is derived from this trusted configuration; it is never selected from an incoming token. The backend has no client secret because it validates signed access tokens locally using public keys.

Environment files are loaded relative to each workspace. Root npm scripts set that working directory for you. The API validates configuration on startup and fails closed on invalid values. Production requires an HTTPS frontend origin.

## API contract

| Method and path         | Required authentication                    | Expected result                    |
| ----------------------- | ------------------------------------------ | ---------------------------------- |
| `GET /api/health`       | None                                       | 200, process liveness only         |
| `GET /api/auth/public`  | None                                       | 200, public message                |
| `GET /api/auth/profile` | Valid access token + API `user` OR `admin` | 200, safe verified identity fields |
| `GET /api/auth/admin`   | Valid access token + API `admin`           | 200, admin confirmation            |

Missing, malformed, expired, invalid-signature, wrong-issuer or wrong-audience tokens return **401**. A valid token lacking the required API role returns **403**. The health endpoint does not assert that Keycloak is reachable.

Without a token, these checks need no live Keycloak session:

```sh
curl -i http://localhost:3001/api/health
curl -i http://localhost:3001/api/auth/public
curl -i http://localhost:3001/api/auth/profile
```

In Windows PowerShell, use `curl.exe` if `curl` is aliased to another command. The protected call above should return 401.

## Development commands

| Command                                   | Purpose                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                             | Run frontend and API with development reload                       |
| `npm run dev:web` / `npm run dev:api`     | Run one workspace                                                  |
| `npm run lint`                            | ESLint checks                                                      |
| `npm run typecheck`                       | TypeScript checks                                                  |
| `npm test`                                | Offline backend and frontend tests                                 |
| `npm run format` / `npm run format:check` | Apply / check formatting                                           |
| `npm run build`                           | Compile both applications                                          |
| `npm start`                               | Run previously compiled apps using the current local configuration |
| `npm run check`                           | Formatting, lint, types, tests and both builds                     |

`npm start` is useful for a local production-build smoke test; it is not a deployment recipe. Do not run a production `next start` process and `next dev` simultaneously against the same `.next` directory. The Jest command uses Node's experimental VM-module support for ESM; that warning is expected.

## Troubleshooting

| Symptom                                   | Check                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Invalid parameter: redirect_uri`         | Frontend client allows `http://localhost:3000/`; browser uses the same host and port                                   |
| Realm or client not found                 | Realm name is `spend-buddy`, not `master` or `spend_buddy`; client ID is exact                                         |
| Sign-in initialization error              | Environment values, trusted HTTPS certificate, Keycloak availability and frontend client settings; reload after fixing |
| Token endpoint CORS error                 | Keycloak frontend client's Web origins includes exactly `http://localhost:3000`                                        |
| API network/CORS error                    | API running on 3001, `NEXT_PUBLIC_API_URL`, exact `FRONTEND_ORIGIN`, browser console network status                    |
| Profile returns 401 after login           | Access-token `iss`, `aud` includes `spend-buddy-api`, RS256 signing and audience mapper assignment                     |
| Profile returns 403 after login           | API client role missing from `resource_access.spend-buddy-api.roles`; role-scope mappings and fresh token              |
| Admin returns 403 for testuser            | Expected: the normal user should not have the API admin role                                                           |
| Changes to roles are not visible          | Refresh the token, or log out and back in; existing tokens do not change in place                                      |
| Forgot-password email never arrives       | Keycloak SMTP must be configured; this project does not configure email delivery                                       |
| Login works but full name/email is absent | Check user profile values and standard `profile` / `email` client scopes                                               |

Do not paste tokens into online JWT decoders, issue trackers, chat, screenshots or source files. Check claims locally in development tools if needed, and redact them from any support output.

## Scope and limitations

- The frontend is an authentication lab using a browser-held access token, not a BFF/cookie-session implementation. There are no protected server components or server-side user data yet.
- Tokens stay in memory; they are not persisted to application localStorage, sessionStorage or cookies. The Keycloak adapter may store temporary authorization callback state/PKCE data; that is distinct from persisting access or refresh tokens.
- Backend signature, issuer, audience, expiry and roles are authoritative. Decoded frontend claims are only for UI display.
- No automated live login was performed with your real Keycloak test account. Complete the checklist above before building on the integration.
- The project does not install or change Keycloak, Nginx, Certbot, Docker or your VPS.
- Before real users or financial data, complete the production-hardening checklist in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Technical references: [Keycloak JavaScript adapter](https://www.keycloak.org/securing-apps/javascript-adapter), [jose](https://github.com/panva/jose), [NestJS](https://docs.nestjs.com/), [Next.js App Router](https://nextjs.org/docs/app).
