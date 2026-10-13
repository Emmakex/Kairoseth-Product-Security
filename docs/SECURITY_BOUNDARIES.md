# Security Boundaries

## Objective

Kairoseth Product Security processes security-sensitive metadata and may temporarily access private customer repositories. Security boundaries are therefore product requirements, not implementation details.

## Trust boundaries

```text
Customer browser
      │
      ▼
Kairoseth Platform
(auth / org / RBAC)
      │
      ▼
Product Security API
      │
      ├──────────────► MongoDB Atlas
      │
      ▼
Job queue
      │
      ▼
Isolated worker
      │
      ├──────────────► GitHub / future repository providers
      └──────────────► Vulnerability intelligence sources
```

Each boundary requires explicit authentication, authorization and input validation.

## Source-code handling

### Rule

Customer source code is **transient analysis material**, not durable Product Security data.

### Required lifecycle

```text
short-lived repository credential
        ↓
isolated temporary workspace
        ↓
exact authorized ref/commit clone
        ↓
analysis
        ↓
derived artifacts + hashes persisted
        ↓
workspace destroyed
        ↓
cleanup result audited
```

The system must not persist complete customer repositories after analysis unless a future product requirement explicitly changes the policy with customer-facing disclosure and security review.

### Persisted derived data

Allowed durable data includes:

- repository metadata;
- commit SHA/tag/release identity;
- SBOM;
- normalized package/component metadata;
- vulnerability matches;
- scanner findings;
- risk/assessment data;
- evidence hashes;
- bounded excerpts only when explicitly necessary and justified;
- incident/reporting artifacts.

Avoid storing source file contents where metadata/hashes are sufficient.

## Repository credentials

GitHub App installation tokens should be short-lived and obtained only for the authorized job.

Rules:

- no Personal Access Token as the default customer integration;
- no repository credential in browser storage;
- no reusable plaintext token in MongoDB;
- no credentials in logs;
- no credentials in AI context;
- permissions follow least privilege;
- repository selection is explicit;
- installation revocation is honored.

## Webhooks

Inbound provider webhooks must:

1. verify provider signature before processing;
2. identify the installation/provider account;
3. resolve the installation to a tenant server-side;
4. reject unknown/revoked installations;
5. treat payload content as untrusted input;
6. deduplicate delivery IDs;
7. record bounded audit metadata;
8. enqueue work rather than perform heavy analysis synchronously.

## Tenant isolation

Every tenant-owned query and mutation is scoped by `organizationId` obtained from validated server context.

Forbidden patterns:

```text
findById(objectId) and authorize afterwards
client-provided organizationId trusted directly
repository provider membership used as Kairoseth authorization
model deciding authorization
cross-tenant background job without explicit tenant context
```

Preferred pattern:

```text
findOne({
  _id: objectId,
  organizationId: authorizedOrganizationId
})
```

Worker jobs carry immutable tenant context and must validate referenced objects belong to the same tenant before execution.

## Worker isolation

A worker handling untrusted customer repositories must assume repository content can be malicious.

Initial controls:

- dedicated container/runtime;
- non-root execution where supported;
- bounded CPU/memory/time;
- bounded disk/workspace;
- no privileged Docker socket;
- no host filesystem access beyond required workspace;
- no customer code execution by default;
- dependency installation disabled unless a specific analyzer requires it and a sandbox design is approved;
- network access restricted to required endpoints where operationally feasible;
- workspace path unpredictable and job-specific;
- mandatory cleanup.

SBOM generation should prefer static manifest/filesystem analysis rather than executing project build scripts.

## Untrusted repository content

Never trust:

- filenames;
- archive paths;
- package scripts;
- manifest values;
- symlinks;
- Git submodule URLs;
- generated SBOM metadata;
- repository-supplied configuration intended to alter Kairoseth behavior.

Protect against:

- path traversal;
- symlink escape;
- decompression bombs;
- oversized repositories;
- recursive submodule abuse;
- command injection;
- malicious package lifecycle scripts;
- secret exfiltration attempts.

## Secret handling

Secrets must use approved Kairoseth server-side secret storage/runtime configuration.

Never store in Git:

- GitHub App private keys;
- webhook secrets;
- model/API credentials;
- service-to-service secrets;
- MongoDB credentials;
- SMTP credentials.

`.env.example` may document variable names and safe placeholders only.

## Evidence integrity

Every immutable evidence artifact receives:

```text
stable evidence ID
SHA-256
createdAt
source/provenance
actor/system identity
revision identity
```

Approved evidence is append-oriented.

If an artifact must be corrected:

```text
old evidence remains
        ↓
new evidence revision
        ↓
supersedes relationship
        ↓
reason + actor + timestamp
```

Do not silently mutate or delete historical evidence supporting regulatory decisions.

## Audit integrity

Security-relevant actions must be auditable.

Examples:

- repository connected/disconnected;
- repository analyzed;
- worker cleanup failure;
- evidence created/superseded;
- finding disposition changed;
- awareness timestamp created/corrected;
- regulatory state changed;
- reporting package approved;
- external submission evidence added;
- administrative override used.

Audit entries must not expose secrets.

## Vulnerability-source trust

External vulnerability sources may conflict or change.

Store:

- source name;
- source identifier;
- observation timestamp;
- source version/update timestamp when available;
- normalized values;
- raw source reference/hash where practical.

Never erase the distinction between external source claims and Kairoseth assessment.

## AI security boundary

Model output is untrusted generated content.

A model cannot:

- authorize a repository;
- select another tenant;
- retrieve credentials;
- grant roles;
- execute arbitrary worker commands;
- set final reportability alone;
- alter immutable evidence;
- submit regulatory reports without an explicit authorized action.

Repository text, issue text, dependency metadata and advisories may contain prompt-injection content. Treat them as data, not instructions.

## Reporting/submission security

Prepared reporting data may include sensitive vulnerability and incident information.

Requirements:

- authorization gate before export/submission;
- explicit actor identity;
- immutable approved revision;
- exact payload hash;
- submission destination recorded;
- receipt/evidence retained where available;
- secrets/tokens excluded from exported packages.

## Data minimization

Collect and retain only data needed for:

- product/release inventory;
- security assessment;
- evidence and regulatory workflow;
- customer-authorized integration;
- operational auditing.

Do not retain source code simply because it is available during analysis.

## Security acceptance gates

Before private-repository production use, the implementation must demonstrate:

1. tenant isolation tests;
2. GitHub App least-privilege permissions;
3. webhook signature verification;
4. short-lived repository credentials;
5. isolated worker execution;
6. bounded repository analysis;
7. successful workspace destruction;
8. no secrets/source in logs;
9. evidence hash verification;
10. authorization on all sensitive reads/mutations;
11. prompt-injection boundary tests for AI-assisted paths;
12. failure-mode evidence for cleanup and connector revocation.