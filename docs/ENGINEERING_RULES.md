# Engineering Rules

## Scope

These rules apply to all implementation in `Emmakex/Kairoseth-Product-Security` unless an explicit documented architecture decision overrides a specific rule.

## 1. Reuse Kairoseth Platform first

Do not create parallel systems for capabilities already owned by `Emmakex/kairoseth-platform`, including:

- authentication;
- organizations;
- product-scoped RBAC;
- Platform Admin;
- billing foundations;
- public product shell;
- shared AI-provider abstraction;
- shared localization conventions.

## 2. Authorization is server-authoritative

Every tenant operation resolves authorization server-side.

Never trust:

- browser state;
- model output;
- repository provider membership;
- client-provided tenant IDs without server validation.

## 3. Tenant scope is explicit

Every customer-owned root object includes `organizationId`.

Queries should scope by tenant as part of the database predicate, not fetch globally and authorize afterwards.

## 4. Source code is transient

Private repository contents are temporary analysis inputs.

- clone only authorized refs/commits;
- use isolated temporary workspaces;
- do not persist full source repositories;
- destroy workspace after analysis;
- cleanup failure is a blocking/actionable security event.

## 5. Do not execute customer code by default

Prefer static analysis of repository contents/manifests.

Do not automatically run:

- package lifecycle scripts;
- arbitrary build scripts;
- repository-provided shell commands;
- untrusted containers.

Any future analyzer requiring code execution needs a dedicated sandbox architecture review.

## 6. MongoDB-first

Use MongoDB Atlas and Mongo-backed job leases for the initial architecture.

Do not introduce PostgreSQL, Redis, Neo4j, Elasticsearch, Kafka or Kubernetes without measured need and a documented decision.

## 7. Evidence is append-oriented

Approved/historical evidence is never silently overwritten.

Corrections create new revisions and preserve:

```text
supersedes
reason
actor
timestamp
hash
```

## 8. SHA-256 for artifact integrity

All material evidence artifacts and approved reporting packages must have a SHA-256 digest stored with their metadata.

## 9. AI is advisory

AI can summarize, explain and draft.

AI cannot independently:

- grant authorization;
- establish tenant scope;
- mutate immutable evidence;
- set legal awareness timestamps;
- alter regulatory deadlines;
- make final reportability decisions without configured deterministic/human gates;
- submit external reports.

## 10. Regulatory logic is versioned

CRA rules live in deterministic, versioned rule sets.

Every material evaluation stores:

```text
ruleSetVersion
ruleId
inputs / input hash
reason codes
source references
evaluatedAt
software version
```

Historical evaluations are not rewritten when rules change.

## 11. External sources keep provenance

Vulnerability intelligence and regulatory data must retain:

- source;
- source identifier;
- observation time;
- upstream modified/published time where available;
- normalized representation;
- source reference/hash where practical.

## 12. Distinguish technical states

The code and UI must preserve these distinctions:

```text
vulnerability
≠ finding
≠ affected release
≠ exploitable condition
≠ risk
≠ reportable event
≠ submitted notification
```

## 13. Least privilege connectors

Repository integrations use provider-native app/install models where possible.

For GitHub:

- GitHub App preferred;
- installation token short-lived;
- repository selection explicit;
- webhooks signed and verified;
- revocation honored;
- PAT is not the default product path.

## 14. Secrets never enter unsafe surfaces

Secrets must not appear in:

- Git;
- client bundles;
- logs;
- exception payloads returned to users;
- model prompts/context;
- evidence exports.

`.env.example` contains names/placeholders only.

## 15. Structured actionable failures

Worker/CI/runtime failures should produce structured diagnostics with:

```text
error code
component
operation
safe message
job/request ID
retryability
bounded technical detail
```

Do not reduce meaningful failures to generic “something went wrong” messages.

## 16. Idempotency

Repository inventory, SBOM normalization, vulnerability correlation and webhook processing must be designed to tolerate retries.

Provider delivery IDs and exact source identities should be used for deduplication where available.

## 17. Bounded work

Repository-analysis jobs enforce limits for:

- time;
- disk;
- CPU/memory where runtime supports it;
- repository size;
- archive expansion;
- retries;
- output size.

## 18. ES and EN ship together

Customer-facing features, status names, errors and major documentation surfaces should support Spanish and English in the Kairoseth Platform integration.

Internal engineering docs may use English as the canonical technical language.

## 19. Feature branch → PR → CI → merge

Normal implementation workflow:

```text
feature branch
→ implementation
→ tests
→ documentation
→ PR
→ CI
→ review/acceptance
→ merge
→ production/integration verification where applicable
```

Initial empty-repository documentation bootstrap may be committed directly to establish the baseline. Subsequent implementation follows the normal workflow.

## 20. Minimum sufficient validation

Run the gates required by the changed contract.

Examples:

- domain-only change → unit/type tests;
- connector change → signature/auth/revocation tests;
- worker change → isolation/cleanup tests;
- evidence change → integrity/history tests;
- CRA rules change → deterministic fixtures and versioning tests;
- Platform integration change → RBAC/tenant tests;
- customer-facing change → ES/EN and responsive UX acceptance.

## 21. Finish before advancing

A roadmap phase closes only when all are true:

```text
implementation complete
required tests pass
security gates pass
acceptance evidence recorded
blockers = 0 for scope
documentation updated
```

Do not start the next dependent phase while the current phase is half-accepted.

## 22. Security regressions become institutional memory

Non-obvious security failures and fixes should be documented so they are not reintroduced later.

Suggested future path:

```text
docs/engineering-failures/
```

Each meaningful entry should record:

- symptom;
- root cause;
- impact;
- fix;
- regression test;
- prevention rule.

## 23. Claims must match evidence

Do not claim:

- “CRA compliant” merely because checks pass;
- “submitted” without submission evidence;
- “not affected” without assessment basis;
- “source deleted” without cleanup result;
- “secure” as an absolute property.

Product status language should match actual evidence.

## 24. Dependencies must be justified

Before adding a library/service, ask:

1. Does Kairoseth already have the capability?
2. Can the standard library/current dependency solve it safely?
3. Does the dependency run in the trusted web plane or untrusted worker plane?
4. What permissions/network/filesystem access does it introduce?
5. How will it be updated and monitored?

## 25. Documentation is part of the contract

Any change affecting architecture, trust boundaries, retention, authorization, regulatory semantics or evidence integrity updates the canonical docs in the same PR.