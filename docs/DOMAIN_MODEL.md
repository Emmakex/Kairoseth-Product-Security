# Domain Model

## Purpose

This document defines the canonical Product Security entities and their relationships. Implementation details may evolve, but identifiers, tenant boundaries and conceptual distinctions must remain explicit.

## Root tenant

Every customer-owned object is scoped by:

```text
organizationId
```

Authorization is always resolved through Kairoseth Platform and `productSlug = product-security`.

## Core entities

### Product

A product with digital elements or software product tracked by Kairoseth.

Minimum fields:

```text
productId
organizationId
name
slug
status
productType
craScopeState
createdAt
updatedAt
```

A Product may reference one or more repositories and releases.

### Repository

A connected source repository.

```text
repositoryId
organizationId
productId
provider
providerRepositoryId
installationId
fullName
defaultBranch
visibility
connectionState
lastObservedAt
```

Repository credentials/tokens are not domain data and must not be persisted here in reusable plaintext form.

### Release

A product release or version snapshot.

```text
releaseId
organizationId
productId
repositoryId?
version
commitSha
tag?
releasedAt?
source
status
```

A release is immutable in identity. Corrections create new observations or metadata revisions rather than changing what commit a historical release referred to.

### SBOM

A Software Bill of Materials generated or imported for a release.

```text
sbomId
organizationId
productId
releaseId
format
specVersion
generator
createdAt
sha256
artifactRef
```

CycloneDX is the initial canonical interchange format.

### Component

Normalized software component identity.

```text
componentId
ecosystem
name
version
purl?
cpe?
licenses?
```

Tenant-independent component identities may be normalized globally, but customer-specific occurrence data remains tenant-scoped.

### ComponentOccurrence

Presence of a component in a specific SBOM/release.

```text
occurrenceId
organizationId
productId
releaseId
sbomId
componentId
direct
scope
path/context?
```

### VulnerabilityRecord

Normalized external vulnerability information.

```text
vulnerabilityId
canonicalId
aliases
summary
sources
publishedAt?
modifiedAt?
```

This object describes a vulnerability, not whether the customer's product is affected.

### Finding

Correlation between a vulnerability and customer product/release context.

```text
findingId
organizationId
productId
releaseId
componentOccurrenceId
vulnerabilityId
matchState
severity
sourceProvenance
firstObservedAt
lastObservedAt
state
```

A Finding does not automatically mean exploitability, risk or CRA reportability.

### Assessment

Human/deterministic/assisted analysis of a finding.

```text
assessmentId
organizationId
findingId
assessmentType
conclusion
rationale
sourceEvidenceIds
createdBy
createdAt
supersedes?
```

Examples:

```text
affected
not_affected
exploitable
not_exploitable
needs_review
```

### Risk

Product-security risk derived from one or more findings/assessments.

```text
riskId
organizationId
productId
releaseIds
severity
likelihood
impact
status
rationale
owner
createdAt
```

### Evidence

Integrity-protected artifact or observation supporting a decision or historical fact.

```text
evidenceId
organizationId
productId
releaseId?
incidentId?
type
source
createdAt
createdBy
sha256
artifactRef
immutableRevision
supersedes?
```

Evidence may include SBOMs, scanner output, release metadata, decision records, timelines, reports and corrective-action proof.

### Incident

Tracked product-security event.

```text
incidentId
organizationId
productId
title
status
awarenessAt
awarenessSource
severity
craWorkflowState
createdAt
updatedAt
```

### IncidentEvent

Append-only event in the incident timeline.

```text
incidentEventId
incidentId
organizationId
type
timestamp
actor
payloadRef
createdAt
```

Examples:

```text
awareness_recorded
finding_linked
potential_reporting_obligation_detected
human_review_requested
deadline_created
early_warning_prepared
early_warning_approved
notification_prepared
corrective_release_linked
incident_closed
```

### ReportingPackage

Reviewable package prepared for an external reporting workflow.

```text
reportingPackageId
organizationId
incidentId
kind
ruleSetVersion
status
payload
sourceEvidenceIds
createdAt
approvedAt?
approvedBy?
sha256
```

A prepared package is not equivalent to a submitted notification.

### RuleSet

Versioned deterministic regulatory logic.

```text
ruleSetId
name
version
effectiveFrom?
effectiveTo?
sourceRefs
publishedAt
```

### Job

Asynchronous worker execution request.

```text
jobId
organizationId
productId
repositoryId?
type
status
attempt
leaseOwner?
leaseExpiresAt?
inputRef
resultRef?
error?
createdAt
```

## Canonical relationships

```text
Organization
  └── Product
      ├── Repository
      ├── Release
      │   └── SBOM
      │       └── ComponentOccurrence
      │           └── Component
      ├── Finding
      │   ├── VulnerabilityRecord
      │   └── Assessment
      ├── Risk
      ├── Evidence
      └── Incident
          ├── IncidentEvent
          ├── Evidence
          └── ReportingPackage
```

## Important distinctions

The implementation must preserve these distinctions:

```text
vulnerability exists
≠ component matches
≠ release is affected
≠ condition is exploitable
≠ product risk is high
≠ CRA event is reportable
≠ notification has been submitted
```

Conflating these states creates both security and regulatory risk.

## Historical integrity

Current-state projections may be updated for UX/performance, but historical evidence, assessments, incident events and approved reporting packages are append-oriented.

Corrections should use:

```text
supersedes
correctedBy
reason
actor
timestamp
```

rather than destructive overwrite.

## IDs

Internal IDs should be opaque and non-semantic. External provider IDs are stored separately.

Do not use GitHub repository name, release tag or CVE alias as the sole primary key for tenant-owned objects.