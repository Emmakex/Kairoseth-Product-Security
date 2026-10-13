# Kairoseth Platform Integration Contract

## Purpose

Kairoseth Product Security is a product engine integrated into the shared Kairoseth ecosystem. It must reuse existing platform capabilities rather than recreating them.

This document defines the ownership boundary between:

- `Emmakex/kairoseth-platform`
- `Emmakex/Kairoseth-Product-Security`

## Ownership matrix

| Capability | Kairoseth Platform | Product Security |
|---|---:|---:|
| User authentication | authoritative | consume only |
| Organization identity | authoritative | consume only |
| Product entitlement | authoritative | consume only |
| Customer RBAC | authoritative | enforce server-side from platform context |
| Platform Admin authority | authoritative | consume only |
| Billing foundation | authoritative | expose metering/usage inputs |
| Public product pages | authoritative | provide product content/state |
| Customer navigation/shell | authoritative | provide product workspace payloads |
| i18n conventions | authoritative | ship ES/EN product copy |
| Shared model adapters | authoritative | consume where suitable |
| Product/repository inventory | no | authoritative |
| SBOM | no | authoritative |
| Component inventory | no | authoritative |
| Vulnerability correlation | no | authoritative |
| Product-security risk | no | authoritative |
| CRA rules | no | authoritative |
| Evidence Graph | no | authoritative |
| Product-security incidents | no | authoritative |
| Reporting packages | no | authoritative |
| Analysis worker | no | authoritative |

## Product identity

Canonical platform registration:

```text
area: Security
product: Kairoseth Product Security
slug: product-security
solution: CRA OS
```

Authorization must resolve against the platform product slug `product-security`.

## Authorization contract

The shared Kairoseth authorization model remains authoritative:

```text
(userId, organizationId, productSlug)
→ owner | admin | member | no-access
```

Product Security must never infer access from:

- browser-local state;
- organization IDs supplied without server validation;
- repository ownership alone;
- GitHub installation membership alone;
- model output;
- billing metadata alone.

Every Product Security operation that reads or mutates tenant data requires validated server-side platform context.

## Service-to-service identity

The Product Security engine/worker must receive a bounded service identity rather than a reusable end-user credential.

Desired properties:

- server-only secret or signed token;
- audience restricted to Product Security;
- organization/product scope included when appropriate;
- short expiration where feasible;
- explicit action scope for sensitive operations;
- rotation supported;
- never exposed to the browser or model context.

The exact implementation can follow established Kairoseth internal patterns, but the trust properties above are mandatory.

## API boundary

Product Security should expose versioned internal endpoints/contracts rather than direct cross-repository collection coupling.

Suggested namespace:

```text
/internal/product-security/v1/...
```

Example capabilities:

```text
GET  /products
POST /products
GET  /products/:id
POST /repositories/connect
POST /repositories/:id/analyze
GET  /releases
GET  /sboms/:id
GET  /findings
GET  /incidents
POST /incidents
POST /incidents/:id/actions
POST /reporting-packages
```

Exact route design will be implemented later. The important rule is that Platform must not depend on Product Security's raw Mongo collections.

## Tenant context

Canonical Product Security tenant key:

```text
organizationId
```

Every customer-owned root object must include it.

Where platform entitlement matters, requests also carry/resolve:

```text
productSlug = product-security
```

Product-under-analysis IDs are not authorization tenants. A user does not gain access merely by knowing a product ID.

## Auditing

Kairoseth Platform owns shared audit conventions; Product Security owns domain audit events.

Product Security events should include, where applicable:

```text
eventId
organizationId
actorType
actorId
action
objectType
objectId
timestamp
requestId
source
metadata
```

Sensitive domain examples:

```text
repository.connected
repository.accessed
analysis.started
analysis.completed
analysis.workspace_cleanup_failed
sbom.created
finding.assessment_changed
risk.accepted
incident.opened
incident.awareness_timestamp_set
incident.deadline_changed
reporting_package.approved
evidence.created
evidence.superseded
connector.revoked
```

Audit records must not contain credentials or source code.

## Billing and metering

Product Security should expose measurable units without owning the commercial billing authority.

Possible usage dimensions:

```text
active products
connected repositories
analysis runs
stored SBOM revisions
active monitored releases
incident workflows
AI-assisted operations
```

Platform billing decides plans/entitlements. Product Security enforces server-provided entitlements and returns structured limit errors.

## AI integration

Use Kairoseth provider-neutral model adapters where practical.

Product Security supplies bounded, source-grounded context. Platform/model infrastructure supplies provider execution.

Never send to a model by default:

- complete customer repositories;
- repository access tokens;
- secrets found in source;
- unrelated tenant data;
- immutable evidence blobs that are not necessary to the task.

AI access must remain optional for core compliance operation. Deterministic security and CRA workflows must remain useful without an AI provider.

## UI integration

Customer-facing Product Security UI belongs within Kairoseth Platform's accepted visual/navigation system.

Likely surfaces:

```text
/products/product-security
/app/.../product-security
```

Final route names are a Platform concern.

Product Security should return domain state suitable for:

- portfolio overview;
- product detail;
- repository/release inventory;
- SBOM explorer;
- vulnerability inbox;
- risk/evidence views;
- incident center;
- CRA reporting package review.

## Failure boundaries

Product Security unavailability must not break generic Kairoseth authentication or other products.

Platform should be able to represent Product Security states such as:

```text
available
degraded
connector_action_required
analysis_queued
analysis_failed
provider_stale
```

Detailed technical failures remain accessible to authorized operators but customer-facing errors must be actionable and not leak secrets.

## Integration rule

If a required capability already exists generically in Kairoseth Platform, Product Security must reuse it unless an explicit architecture decision documents why the shared capability is insufficient.

This rule is intended to prevent parallel auth, tenant, billing, email, AI and UI infrastructure from emerging inside the Product Security repository.