# Kairoseth Product Security

**Product Security & CRA OS for products with digital elements**

Kairoseth Product Security is the product-security and regulatory-evidence engine for the Kairoseth ecosystem. Its first compliance solution is **CRA OS**, focused on helping manufacturers and software producers operate Cyber Resilience Act workflows continuously rather than treating compliance as a one-off document exercise.

## Mission

Turn product-security activity into a traceable operational chain:

```text
repository
→ release
→ SBOM
→ components
→ vulnerabilities
→ exploitability / impact
→ product risk
→ CRA obligations
→ evidence
→ incident workflow
→ reporting package
```

Kairoseth Product Security is **not** intended to replace Snyk, Trivy, GitHub security tooling or other scanners. Those systems are sensors. Kairoseth provides the product context, evidence history, regulatory workflow and decision layer above them.

## Repository role

This repository is the canonical home of the **Product Security engine**:

```text
Emmakex/Kairoseth-Product-Security
├── repository and release inventory
├── SBOM generation and normalization
├── component inventory
├── vulnerability intelligence
├── product-risk engine
├── CRA rules engine
├── evidence graph
├── incident workflows
├── reporting package generation
└── isolated background worker
```

It does **not** recreate the shared Kairoseth application platform.

Shared capabilities remain in `Emmakex/kairoseth-platform`:

```text
Kairoseth Platform
├── public product surfaces
├── authentication
├── organizations
├── product-scoped RBAC
├── billing foundations
├── customer workspaces
├── platform audit conventions
├── i18n
└── provider-neutral AI adapters
```

The two repositories integrate through an explicit, versioned contract.

## Product identity

```text
Umbrella:  Kairoseth
Area:      Security
Product:   Kairoseth Product Security
Solution:  CRA OS
Slug:      product-security
```

The product name is intentionally broader than CRA. CRA OS is the first regulatory solution. The same product-security evidence can later support additional frameworks without rebuilding the underlying inventory, evidence and incident model.

## Current regulatory context

The EU Cyber Resilience Act entered into force on 10 December 2024. Article 14 reporting obligations apply from **11 September 2026**. The CRA is generally applicable from **11 December 2027**.

For manufacturers, the CRA reporting workflow includes an early warning within 24 hours after becoming aware of a reportable actively exploited vulnerability or severe incident and a fuller notification within 72 hours. Further final-report deadlines depend on the event type and corrective-action timeline.

CRA OS must treat regulatory decisions as high-impact decisions. Deterministic rules, source evidence and human approval remain authoritative; model output is advisory.

Canonical external sources:

- European Commission — CRA overview: https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
- European Commission — CRA reporting obligations: https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
- ENISA — CRA Single Reporting Platform: https://www.enisa.europa.eu/topics/product-security/vulnerability-services/eu-incident-response-and-cyber-crisis-management/single-reporting-platform-srp

## Architecture principles

1. **Reuse Kairoseth Platform first.** Do not create parallel auth, organization, RBAC, billing or customer-identity systems.
2. **MongoDB-first.** No PostgreSQL, Redis, Neo4j or Kubernetes unless a later measured requirement justifies an architecture decision.
3. **Source code is transient.** Private customer repositories are cloned only into isolated temporary workspaces for analysis and are deleted after the job.
4. **Evidence is durable and hash-addressed.** Regulatory evidence is versioned, timestamped and integrity-protected with SHA-256.
5. **AI is not the authority boundary.** Models may analyze, explain and draft; they do not grant permissions, establish legal obligations on their own or submit reports without explicit authorization.
6. **Deterministic regulatory core.** CRA applicability, deadlines and workflow transitions are represented by versioned rules and source provenance.
7. **Tenant isolation everywhere.** Every customer-owned object is scoped to an organization and, where applicable, a Kairoseth product entitlement.
8. **ES and EN ship together** for customer-facing functionality. Statuses, errors, notifications, incident/deadline language, remediation guidance and reporting-review copy are not accepted in only one language.
9. **Minimum sufficient infrastructure.** Start with the shared Kairoseth stack plus an isolated Product Security worker.
10. **Finish before advancing.** Each phase closes implementation, tests, security gates, acceptance evidence and documentation before the next dependency begins.

## MVP

The first sellable technical flow is:

```text
Connect GitHub repository
        ↓
Inventory repository + releases
        ↓
Create CycloneDX SBOM
        ↓
Normalize components
        ↓
Correlate vulnerability intelligence
        ↓
Create Product Security findings
        ↓
Link findings to product / release / evidence
        ↓
Show CRA-relevant workflow when applicable
```

The first regulatory workflow is the **Article 14 Incident Center** with awareness timestamps, deadline computation, evidence preservation, action ownership, draft preparation and human-approved reporting packages.

## Documentation

Start at [`docs/README.md`](docs/README.md).

Core documents:

- [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PLATFORM_INTEGRATION.md`](docs/PLATFORM_INTEGRATION.md)
- [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md)
- [`docs/CRA_COMPLIANCE_MODEL.md`](docs/CRA_COMPLIANCE_MODEL.md)
- [`docs/SECURITY_BOUNDARIES.md`](docs/SECURITY_BOUNDARIES.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/ENGINEERING_RULES.md`](docs/ENGINEERING_RULES.md)
- [`docs/FOUNDATION_V0_1_ACCEPTANCE.md`](docs/FOUNDATION_V0_1_ACCEPTANCE.md)

## Status

```text
Phase 0 — Documentation / architecture baseline   COMPLETE
Phase 1 — Foundation v0.1                        ACCEPTED / merge pending
Phase 2 — Product / Repository / Release         NEXT
```

Foundation v0.1 passed reproducible install, lint, typecheck, 5 tests including real worker no-op E2E, build, full dependency audit, production dependency audit and Docker build with zero known npm vulnerabilities at acceptance.

No later phase may weaken the documented trust boundaries, data-retention rules, authorization model, ES/EN contract, evidence integrity or regulatory workflow semantics without an explicit architecture/documentation update.