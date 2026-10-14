# Phase 3 — GitHub App Connector Acceptance

## Scope

This document records the deterministic pre-production acceptance evidence for Phase 3 — GitHub App Connector of Kairoseth Product Security / CRA OS.

Pull request: **#3 — Phase 3: GitHub App connector foundation**

Accepted deterministic implementation head:

```text
48e11938b8fb775e362f2ea0bebf90c22376cf2d
```

Canonical CI acceptance run:

```text
Run number: 70
Run ID:     38521643486
Result:     success
```

This document does **not** mark production Phase 3 complete. Production closure still requires the real registered GitHub App / private-repository E2E described below.

## Accepted deterministic capabilities

The connector implementation now proves:

- server-side GitHub App JWT signing using Node crypto;
- GitHub REST API version `2026-03-10`;
- repository-scoped short-lived installation-token requests;
- no installation-token persistence to MongoDB;
- tenant-bound installation mapping;
- explicit selected-repository authorization;
- one-time installation setup state from 32 random bytes;
- setup state persisted only as SHA-256 with TTL;
- atomic setup-state consumption;
- server-side GitHub installation lookup before tenant binding;
- expected GitHub account enforcement;
- suspended/revoked installation rejection;
- cross-tenant installation rebind rejection;
- HMAC SHA-256 webhook signature verification before parsing;
- delivery-ID deduplication;
- SHA-256 binding of accepted webhook payloads;
- conflicting delivery-ID replay rejection;
- installation and repository-selection lifecycle handling;
- provider-neutral inventory integration;
- bounded tag inventory;
- exact Git commit SHA capture;
- stable machine-readable connector error codes for ES/EN Platform mapping.

## CI gates

The canonical acceptance run passed all deterministic gates:

```text
npm ci --ignore-scripts        PASS
lint                           PASS
typecheck                      PASS
tests                          PASS
build                          PASS
full npm audit                 PASS
production npm audit           PASS
Docker build                   PASS
```

The workflow also now persists failing test output as a short-retention diagnostic artifact whenever `npm test` fails. Successful runs do not upload that artifact.

## Deterministic security evidence

### Tenant binding

An installation is globally unique in Product Security storage and cannot be rebound from one Kairoseth organization to another.

### One-time setup state

The raw setup `state` is returned to the caller but is not stored. MongoDB stores only:

```text
SHA-256(state)
organizationId
expectedAccountId
createdAt
expiresAt
consumedAt?
installationId?
```

The setup state is single-use and expiration is checked server-side.

### Account verification

Before binding an installation to a tenant, Product Security retrieves the installation through GitHub App authentication and requires its account ID to match the server-verified `expectedAccountId` supplied by Kairoseth Platform.

A browser-provided tenant ID or account ID is never sufficient authorization.

### Repository-scoped credentials

Installation-token exchange is limited to the repository IDs already selected for the tenant installation.

The returned installation token exists only in process memory and is never written to MongoDB, browser state, logs or model context.

### Webhook integrity

Inbound webhook processing verifies `X-Hub-Signature-256` against the raw request body before JSON parsing or tenant mutation.

Accepted deliveries persist:

```text
deliveryId
event
SHA-256(raw payload)
installationId
organizationId
receivedAt
```

An exact signed replay is returned as `duplicate`. Reusing a delivery ID with a different event or payload is rejected.

### Revocation

Deleted or suspended GitHub installations become unusable for future connector operations while historical Product Security inventory/evidence remains durable.

## Test determinism correction

During acceptance, the installation-lifecycle tests exposed a race between a simulated fixed clock and MongoDB's real TTL monitor.

The tests now use a controlled future clock so MongoDB cannot physically remove the setup document based on host wall-clock time before the application-level expiration assertion executes.

This changes test determinism only; production TTL behavior and application expiration logic are unchanged.

## ES / EN contract

Customer-facing connector copy remains owned by Kairoseth Platform and must ship in Spanish and English together.

Product Security exports stable connector codes such as:

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

Platform maps those codes to ES/EN copy. It must never translate by parsing English exception text.

## Remaining production gate

Phase 3 is **deterministically accepted but not production-closed** until a real registered GitHub App and a real private repository demonstrate:

```text
Platform-authenticated user
→ Platform authorization for organizationId + product-security
→ server-verified GitHub account identity
→ one-time setup state
→ install GitHub App
→ callback state + installation_id
→ server-side installation/account verification
→ tenant mapping
→ selected private repository
→ repository-scoped short-lived token
→ repository + exact tag SHA inventory
→ revoke/remove access
→ future access rejected
```

No mock, simulated provider transport or PAT substitutes for this external acceptance.

## Phase decision

Deterministic implementation status:

```text
connector implementation                       PASS
security boundaries                            PASS
one-time setup state                           PASS
account-binding enforcement                    PASS
repository-scoped token request                PASS
token non-persistence                          PASS
webhook authentication                         PASS
webhook replay protection                      PASS
revocation                                     PASS
tenant isolation                               PASS
provider-neutral inventory integration         PASS
stable ES/EN error-code contract               PASS
lint / typecheck / tests / build               PASS
full + production dependency audits            PASS
Docker build                                   PASS
deterministic blockers                         0
real GitHub App private-repository E2E          PENDING
```

**Decision: the deterministic Phase 3 implementation is accepted. Production Phase 3 remains open until the real GitHub App E2E gate passes. Phase 4 remains blocked.**
