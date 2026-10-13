# Phase 2 — Product / Repository / Release Inventory Acceptance

## Scope

This document records the pre-merge acceptance evidence for Phase 2 — Product / Repository / Release Inventory of Kairoseth Product Security / CRA OS.

Pull request: **#2 — Phase 2: Product, repository and release inventory**

Accepted implementation head before documentation-only closure commits:

```text
b3a2786ea555c17628f09366872f4254f355b576
```

Canonical implementation CI acceptance run:

```text
Run ID: 38426390325
Result: success
```

## Accepted inventory model

Phase 2 establishes tenant-safe identity before provider credentials or source scanning are introduced.

Accepted capabilities:

- Product model scoped by `organizationId + productKey`;
- Repository model scoped by `organizationId + productId + provider + externalId`;
- Release observations bound to complete immutable commit identities;
- provider-neutral `RepositoryAdapter` contract;
- deterministic `ManualRepositoryAdapter`;
- repository inventory service;
- `inventory.repository` worker job;
- idempotent repository/release observation;
- preservation of historical release identity when a tag moves;
- tenant-safe relationship validation;
- 40- or 64-character full hexadecimal commit SHA enforcement.

## Provider boundary

Phase 2 intentionally does **not** introduce repository-provider credentials.

Although the domain can represent future providers, the executable Phase 2 adapter is only:

```text
manual
```

GitHub App credentials, installation mapping, short-lived tokens and webhooks belong to Phase 3.

No PAT-based default integration was introduced.

## CI gates

The canonical acceptance run passed all required gates:

```text
npm ci --ignore-scripts        PASS
lint                           PASS
typecheck                      PASS
tests                          PASS
build                          PASS
full npm audit                 PASS — 0 vulnerabilities
production npm audit           PASS — 0 vulnerabilities
Docker build                   PASS
```

## Test evidence

Vitest 5.0.4 executed:

```text
Test files: 6 passed / 6
Tests:      9 passed / 9
```

Phase 2 acceptance coverage includes:

- one product owning multiple repositories;
- repeated identical inventory remaining idempotent;
- cross-tenant repository attachment rejection;
- zero repository/release writes after cross-tenant mismatch;
- moved tag preserving both historical commit observations;
- full immutable commit SHA validation;
- real worker execution of an `inventory.repository` job;
- repository persistence from the real worker entrypoint;
- release persistence with exact commit identity;
- normal Mongo job completion after inventory processing.

Canonical worker E2E proof:

```text
inventory.repository job
→ worker lease
→ provider-neutral manual adapter
→ repository persisted
→ immutable release persisted
→ repository_inventory_completed
→ job completed
```

## Tenant isolation

The Product Security engine validates the product relationship using both identity and tenant scope.

A repository inventory job cannot attach a repository to a Product Security product owned by another organization.

Tenant mismatch is a hard failure and does not create repository/release state.

## Release-history semantics

A release source name such as a Git tag is treated as an observation, not as an immutable identity by itself.

Example accepted behavior:

```text
v2.0.0 → commit A
v2.0.0 → commit B later

Result:
A remains in history
B is added as another release observation
```

This prevents mutable provider refs from rewriting Product Security evidence history.

## ES / EN product contract

Phase 2 is an engine/storage phase and adds no customer-facing interface copy.

The project-wide rule remains binding:

> Every customer-facing Product Security surface, status, error, notification and workflow ships in Spanish and English in the same change set.

Internal collection names, provider identifiers, job types and machine logs remain locale-neutral where appropriate.

## Phase closure

All Phase 2 exit criteria are satisfied in the accepted implementation:

```text
Product model                                  PASS
Repository model                               PASS
Release model                                  PASS
provider-neutral adapter                       PASS
manual adapter                                 PASS
repository inventory job                       PASS
full immutable commit SHA validation           PASS
one product → multiple repositories            PASS
inventory idempotency                          PASS
cross-tenant attachment rejection              PASS
moved tag historical preservation              PASS
worker E2E inventory proof                     PASS
lint / typecheck / tests / build               PASS
full + production dependency audits            PASS — 0 vulnerabilities
Docker build                                   PASS
documentation                                  PASS
ES/EN customer-delivery contract               PASS / binding
blockers                                       0
```

**Decision: Phase 2 inventory is accepted for merge.**

After merge, `main` CI must pass before Phase 3 — GitHub App connector begins.