# Documentation Index

This directory contains the canonical product, architecture, security and delivery contracts for Kairoseth Product Security / CRA OS.

## Canonical documents

- [`PRODUCT_VISION.md`](PRODUCT_VISION.md) — product thesis, positioning, target users, product boundaries and commercial wedge.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — technical architecture, runtime split, storage strategy, worker model and service boundaries.
- [`PLATFORM_INTEGRATION.md`](PLATFORM_INTEGRATION.md) — explicit contract with `Emmakex/kairoseth-platform`.
- [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) — canonical entities, identifiers and relationships.
- [`CRA_COMPLIANCE_MODEL.md`](CRA_COMPLIANCE_MODEL.md) — CRA-specific operational model and reporting workflow boundaries.
- [`SECURITY_BOUNDARIES.md`](SECURITY_BOUNDARIES.md) — trust boundaries, repository handling, credentials, tenant isolation and evidence integrity.
- [`ROADMAP.md`](ROADMAP.md) — ordered implementation phases and closure criteria.
- [`ENGINEERING_RULES.md`](ENGINEERING_RULES.md) — project-wide implementation, CI, testing and documentation rules.
- [`FOUNDATION_V0_1_ACCEPTANCE.md`](FOUNDATION_V0_1_ACCEPTANCE.md) — Phase 1 runtime, CI, worker E2E, dependency-security and ES/EN acceptance evidence.
- [`PHASE2_INVENTORY.md`](PHASE2_INVENTORY.md) — Product / Repository / Release inventory contract.
- [`PHASE2_INVENTORY_ACCEPTANCE.md`](PHASE2_INVENTORY_ACCEPTANCE.md) — Phase 2 tenant, idempotency, immutable release identity, worker E2E and CI acceptance evidence.

## Current delivery state

```text
Phase 0 — Documentation / architecture baseline   COMPLETE
Phase 1 — Foundation v0.1                        COMPLETE / MERGED / MAIN VERIFIED
Phase 2 — Product / Repository / Release         ACCEPTED / MERGE PENDING
Phase 3 — GitHub App connector                   NEXT AFTER MAIN VERIFICATION
```

Phase 3 must not begin until the Phase 2 merge is verified by green CI on `main`.

## Documentation authority

When implementation and documentation disagree, the discrepancy must be resolved explicitly. Security, authorization, evidence integrity, regulatory-deadline and source-retention behavior must never be silently changed in code.

## Change discipline

Architecture changes require documentation in the same change set when they alter any of the following:

- trust boundaries;
- customer data retention;
- source-code handling;
- tenant isolation;
- Kairoseth Platform integration;
- regulatory rule evaluation;
- incident timing semantics;
- evidence immutability/integrity;
- external connector permissions;
- AI authority boundaries;
- infrastructure dependencies.

## Language contract

Customer-facing Product Security features, statuses, errors, notifications and workflows ship in **Spanish and English together**. ES/EN parity is part of acceptance and must not be deferred to a later translation-only phase.

## External regulatory sources

Primary implementation references must prioritize official sources. Current baseline sources:

- European Commission CRA overview: https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
- European Commission CRA reporting: https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
- European Commission CRA implementation: https://digital-strategy.ec.europa.eu/en/factpages/cyber-resilience-act-implementation
- ENISA Product Security / CRA Single Reporting Platform: https://www.enisa.europa.eu/topics/product-security

Legal and regulatory interpretation must be versioned. Product behavior must never depend solely on an LLM interpretation of CRA text.