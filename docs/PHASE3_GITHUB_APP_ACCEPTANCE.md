# Phase 3 — GitHub App Connector Acceptance

## Scope

This document records the deterministic and merge-level acceptance evidence for Phase 3 — GitHub App Connector of Kairoseth Product Security / CRA OS.

Product Security pull request:

```text
#3 — Phase 3: GitHub App connector foundation
Merged to main: 7f2be1497e6a8afadaeea50c5f810bf9c7880b78
```

Kairoseth Platform bridge:

```text
#469 — Product Security: GitHub App bridge and ES/EN workspace
Merged to main: 99817fc70933ea4fcaa7596365b99a7d922e20cd
```

Post-merge Product Security CI:

```text
Run ID: 38528074787
validate: success
Docker:   success
```

Kairoseth Platform post-merge checks already proving the shared deployed platform remains healthy include:

```text
Daily growth content guard: success
production-proof:            success
production-smoke:            success
```

These checks do **not** replace the Product Security real GitHub App acceptance gate. Phase 3 remains production-open until the real private-repository E2E passes.

## Accepted deterministic capabilities

The connector implementation proves:

- server-side GitHub App JWT signing using Node crypto;
- GitHub REST API version `2026-03-10`;
- repository-scoped short-lived installation-token requests;
- no installation-token persistence to MongoDB;
- tenant-bound installation mapping;
- explicit selected-repository authorization;
- one-time installation setup state from 32 random bytes;
- setup state persisted only as SHA-256 with TTL;
- atomic setup-state consumption;
- explicit binding to the linked **human GitHub installer user ID**;
- Platform verification that the linked human GitHub user can access the returned installation ID;
- Product Security independent server-side GitHub App installation lookup before tenant binding;
- correct support for installation targets that are either a personal account or a GitHub Organization;
- suspended/revoked installation rejection;
- cross-tenant installation rebind rejection;
- bootstrap discovery of exactly the repositories selected in the verified installation;
- HMAC SHA-256 webhook signature verification before parsing;
- delivery-ID deduplication;
- SHA-256 binding of accepted webhook payloads;
- conflicting delivery-ID replay rejection;
- installation and repository-selection lifecycle handling;
- provider-neutral inventory integration;
- bounded tag inventory;
- exact Git commit SHA capture;
- stable machine-readable connector error codes for ES/EN Platform mapping;
- short-lived scoped Platform → Product Security service authorization.

## CI gates

The post-merge Product Security main run passed:

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

## Deterministic security evidence

### Tenant binding

An installation is globally unique in Product Security storage and cannot be rebound from one Kairoseth organization to another.

The organization identity used by Product Security comes from a short-lived service token issued server-side by Kairoseth Platform after Platform authentication, organization membership, product entitlement and Product Security RBAC have been resolved. The browser does not choose the authoritative tenant ID.

### One-time setup state

The raw setup `state` is returned to the caller but is not stored. MongoDB stores only its SHA-256 hash plus tenant, expected installer identity, timestamps and eventual installation ID.

The setup state is single-use and expiration is checked server-side.

### Human GitHub identity vs installation target

The following identities are deliberately **not treated as the same value**:

```text
linked GitHub human user ID
        != necessarily
GitHub App installation target account ID
```

For a GitHub Organization installation, `installation.account.id` is the Organization ID, not the human installer user ID.

The secure binding therefore works as follows:

```text
Kairoseth user/session
→ explicit Better Auth GitHub link
→ stable human GitHub user ID stored in setup state
→ GitHub App installation on personal account OR Organization
→ GitHub returns state + installation_id
→ Platform validates signed callback context
→ Platform re-checks Kairoseth session/org/Product Security RBAC
→ Platform uses the linked GitHub user's OAuth token to prove that user can access installation_id
→ Platform signs short-lived completion claim including verified installation_id + GitHub user ID
→ Product Security verifies the one-time state and human installer identity
→ Product Security independently fetches installation_id using GitHub App authentication
→ Product Security binds the verified installation target to the Kairoseth tenant
```

This avoids the incorrect assumption that a GitHub Organization ID must equal the installing human user's GitHub ID.

### Repository-scoped credentials

The bootstrap installation token is never persisted and is used only long enough to discover the exact repository IDs selected by the customer.

Normal connector operations request short-lived installation tokens constrained to those stored repository IDs.

Tokens are never written to MongoDB, browser state, model context or application logs.

### Webhook integrity

Inbound webhook processing verifies `X-Hub-Signature-256` against the raw request body before JSON parsing or tenant mutation.

Accepted deliveries persist only bounded evidence such as delivery ID, event, SHA-256 of the raw payload, installation ID, organization ID and receipt timestamp.

An exact signed replay is returned as a duplicate. Reusing a delivery ID with a different event or payload is rejected.

### Revocation

Deleted or suspended GitHub installations become unusable for future connector operations while historical Product Security inventory/evidence remains durable.

## Test determinism correction

During acceptance, installation-lifecycle tests exposed a race between a simulated fixed clock and MongoDB's real TTL monitor.

The tests now use a controlled future clock so MongoDB cannot physically remove the setup document based on host wall-clock time before the application-level expiration assertion executes.

This changes test determinism only; production TTL behavior and application expiration logic are unchanged.

## ES / EN contract

Customer-facing connector copy remains owned by Kairoseth Platform and ships in Spanish and English together.

Product Security exports stable connector codes. Platform maps those codes to localized copy and must never translate by parsing English exception prose.

## Production runtime gate

The deterministic engine and Platform bridge are merged, but the Product Security runtime must still be deployed as two process roles of the same image:

```text
API:    node dist/src/server.js
Worker: node dist/src/worker.js
```

The deployment contract and exact real-E2E procedure are documented in:

```text
docs/PHASE3_PRODUCTION_RUNTIME.md
deploy/docker-compose.production.example.yml
deploy/nginx-product-security.conf.example
```

## Remaining real production gate

Phase 3 is **merged and deterministically verified but not production-closed** until a real registered GitHub App and a real private repository demonstrate:

```text
authenticated Kairoseth user
→ product-security RBAC
→ explicit linked human GitHub identity
→ one-time setup state
→ real GitHub App installation on personal account or Organization
→ secure Setup URL callback
→ Platform proof that linked GitHub user can access installation_id
→ Product Security independent App-side installation verification
→ tenant mapping
→ exact selected private repositories
→ repository inventory + exact default-branch/tag SHA
→ signed removal/revocation webhook
→ future repository access rejected
```

No mock, simulated provider transport or PAT substitutes for this external acceptance.

## Phase decision

```text
connector implementation                       PASS
security boundaries                            PASS
one-time setup state                           PASS
human installer identity binding               PASS
GitHub Organization installation model         PASS
Platform installation association proof        PASS
Product Security App-side verification         PASS
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
Product Security PR merged to main             PASS
Platform bridge PR merged to main              PASS
real GitHub App private-repository E2E          PENDING
```

**Decision: Phase 3 is merged and deterministically verified. Production Phase 3 remains open until the real GitHub App private-repository E2E passes. Phase 4 remains blocked.**
