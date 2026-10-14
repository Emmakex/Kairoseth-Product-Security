# GitHub App Connector Contract

## Purpose

Phase 3 connects customer GitHub repositories to Kairoseth Product Security without making Personal Access Tokens the default integration model.

The connector is a security boundary. It must preserve Kairoseth tenant authorization, use short-lived GitHub credentials, verify webhook authenticity before processing, and never infer Kairoseth access from GitHub membership alone.

## Ownership split

Kairoseth Platform remains authoritative for:

- authenticated user identity;
- `organizationId`;
- Product Security entitlement;
- customer RBAC;
- the server-side proof that the user is allowed to start a GitHub connection for the organization;
- ES/EN customer-facing installation, error and status copy.

Kairoseth Product Security owns:

- GitHub App installation mapping;
- repository selection mapping;
- GitHub App JWT creation;
- short-lived installation-token acquisition;
- webhook verification and delivery deduplication;
- connector revocation state;
- provider-neutral repository inventory integration.

A browser-provided `organizationId`, GitHub repository ownership, or GitHub installation membership is never sufficient authorization.

## GitHub App configuration baseline

Use a GitHub App, not a reusable customer PAT.

Current REST API contract:

```text
X-GitHub-Api-Version: 2026-03-10
Accept: application/vnd.github+json
```

The connector should request only permissions needed by accepted phases.

Phase 3 inventory requires repository metadata plus read access to repository contents/tags. Phase 4 will require read-only Contents permission for bounded Git-over-HTTPS cloning of the exact authorized commit.

Do not request write permissions merely for convenience.

Required webhook lifecycle events for the current connector:

```text
installation
installation_repositories
```

Webhook SSL verification must remain enabled in production.

## Server-only configuration

The runtime contract is:

```text
GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY
GITHUB_WEBHOOK_SECRET
GITHUB_API_BASE_URL=https://api.github.com
```

Rules:

- private key and webhook secret are server-only;
- real values are never committed;
- private key is never persisted in MongoDB;
- installation access tokens are never persisted in MongoDB;
- credentials are never sent to the browser or model context;
- credentials are never included in structured logs;
- secret rotation must not require rewriting customer repository records.

## Secure installation lifecycle

GitHub's setup redirect is not itself an authorization proof. Product Security therefore does not bind an installation to a tenant merely because a browser supplies an `installation_id`.

Canonical flow:

```text
1. Platform authenticates the user.
2. Platform authorizes the user for organizationId + product-security.
3. Platform obtains/validates the GitHub account identity allowed to perform the connection.
4. Product Security receives organizationId + server-verified expected GitHub account ID.
5. Product Security generates 32 random bytes of one-time state.
6. MongoDB stores only SHA-256(state), organizationId, expectedAccountId and expiry.
7. Browser is redirected to the GitHub App installation URL with state.
8. Callback supplies state + installation_id.
9. Product Security verifies state is unexpired/unconsumed.
10. Product Security calls GitHub's App-authenticated installation endpoint server-side.
11. The returned GitHub account ID must equal expectedAccountId.
12. Suspended installations are rejected.
13. State is consumed atomically.
14. Installation is bound to organizationId.
```

Default setup-state lifetime: 10 minutes.

Allowed implementation range: 1 to 30 minutes.

The raw state value is never stored. The stored hash is not an authentication credential once the one-time flow is consumed.

### Platform prerequisite

The `expectedAccountId` must come from a server-verified GitHub identity/authorization flow. It must not be accepted from an untrusted browser field.

A production connector is not accepted until this Platform-side proof is wired and demonstrated end-to-end.

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

`installationId` is globally unique in Product Security storage. An existing installation cannot be rebound to a different Kairoseth organization.

Repository selection is explicit:

```text
repositoryId
fullName
```

A repository adapter call must match:

```text
organizationId
+ active installationId
+ selected repositoryId
```

before an installation token is requested.

## Short-lived token flow

For an authorized repository operation:

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

Installation tokens are cached only in process memory and only while they retain a safety margin before expiry.

The cache key includes organization, installation and repository identity. Every adapter operation re-validates the active installation and explicit repository selection before token use, so a revoked installation blocks future operations even if a token had previously been cached.

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

The English `message` is technical/operator context only. Customer-facing Platform copy maps the stable `code` to Spanish and English and must not expose tokens, private keys, webhook secrets or sensitive provider payloads.

## ES/EN contract

Phase 3 is primarily engine work, but every customer-visible connector surface is bilingual at first release.

Examples that require ES/EN parity:

```text
Connect GitHub / Conectar GitHub
Connection active / Conexión activa
Action required / Acción necesaria
Repository access revoked / Acceso al repositorio revocado
Reconnect GitHub / Volver a conectar GitHub
Repository is no longer selected / El repositorio ya no está seleccionado
Connection expired or invalid / La conexión ha caducado o no es válida
```

Platform translation must consume the stable connector error/status contract and must never depend on parsing English exception text.

## Acceptance boundary

Deterministic CI can prove:

- JWT generation;
- HMAC verification;
- tenant-bound installation storage;
- cross-tenant rebind rejection;
- one-time setup state;
- expected-account enforcement;
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
Platform-authorized user
→ verified GitHub account identity
→ install GitHub App
→ tenant mapping
→ select private repository
→ short-lived token
→ inventory repository + exact tag SHA
→ revoke/remove access
→ future access rejected
```

This external acceptance must not be simulated or marked complete without real credentials and a real test installation.
