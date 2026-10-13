# Architecture

## Objective

Kairoseth Product Security must add product-security computation and regulatory evidence capabilities without recreating the shared Kairoseth application platform.

The architecture is therefore split into two planes:

```text
┌─────────────────────────────────────────────┐
│              Kairoseth Platform             │
│                                             │
│ Auth · Organizations · RBAC · Billing       │
│ Product UI · i18n · Audit · AI adapters     │
└──────────────────────┬──────────────────────┘
                       │ versioned integration contract
                       ▼
┌─────────────────────────────────────────────┐
│       Kairoseth Product Security Engine     │
│                                             │
│ Inventory · SBOM · Vulnerabilities · Risk   │
│ Evidence Graph · CRA Rules · Incidents      │
└──────────────────────┬──────────────────────┘
                       │ jobs
                       ▼
┌─────────────────────────────────────────────┐
│        Isolated Product Security Worker     │
│                                             │
│ Git clone · Syft · Trivy · parsers          │
│ correlation · evidence generation           │
└─────────────────────────────────────────────┘
```

## Shared Kairoseth plane

`Emmakex/kairoseth-platform` remains authoritative for:

- user authentication;
- organization identity;
- product entitlements;
- product-scoped roles;
- Platform Admin authority;
- billing foundations;
- public/product UI shell;
- customer workspace navigation;
- shared audit conventions;
- localization;
- provider-neutral AI model access.

Product Security must not create a second identity system.

## Product Security engine

This repository is authoritative for:

- products-under-analysis metadata;
- repositories and connector installations;
- release inventory;
- SBOM documents and normalized component inventory;
- vulnerability source data and correlated findings;
- exploitability/impact assessments;
- product-risk records;
- regulatory rule versions;
- evidence metadata and graph relations;
- incidents;
- deadline computation;
- reporting-package generation;
- background-analysis jobs;
- worker execution protocol.

## Persistence

### Primary database

Use **MongoDB Atlas** as the initial persistence layer to align with Kairoseth Platform and avoid parallel infrastructure.

Initial logical collections:

```text
ps_products
ps_repositories
ps_connector_installations
ps_releases
ps_sboms
ps_components
ps_component_occurrences
ps_vulnerability_records
ps_findings
ps_assessments
ps_risks
ps_controls
ps_evidence
ps_graph_nodes
ps_graph_edges
ps_incidents
ps_incident_events
ps_notifications
ps_reporting_packages
ps_jobs
ps_rule_sets
ps_audit_events
```

Collection names may change during implementation, but tenant keys and domain boundaries must remain explicit.

### Evidence blobs

MVP:

- small evidence documents may be stored in MongoDB/GridFS;
- every stored artifact receives a SHA-256 digest;
- immutable revisions are referenced by stable IDs.

Scale path:

- move large blobs to S3-compatible object storage when measured volume justifies it;
- preserve MongoDB as the metadata, graph and authorization reference;
- object-store migration must not alter evidence IDs or integrity hashes.

### No additional databases by default

Do not introduce PostgreSQL, Redis, Neo4j, Elasticsearch or another primary datastore without a documented architecture decision backed by a measured requirement.

## Job queue

The MVP uses MongoDB-backed jobs.

A job contains at least:

```text
jobId
organizationId
productId
repositoryId?
type
status
priority
attempt
leaseOwner?
leaseExpiresAt?
createdAt
startedAt?
completedAt?
inputRef
resultRef?
error?
```

Workers claim queued jobs using an atomic lease operation. A worker may reclaim an expired lease after safety checks.

Initial job types:

```text
repository_inventory
generate_sbom
normalize_sbom
refresh_vulnerability_sources
correlate_vulnerabilities
reassess_product
preserve_evidence
prepare_reporting_package
cleanup_workspace
```

## Worker

The worker is a separate runtime from the web application.

Initial toolchain:

```text
Node.js 22
Git
Syft
Trivy
CycloneDX tooling/parsers
custom package-manifest parsers where needed
```

Grype may be evaluated later; it is not a mandatory initial dependency if Trivy + OSV/source correlation cover the first acceptance scope.

### Worker execution lifecycle

```text
claim authorized job
      ↓
create isolated temporary workspace
      ↓
obtain short-lived repository access
      ↓
clone exact requested ref/commit
      ↓
record commit identity
      ↓
run bounded analysis
      ↓
produce normalized artifacts
      ↓
calculate hashes
      ↓
persist results/evidence
      ↓
destroy source workspace
      ↓
record cleanup result
      ↓
complete job
```

Source cleanup failure is an actionable security failure, not a warning to ignore.

## Connectors

### GitHub first

The first connector is a GitHub App.

Principles:

- installation-based authorization;
- least-privilege permissions;
- repository selection by the customer;
- server-side credentials only;
- short-lived installation tokens for analysis;
- webhook signatures verified server-side;
- installation/repository identity pinned and stored;
- installation revocation detected and reflected.

GitLab and Bitbucket are later adapters behind a provider-neutral repository interface.

### Connector abstraction

```text
RepositoryProvider
├── listRepositories()
├── getRepository()
├── listRefs()
├── listReleases()
├── getCommitIdentity()
├── createEphemeralAccess()
└── verifyWebhook()
```

Provider-specific metadata must not leak into the core domain where a neutral representation is sufficient.

## Vulnerability intelligence

Sources are adapters, not authorities by themselves.

Initial candidate sources:

- OSV;
- NVD/CVE data;
- CISA KEV;
- EPSS;
- GitHub advisory/security metadata where authorized;
- ecosystem-specific sources where justified.

The system stores source provenance and observation timestamps. A finding must distinguish:

```text
vulnerability record
≠ component match
≠ affected release
≠ exploitable condition
≠ reportable CRA event
```

These are separate states with separate evidence.

## Evidence Graph

MongoDB stores graph-like domain relationships explicitly.

Canonical relationship examples:

```text
Product      --HAS_RELEASE--> Release
Release      --HAS_SBOM-----> SBOM
SBOM         --CONTAINS-----> ComponentOccurrence
Component    --AFFECTED_BY--> Vulnerability
Finding      --AFFECTS------> Release
Assessment   --ASSESSES-----> Finding
Risk         --DERIVED_FROM-> Assessment
Incident     --INVOLVES-----> Finding
Incident     --HAS_EVIDENCE-> Evidence
Release      --REMEDIATES---> Finding
```

The graph is append-oriented for historical evidence. Current-state projections may be mutable, but historical decisions and evidence revisions must remain traceable.

## CRA rules engine

Regulatory workflow logic is versioned and deterministic.

A rule evaluation records:

```text
ruleSetVersion
ruleId
inputs
source references
result
reason codes
evaluatedAt
softwareVersion
humanReviewState
```

Rules may identify a **potential reporting obligation**. Final workflow transitions requiring legal/regulatory judgment can require authorized human confirmation.

Rules must never be implemented only inside LLM prompts.

## Incident timing

Incident deadlines are computed from explicit awareness timestamps and rule-set semantics.

The system must retain:

- original awareness timestamp;
- who/what established it;
- timestamp timezone/normalization;
- deadline calculation inputs;
- rule version;
- any authorized correction and its reason;
- all reminders/escalations.

Changing a deadline must create an auditable event; it must not silently overwrite history.

## AI layer

Kairoseth Platform model adapters are reused where possible.

AI can assist with:

- source-grounded summaries;
- impact explanations;
- evidence-gap suggestions;
- risk rationale drafts;
- reporting drafts;
- customer/security advisory drafts.

AI output is stored as generated content with model/provider metadata where appropriate. It does not become evidence of an external fact unless backed by source data.

## Deployment

Initial topology:

```text
Hostinger / Kairoseth Platform
           │
           ├── MongoDB Atlas
           │
           └── Product Security API contract
                         │
                         ▼
              dedicated Docker worker
```

The worker may run on existing approved Kairoseth compute if isolation and operational limits are acceptable. A separate dedicated runtime is preferred once private customer repository analysis begins.

Kubernetes is explicitly out of scope for MVP.

## Observability

Minimum operational telemetry:

- job lifecycle;
- connector failures;
- webhook verification failures;
- repository clone duration/failure;
- SBOM generation duration;
- vulnerability-source freshness;
- cleanup success/failure;
- evidence persistence failures;
- rule evaluation failures;
- deadline scheduler failures;
- notification delivery failures.

Logs must not contain repository credentials, installation tokens, source-code content or other secrets.

## Architecture acceptance

Architecture v0 is accepted when implementation can begin without unresolved questions about:

- identity authority;
- tenant authority;
- repository credential ownership;
- source retention;
- worker isolation;
- primary datastore;
- evidence integrity;
- AI authority;
- regulatory rule authority;
- Kairoseth Platform responsibilities.