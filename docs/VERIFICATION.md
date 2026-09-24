# Verification record

Prepared on 2026-09-23. Final test runtime: Node.js 22.23.2, npm 11.9.0, Linux.

## Completed

The source ZIP was extracted into a new directory with no dependencies or build artifacts. `npm ci`, `npm run setup` and the entire `npm run check` pipeline passed from that clean extraction.

| Check                              | Result                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run format:check`             | Passed                                                                                                     |
| `npm run lint`                     | Both workspaces passed                                                                                     |
| `npm run typecheck`                | Both workspaces passed                                                                                     |
| API Jest tests                     | 47 passed across 2 suites                                                                                  |
| Web Vitest / Testing Library tests | 29 passed across 3 files                                                                                   |
| `npm run build`                    | NestJS compiled; Next.js production build passed                                                           |
| Compiled-app HTTP smoke tests      | Frontend 200; API health/public 200; missing-token profile/admin 401; allowed-origin preflight 204         |
| Dependency audit                   | Zero known vulnerabilities reported by `npm audit` when checked; not a guarantee against future advisories |

Backend tests include real RSA signature verification, tampered/expired/wrong-issuer/wrong-audience tokens, missing required claims, disallowed token kinds/algorithms, role boundaries, JWKS caching and signing-key rotation. Frontend tests include one-time initialization under Strict Mode, refresh coalescing/failure/logout behavior, identity display without token leakage, API headers and clear 401/403 handling.

The compiled-app HTTP smoke tests used temporary local ports and did not authenticate to your real Keycloak server. They exercised the actual compiled processes, not only controller mocks.

The tested dependency tree emits deprecation notices for ESLint 9 and a transitive development-tooling `glob` version. `npm audit` reported no known vulnerabilities at verification time. These warnings are not an installation failure, but keep dependency maintenance on the production-readiness checklist; do not use `--force` to suppress peer compatibility problems.

## Not completed here

- Real-account login, registration, logout and refresh against your live Keycloak deployment: no test password or live session was used.
- Desktop/mobile visual browser verification: the available remote browser reported `ERR_BLOCKED_BY_CLIENT` when opening the local application. Component tests and HTTP rendering checks passed, but these do not replace a visual check.
- Full development-runner smoke test: this execution environment denied the Unix IPC socket used by the `tsx` CLI (`EPERM`). No permission bypass was attempted. The compiled API and frontend did start and pass HTTP checks; verify the recommended `npm run dev` command on your own machine.
- Running the project on your own Windows/macOS environment. Setup and npm scripts are designed to be cross-platform; the verification host was Linux.
- Deployment, penetration testing, production CSP/rate limiting, email delivery or a financial-data security review.

Complete [KEYCLOAK.md](KEYCLOAK.md)'s manual matrix locally before treating the live integration as confirmed. The source does not depend on hidden credentials, a mock-login switch or a Keycloak admin API token.
