# Continue with OpenCode

Open this repository root, read `README.md` and `docs/ARCHITECTURE.md`, and run `npm ci`, `npm run setup`, then `npm run check` before making changes.

## Existing decisions

- Spend Buddy is an npm-workspace monorepo: Next.js in `apps/web`, NestJS in `apps/api`.
- This first phase is a functional authentication lab, not a full finance product.
- Use the already-configured external Keycloak server at `https://auth.ogalandlord.com.ng`, realm `spend-buddy`, public frontend client `spend-buddy-web`, API audience/client `spend-buddy-api`.
- Backend authorization reads `resource_access.spend-buddy-api.roles`: ordinary role `user`, privileged application role `admin`.
- Browser login uses Authorization Code + PKCE S256 and in-memory tokens. Backend verifies JWT signatures, issuer, audience, timestamps and token kind through `jose` and trusted JWKS.
- Local ports are 3000 for the frontend and 3001 for the API. Default configuration is development-only and bound locally.

## Guardrails

1. Preserve the existing user work and one root lockfile. Install from the root with npm; do not introduce a second package manager.
2. Do not rebuild Keycloak, alter VPS routing, reset real accounts or provision infrastructure without a separate explicit request.
3. Do not ask for passwords in prompts or source files. Login credentials belong only on the Keycloak sign-in page. No secret belongs in `NEXT_PUBLIC_*` configuration.
4. Never persist access or refresh tokens in localStorage/sessionStorage. Never print them in UI, logs, fixtures copied from production or error reports.
5. Do not bypass auth for convenience. Keep global guards, strict audience/issuer validation and tests for both 401 and 403. UI role checks do not protect API routes.
6. Do not use real Keycloak in automated tests. Extend the offline fixtures, and clearly separate mock tests from live acceptance testing.
7. Keep changes scoped. Ask for product choices that materially affect data ownership, financial behavior or security architecture before implementing them.
8. Run `npm run check` after edits, add meaningful tests, and report any checks that could not run. Do not claim a real-user login was verified when only mocks ran.

## Suggested next instruction

> First review this starter and help me complete the manual Keycloak acceptance checklist. Do not change my server settings automatically. Once auth is confirmed, propose a small Phase 2 expense-tracking vertical slice with a separate application database, per-user ownership, exact money handling and tests. Explain the schema and security decisions before implementing that next phase.

Future product features have deliberately not been guessed or prebuilt. Keep the identity integration working as the app grows.
