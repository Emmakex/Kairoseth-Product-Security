# Phase 2 — Product / Repository / Release Inventory

## Purpose

Phase 2 establishes exact product and source identity before Kairoseth Product Security gains provider credentials or scans customer repositories.

The inventory layer answers three questions deterministically:

```text
Which Kairoseth customer organization owns the product?
Which repository/source belongs to that product?
Which immutable commit identity was observed for each release/ref?
```

This phase deliberately precedes the GitHub App connector.

## Collections

```text
product_security_products
product_security_repositories
product_security_releases
```

Every root customer-owned record includes `organizationId` and every relationship lookup includes tenant scope in the MongoDB predicate.

## Product

Canonical identity:

```text
organizationId + productKey
```

`productKey` is normalized to lowercase and accepts letters, numbers and hyphens, with a maximum length of 63 characters.

A product may own multiple repositories.

## Repository

Canonical observation identity:

```text
organizationId
+ productId
+ provider
+ externalId
```

The same external repository identifier may exist in different customer organizations without collision. It may also be associated with different products inside one organization if the business model requires it.

Provider values are domain-capable (`manual`, `github`, `gitlab`, `bitbucket`) but **Phase 2 executes only the `manual` adapter**. GitHub credentials and remote access belong to Phase 3.

## Release

A release observation is bound to a complete immutable commit identifier.

Accepted commit identifiers:

```text
40 hexadecimal characters
or
64 hexadecimal characters
```

Abbreviated SHAs are rejected.

Canonical release observation identity:

```text
organizationId
+ repositoryId
+ sourceKind
+ sourceName
+ commitSha
```

`sourceKind` is one of:

```text
tag
commit
manual
```

A tag is not treated as immutable. If the same tag later resolves to a different commit, Kairoseth creates another release observation instead of overwriting the historical observation.

Example:

```text
v2.0.0 → commit A   first observation
v2.0.0 → commit B   later observation

Result:
2 historical release observations
```

This is required for auditability and later evidence generation.

## Provider-neutral adapter

The engine depends on a provider-neutral contract:

```text
RepositoryAdapter
├── provider
├── inspectRepository(input)
└── listReleases(input)
```

Phase 2 includes a deterministic `ManualRepositoryAdapter` used for tests, internal imports and worker acceptance.

Phase 3 will implement a GitHub App adapter without changing the inventory persistence contract.

## Inventory job

New worker job:

```text
inventory.repository
```

Phase 2 job execution accepts only:

```text
provider = manual
```

The payload contains a Product Security `productId`, repository descriptor and release observations. The authoritative tenant is always the job's root `organizationId`; a payload cannot override it.

The worker validates the payload, inventories the repository and releases, and then completes the normal Mongo-backed job lease.

## Idempotency

Repeating the same inventory input must not create duplicate repositories or releases.

Expected behavior:

```text
first inventory
repositoryCreated = true
releasesCreated = N

same inventory again
repositoryCreated = false
releasesCreated = 0
```

Observation timestamps may advance while first-observed history remains intact.

## Tenant isolation

A repository cannot be attached to a product from another organization.

Required predicate:

```text
product._id = productId
AND product.organizationId = job.organizationId
```

The same principle applies to repository/release relationships.

Cross-tenant mismatch is a hard failure and writes no repository/release records.

## ES / EN

Phase 2 is an engine/storage phase and introduces no customer-facing UI copy.

The binding project rule remains:

> Any customer-facing Product Security label, status, validation message, notification or workflow must ship in Spanish and English in the same change set.

Internal collection names, job types and machine identifiers remain locale-neutral.

## Phase 2 acceptance targets

Phase 2 is complete only when all are true:

```text
Product model                                  PASS
Repository model                               PASS
Release model                                  PASS
provider-neutral adapter contract              PASS
manual adapter                                 PASS
repository inventory job                       PASS
full immutable commit SHA validation           PASS
one product → multiple repositories             PASS
same inventory is idempotent                   PASS
cross-tenant attachment rejected               PASS
moved tag preserves historical observations    PASS
worker E2E inventory proof                     PASS
lint / typecheck / tests / build / audits       PASS
Docker build                                   PASS
documentation                                  PASS
blockers                                       0
```
