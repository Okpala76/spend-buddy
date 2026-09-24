# Keycloak integration checklist

This project connects to your existing server. Verify settings rather than recreating the realm or deleting existing clients. All application work belongs in `spend-buddy`, not the administrative `master` realm.

| Value                 | Expected setting                                                                      |
| --------------------- | ------------------------------------------------------------------------------------- |
| Server                | `https://auth.ogalandlord.com.ng`                                                     |
| Realm                 | `spend-buddy`                                                                         |
| Issuer                | `https://auth.ogalandlord.com.ng/realms/spend-buddy`                                  |
| Discovery             | `https://auth.ogalandlord.com.ng/realms/spend-buddy/.well-known/openid-configuration` |
| Public signing keys   | `https://auth.ogalandlord.com.ng/realms/spend-buddy/protocol/openid-connect/certs`    |
| Browser client        | `spend-buddy-web`                                                                     |
| API client / audience | `spend-buddy-api`                                                                     |

If your realm was renamed differently, adjust both environment files to the actual name. Do not silently fall back to `master`.

## Frontend client

In the selected realm, open **Clients → spend-buddy-web**. UI grouping can differ slightly by Keycloak version; use the setting names below.

| Setting                               | Value                                  |
| ------------------------------------- | -------------------------------------- |
| Client type                           | OpenID Connect                         |
| Client authentication                 | Off (public browser client; no secret) |
| Authorization services                | Off                                    |
| Standard flow                         | On                                     |
| Implicit flow                         | Off                                    |
| Direct access grants / password grant | Off                                    |
| Service account roles                 | Off                                    |
| Root URL                              | `http://localhost:3000`                |
| Home URL                              | `http://localhost:3000/`               |
| Valid redirect URIs                   | `http://localhost:3000/`               |
| Valid post logout redirect URIs       | `http://localhost:3000/`               |
| Web origins                           | `http://localhost:3000`                |
| Require PKCE                          | On                                     |
| PKCE method                           | S256                                   |
| Require DPoP-bound tokens             | Off for this starter                   |

The starter always returns to the root URL, so the exact redirect URI is sufficient. If you already have `http://localhost:3000/*`, it supports this lab but is broader than needed. Do not use a global `*` redirect or Web origin. Add only reviewed routes/origins as the application grows.

Use the normal `profile`, `email` and `roles` client scopes/mappers so identity and API role claims are available. This application requests `openid profile email` and expects the API audience mapper to apply by default, not only through an unrequested optional scope.

## API client, roles and audience mapper

The API client identifies a protected resource. It does not need an interactive login flow or a service account for JWT verification. Keep its standard/implicit/direct-grant flows off, and do not place a client secret in the frontend. Client authentication on the API representation does not affect this resource-server validation path; no API client credential is used by this code.

1. Open **Clients → spend-buddy-api → Roles** and verify the client roles `user` and `admin` exist.
2. Open **Clients → spend-buddy-web → Client scopes → spend-buddy-web-dedicated → Mappers** (or the equivalent assigned default client scope).
3. Verify an **Audience** mapper includes the client audience `spend-buddy-api`.
4. **Add to access token: On. Add to ID token: Off.** Adding it to token introspection is optional and unused here. Lightweight access tokens are not used by this starter.
5. Ensure the role mapper and role-scope mappings allow `spend-buddy-api` roles into the frontend client's access token. If Full Scope Allowed is off, explicitly include the needed API roles rather than broadening permissions indiscriminately.

A successfully signed-in ordinary user should receive an access token with these claim shapes (illustrative only, not a usable token):

```json
{
  "iss": "https://auth.ogalandlord.com.ng/realms/spend-buddy",
  "aud": ["spend-buddy-api"],
  "sub": "keycloak-user-id",
  "typ": "Bearer",
  "resource_access": {
    "spend-buddy-api": {
      "roles": ["user"]
    }
  }
}
```

`aud` can be a string or an array and can include other audiences; it must include `spend-buddy-api`. Keep access-token signing at RS256 for this starter. It rejects ID tokens and tokens signed with other algorithms.

## Test users

Use the normal test account you already created. In **Users → that user → Role mapping → Assign role → Client roles**, select `user` under `spend-buddy-api` and save. A realm role named `user`, an account-management role or a role on `spend-buddy-web` is not the same thing.

For an admin-path test, use a separate intentional test identity and assign `spend-buddy-api` → `admin`. This application role does not grant Keycloak server administration. Do not assign Keycloak `master` administrator roles to application users.

Registration being enabled does not grant a Spend Buddy API role automatically. After registering a new test identity, assign the user role manually. If automatic onboarding is added later, design and test that policy separately; never auto-grant admin.

Password resets and email verification require working Keycloak SMTP. Do not enable an email-required action without checking delivery, and do not weaken verification settings just to bypass a delivery issue.

## Manual acceptance matrix

| Scenario                                     | Expected outcome                                                    |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Signed out, public endpoint                  | HTTP 200                                                            |
| No token, protected profile or admin         | HTTP 401                                                            |
| `user` API role, profile                     | HTTP 200 and that user's verified identity                          |
| `user` API role, admin endpoint              | HTTP 403, user remains signed in                                    |
| `admin` API role, profile and admin endpoint | HTTP 200                                                            |
| Valid token, no API roles                    | HTTP 403 on profile and admin                                       |
| Refresh                                      | Session remains valid and expiry updates when a refresh occurs      |
| Logout                                       | Local identity disappears and Keycloak ends the browser SSO session |
| Reload while SSO is active                   | Keycloak check restores the session through a redirect              |
| Newly registered account                     | Signed in; protected API denied until role assignment               |

Role changes and sign-out do not rewrite an already-issued JWT. A cached, valid access token can remain acceptable until expiration; the API does not introspect every request. Keep access-token lifetimes short and add a deliberate revocation strategy if the eventual product requires immediate invalidation.

No server-side changes are applied by running `npm run setup`, the tests or the builds.
