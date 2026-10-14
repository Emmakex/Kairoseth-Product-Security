# GitHub App Connector Contract

## Purpose

Phase 3 connects customer GitHub repositories to Kairoseth Product Security without making Personal Access Tokens the default integration model.

The connector is a security boundary. It must preserve Kairoseth tenant authorization, use short-lived GitHub credentials, verify webhook authenticity before processing, and never infer Kairoseth access from GitHub membership alone.

## Ownership split

Kairoseth Platform remains authoritative for:

- authenticated Kairoseth user identity;
- `organizationId`;
- Product Security entitlement and product role;
- explicit linked GitHub human-user identity;
- server-side proof that the linked GitHub user can access the installation returned by GitHub;
- customer-facing ES/EN installation, error and status copy.

Kairoseth Product Security owns:

- one-time installation setup state;
- GitHub App installation mapping;
- installation target account metadata;
- repository selection mapping;
- GitHub App JWT creation;
- short-lived installation-token acquisition;
- webhook verification and delivery deduplication;
- connector revocation state;
- provider-neutral repository inventory integration.

A browser-provided `organizationId`, GitHub repository ownership, or bare callback `installation_id` is never sufficient authorization.

## GitHub identity model

GitHub human-user identity and GitHub App installation target account are different concepts and must never be conflated.

```text
Kairoseth user
  → explicitly linked GitHub human user ID

GitHub App installation
  → personal GitHub account OR GitHub Organization
```

For an installation on a GitHub Organization, the installation account ID is the organization's GitHub account ID. It is not expected to equal the human user's GitHub ID.

Platform therefore proves the human installer/manager identity and verifies that this linked GitHub user can access the callback installation. Product Security independently verifies the installation itself through GitHub App authentication.

## GitHub App configuration baseline

Use a GitHub App, not a reusable customer PAT.

Current REST API contract:

```text
X-GitHub-Api-Version: 2026-03-10
Accept: application/vnd.github+json
```

The connector requests only permissions needed by accepted phases.

Phase 3 inventory requires repository metadata plus read access to repository contents/tags. Phase 4 will require read-only Contents permission for bounded Git-over-HTTPS cloning of the exact authorized commit.

Do not request write permissions merely for convenience.

Required lifecycle webhook inputs for the current connector:

```text
installation
installation_repositories
```

Webhook SSL verification must remain enabled in production.

## Server-only configuration

Product Security runtime:

```text
PRODUCT_SECURITY_SERVICE_SECRET
PRODUCT_SECURITY_API_HOST
PRODUCT_SECURITY_API_PORT
GITHUB_APP_ID
GITHUB_APP_SLUG
GITHUB_APP_PRIVATE_KEY
GITHUB_WEBHOOK_SECRET
GITHUB_API_BASE_URL=https://api.github.com
```

Kairoseth Platform uses the same `PRODUCT_SECURITY_SERVICE_SECRET` to create very short-lived, scoped service claims after Platform auth/RBAC checks.

Rules:

- App ID, App slug, private key, webhook secret and service secret are server-side configuration;
- real secret values are never committed;
- private key is never persisted in MongoDB;
- installation access tokens are never persisted in MongoDB;
- credentials are never sent to the browser or model context;
- credentials are never included in structured logs;
- secret rotation must not require rewriting customer repository records.

## Secure installation lifecycle

GitHub's setup redirect is not itself an authorization proof. Product Security does not bind an installation to a tenant merely because a browser supplies an `installation_id`.

Canonical flow:

```text
1. Platform authenticates the Kairoseth user.
2. Platform authorizes organizationId + product-security and requires an Owner/Admin product role for installation management.
3. The authenticated user explicitly links a GitHub identity through Better Auth.
4. Platform obtains the stable linked GitHub human-user ID server-side.
5. Platform signs a short-lived service claim containing organizationId + githubUserId + github:install scope.
6. Product Security generates 32 random bytes of one-time state.
7. MongoDB stores only SHA-256(state), organizationId, expectedInstallerUserId and expiry.
8. Platform stores a separate short-lived signed HttpOnly redirect context bound to organization slug + SHA-256(state).
9. Browser is redirected to the GitHub App installation URL with state.
10. GitHub redirects to Platform's Setup URL with state + installation_id.
11. Platform verifies its signed redirect context, re-authenticates/re-authorizes the Kairoseth user, and re-resolves the linked GitHub identity.
12. Platform uses the linked GitHub user's access token to verify that this user can access the returned installation_id.
13. Only after that proof, Platform signs a short-lived completion claim containing githubUserId + verifiedGitHubInstallationId.
14. Product Security requires the claim's verifiedGitHubInstallationId to equal the callback body installationId.
15. Product Security verifies the one-time state and requires expectedInstallerUserId == githubUserId from the signed Platform claim.
16. Product Security calls GitHub's App-authenticated installation endpoint server-side.
17. Suspended installations are rejected.
18. Product Security records the target account ID/login returned by GitHub. That account may be a person or a GitHub Organization and does not need to equal githubUserId.
19. State is consumed atomically.
20. Installation is bound to organizationId.
21. A bootstrap installation token exists only in memory long enough to list the repositories actually granted to that installation.
22. Those exact repository IDs/names become the durable selected-repository set.
23. Normal operations return to explicit repository_ids-scoped installation tokens.
```

Default setup-state lifetime: 10 minutes.

Allowed implementation range: 1 to 30 minutes.

The raw Product Security state value is never stored. The stored hash is not an authentication credential once the one-time flow is consumed.

## Internal Platform → Product Security service authentication

The internal API accepts a short-lived HMAC SHA-256 service token with bounded claims:

```text
iss = kairoseth-platform
aud = kairoseth-product-security
sub = authenticated Kairoseth user ID
organizationId
productSlug = product-security
scopes = [github:install]
githubUserId
verifiedGitHubInstallationId?  # completion only
iat
exp
jti
```

Token lifetime cannot exceed 120 seconds. The shared secret must contain at least 32 bytes.

The browser never creates this token and never supplies the authoritative tenant or verified installation claim.

## Installation mapping

Canonical durable mapping:

```text
organizationId
installationId
accountId
accountLogin
status: active | revoked
selectedRepositories[]
createdAt
updatedAt
revokedAt?
```

`accountId` / `accountLogin` identify the target GitHub account on which the App is installed. They are not the linked human user's identity proof.

`installationId` is globally unique in Product Security storage. An existing installation cannot be rebound to a different Kairoseth organization.

Repository selection is explicit:

```text
repositoryId
fullName
```

A normal repository adapter call must match:

```text
organizationId
+ active installationId
+ selected repositoryId
```

before a repository-scoped installation token is requested.

## Short-lived token flow

For a normal authorized repository operation:

```text
active tenant-bound installation
        ↓
selected repository check
        ↓
GitHub App JWT
        ↓
POST /app/installations/{installationId}/access_tokens
body: { repository_ids: [repositoryId] }
        ↓
short-lived installation token
        ↓
repository/tag API calls
```

A one-time bootstrap exception exists immediately after a fully verified installation callback. Product Security requests an installation token without `repository_ids` only to discover the repositories GitHub says the customer granted to that installation. That token remains in memory and is not reused for normal inventory jobs.

Installation tokens are never persisted. Every normal adapter operation re-validates the active installation and explicit repository selection before token use, so a revoked installation blocks future operations.

## Repository identity

After token acquisition, the connector retrieves repository metadata from GitHub and verifies that GitHub's returned:

```text
repositoryId
fullName
```

matches the tenant-authorized repository mapping.

A mismatch is a hard failure.

Tags are normalized into Phase 2 immutable release observations:

```text
tag name
→ exact 40-character Git commit SHA
```

Phase 3 bounds tag inventory to 1000 tags per repository operation. Exceeding the bound is an explicit error rather than an unbounded API crawl.

## Webhook verification

Inbound webhook processing order is security-significant:

```text
raw request body
→ verify X-Hub-Signature-256 with HMAC SHA-256
→ validate required delivery/event headers
→ SHA-256 raw body
→ check delivery deduplication
→ parse JSON as untrusted data
→ resolve active installation server-side
→ persist bounded delivery metadata
→ apply supported lifecycle mutation
```

The signature is verified against the raw body before JSON parsing or tenant mutation.

An invalid signature creates no delivery record and performs no connector mutation.

## Delivery deduplication

`X-GitHub-Delivery` is persisted under a unique index together with the event name and SHA-256 of the accepted raw payload.

Exact signed replays are safe even after an installation has been revoked: if the delivery was already accepted and both event + payload hash match, Product Security returns `duplicate` from stored delivery metadata without requiring the installation to remain active.

Reusing the same delivery ID with a different event or payload is rejected as `webhook_delivery_conflict` even when the new payload has a valid webhook signature.

Concurrent duplicate inserts are resolved through the MongoDB unique index and the already persisted delivery record.

## Revocation

Supported revocation inputs include GitHub `installation` events such as deletion or suspension.

Revocation changes the durable connector status to `revoked`. Subsequent new connector operations fail active-installation lookup.

Revocation does not delete historical repository/release inventory or evidence. Historical security/regulatory data must remain traceable.

## Repository-selection changes

`installation_repositories` events update the durable selected-repository set.

Removed repositories stop being usable for new connector operations. Historical Product Security records remain available subject to tenant authorization and retention rules.

## Failure behavior

Connector failures are deterministic and non-secret-bearing. The engine exports `GitHubConnectorError.code` as a stable machine-readable contract.

Current codes:

```text
invalid_input
invalid_webhook_signature
webhook_delivery_conflict
installation_not_active
repository_not_selected
repository_identity_mismatch
setup_state_invalid
installation_suspended
installation_account_mismatch
provider_http_failure
provider_payload_invalid
tag_inventory_bound_exceeded
```

`installation_account_mismatch` is retained as a stable error code for an installer-identity mismatch in the one-time setup flow; it must not be interpreted as requiring the GitHub Organization/account ID to equal the human GitHub user ID.

The English `message` is technical/operator context only. Customer-facing Platform copy maps the stable `code` to Spanish and English and must not expose tokens, private keys, webhook secrets or sensitive provider payloads.

## ES/EN contract

Every customer-visible connector surface is bilingual at first release.

Examples that require ES/EN parity:

```text
Link GitHub identity / Vincular identidad GitHub
Install GitHub App / Instalar GitHub App
Connection active / Conexión activa
Action required / Acción necesaria
Repository access revoked / Acceso al repositorio revocado
Reconnect GitHub / Volver a conectar GitHub
Repository is no longer selected / El repositorio ya no está seleccionado
Connection expired or invalid / La conexión ha caducado o no es válida
```

Platform translation consumes stable status/error codes and must never depend on parsing English exception text.

## Acceptance boundary

Deterministic CI proves:

- JWT generation;
- service-token signing/verification;
- HMAC webhook verification;
- tenant-bound installation storage;
- cross-tenant rebind rejection;
- one-time setup state;
- installer-user identity enforcement;
- Platform-verified installation claim enforcement;
- GitHub Organization installation support where user ID differs from target account ID;
- bootstrap selected-repository discovery;
- repository selection enforcement;
- repository-scoped token request;
- token non-persistence;
- exact repository identity verification;
- tag/release inventory integration;
- exact webhook replay deduplication;
- conflicting delivery rejection;
- revocation behavior;
- stable machine-readable error codes.

Production Phase 3 closure additionally requires a registered GitHub App and a real authenticated private-repository E2E proving:

```text
Kairoseth-authenticated user
→ product-security RBAC
→ explicit linked GitHub identity
→ install GitHub App on personal account or GitHub Organization
→ verify callback installation through linked user's GitHub access
→ tenant mapping
→ selected private repository bootstrap
→ repository-scoped short-lived token
→ inventory repository + exact tag SHA
→ revoke/remove access
→ future access rejected
```

This external acceptance must not be simulated or marked complete without real credentials and a real test installation.
