# Roadmap

## Delivery principle

Kairoseth Product Security is built in ordered, closable phases. A phase is not complete because code exists; it closes only when implementation, tests, security gates, acceptance evidence and documentation are complete.

The MVP goal is not “all CRA features.” The goal is a reliable end-to-end Product Security loop with the first CRA incident workflow on top.

---

## Phase 0 — Documentation and architecture baseline

**Goal:** freeze product boundaries before implementation.

Deliverables:

- repository README;
- product vision;
- architecture;
- Kairoseth Platform integration contract;
- domain model;
- CRA operating model;
- security boundaries;
- engineering rules;
- roadmap.

Exit criteria:

- no unresolved ownership conflict between repositories;
- MongoDB-first decision documented;
- source-code retention policy documented;
- AI authority boundary documented;
- CRA rule authority documented;
- worker isolation model documented.

Status: **complete / accepted.**

---

## Phase 1 — Foundation v0.1

**Goal:** create the executable project skeleton without product logic drift.

Deliverables:

```text
Node.js 22 project
TypeScript strict mode
configuration schema
structured logging
MongoDB connection layer
job model
core domain types
Docker worker image
unit-test harness
GitHub Actions CI
security/dependency checks
.env.example
```

Required documentation updates:

- actual runtime topology;
- environment-variable contract;
- CI gates.

Exit criteria:

- clean build;
- lint/typecheck/tests pass;
- worker starts and performs a no-op leased job;
- no secrets committed;
- MongoDB job lease semantics tested.

Status: **complete / merged / main verified.**

Canonical acceptance: [`FOUNDATION_V0_1_ACCEPTANCE.md`](FOUNDATION_V0_1_ACCEPTANCE.md).

---

## Phase 2 — Product / Repository / Release Inventory

**Goal:** represent products and exact source/release identity before scanning.

Deliverables:

- Product model;
- Repository model;
- Release model;
- provider-neutral repository interface;
- manual/local test adapter;
- repository inventory jobs;
- exact commit SHA capture;
- release/tag inventory.

Exit criteria:

- one product can own multiple repositories;
- releases resolve to immutable commit identities;
- tenant isolation tests pass;
- inventory is idempotent.

Status: **complete / merged / main verified.**

Canonical contract: [`PHASE2_INVENTORY.md`](PHASE2_INVENTORY.md).

Canonical acceptance: [`PHASE2_INVENTORY_ACCEPTANCE.md`](PHASE2_INVENTORY_ACCEPTANCE.md).

---

## Phase 3 — GitHub App connector

**Goal:** securely connect customer repositories without PAT-based default integration.

Deliverables:

- GitHub App contract;
- installation mapping;
- least-privilege permissions;
- short-lived installation-token flow;
- webhook signature verification;
- delivery deduplication;
- install/revoke lifecycle;
- repository selection;
- one-time tenant-bound installation setup state;
- server-side installation/account verification.

Exit criteria:

- private test repository can be inventoried through a registered GitHub App;
- installer/account identity is verified server-side before tenant binding;
- no reusable repository token is stored;
- revoked installation blocks future access;
- webhook security tests pass;
- cross-tenant installation mapping attacks fail;
- one-time setup state cannot be replayed;
- CI, dependency audits and Docker gates pass;
- customer-facing connector states/errors have an ES/EN mapping contract.

Status: **deterministic implementation accepted on PR #3 / CI run #70; real registered GitHub App private-repository E2E remains the final production gate.**

Canonical contract: [`GITHUB_APP_CONNECTOR.md`](GITHUB_APP_CONNECTOR.md).

Canonical deterministic acceptance: [`PHASE3_GITHUB_APP_ACCEPTANCE.md`](PHASE3_GITHUB_APP_ACCEPTANCE.md).

Phase 4 must not begin until Phase 3 production acceptance is complete. A simulated provider test does not substitute for the real private-repository E2E exit criterion.

---

## Phase 4 — Isolated analysis worker + SBOM

**Goal:** produce a trustworthy SBOM from an exact repository/release while retaining no source code.

Deliverables:

- isolated temporary workspace;
- bounded clone;
- Syft integration;
- CycloneDX output;
- SBOM normalization;
- component/component-occurrence model;
- SHA-256 evidence;
- mandatory workspace cleanup;
- cleanup-failure alert/audit.

Exit criteria:

```text
GitHub repo
→ exact commit
→ temporary clone
→ CycloneDX SBOM
→ normalized components
→ evidence hash
→ source workspace destroyed
```

Security acceptance required before moving to real customer repositories.

---

## Phase 5 — Vulnerability Intelligence

**Goal:** turn component inventory into source-backed vulnerability findings.

Deliverables:

- OSV adapter;
- CVE/NVD source normalization as needed;
- CISA KEV adapter;
- EPSS adapter;
- source freshness metadata;
- finding correlation engine;
- affected/not-affected review states;
- vulnerability inbox projection.

Exit criteria:

- vulnerability source data is distinguishable from product findings;
- each finding links to exact component occurrence/release;
- source provenance retained;
- stale/unavailable upstream sources are visible;
- re-correlation is idempotent.

---

## Phase 6 — Assessment, Risk and Evidence Graph

**Goal:** connect technical findings to decisions and durable evidence.

Deliverables:

- Assessment model;
- Risk model;
- Evidence model;
- graph nodes/edges or equivalent relationship layer;
- immutable evidence revisions;
- supersession/correction flow;
- timeline/history views.

Exit criteria:

- one can trace:

```text
Product
→ Release
→ SBOM
→ Component
→ Vulnerability
→ Finding
→ Assessment
→ Risk
→ Evidence
```

- historical assessment changes remain visible;
- evidence hashes can be independently verified.

---

## Phase 7 — CRA Scope + Rules Engine

**Goal:** add a deterministic regulatory layer without turning AI into the compliance authority.

Deliverables:

- CRA scope questionnaire/model;
- economic-operator role;
- product classification inputs;
- versioned CRA rule sets;
- rule source references;
- rule evaluation records;
- human-review states;
- potential-obligation detection.

Exit criteria:

- every CRA result shows rule-set version and reason codes;
- historical evaluations survive rule updates;
- ambiguous cases become review states, not invented certainty;
- LLM removal does not break core rule evaluation.

---

## Phase 8 — Article 14 Incident Center

**Goal:** operationalize the reporting workflow that is already applicable from 11 September 2026.

Deliverables:

- Incident + IncidentEvent model;
- awareness timestamp controls;
- deadline records;
- 24h / 72h workflow support;
- final-report deadline support according to rule type;
- reminders/escalations;
- finding/release/evidence links;
- remediation/corrective-release links.

Exit criteria:

- awareness time and derived deadlines are auditable;
- deadline corrections create history;
- incident state does not claim external submission without evidence;
- scheduler failure is observable/actionable.

---

## Phase 9 — CRA Reporting Packages

**Goal:** create source-backed, reviewable reporting artifacts.

Deliverables:

- reporting-package schema;
- required-field validation;
- evidence references;
- human approval;
- immutable approved revision;
- export/guided submission;
- submission evidence capture.

Exit criteria:

```text
incident
→ package draft
→ deterministic validation
→ human approval
→ immutable revision
→ export/guided submission
→ submission evidence
```

No claim of automatic ENISA submission unless an officially supported integration has been separately verified.

---

## Phase 10 — Kairoseth Platform Product Workspace

**Goal:** expose the Product Security engine through the shared Kairoseth customer experience.

Deliverables:

- platform registry entry: `product-security`;
- ES/EN public product surface;
- entitlement/RBAC wiring;
- portfolio dashboard;
- product detail;
- vulnerability inbox;
- SBOM/release views;
- evidence/risk views;
- Incident Center;
- reporting-package review UI.

Exit criteria:

- Platform remains authoritative for auth/org/RBAC;
- no duplicate login/customer database;
- responsive ES/EN acceptance;
- product engine failure does not break unrelated Kairoseth products.

---

## Phase 11 — AI-assisted Product Security

**Goal:** add useful source-grounded assistance after deterministic workflows are stable.

Deliverables:

- vulnerability/context summaries;
- impact explanation drafts;
- risk rationale drafts;
- evidence-gap suggestions;
- incident timeline synthesis;
- CRA reporting narrative drafts;
- prompt-injection defenses and context minimization.

Exit criteria:

- core system remains operational without AI;
- AI cannot alter authorization/evidence/deadlines directly;
- generated statements retain source links where appropriate;
- adversarial repository/advisory content cannot become tool instructions.

---

## Phase 12 — Commercial v1 acceptance

**Goal:** prove the system against real Kairoseth products before external customer rollout.

Reference-lab candidates:

```text
kairoseth-platform
puente-verifactu
puente-deca
tactitwin
other approved Kairoseth software products
```

Acceptance proof should include at least:

- connected repository;
- exact release inventory;
- SBOM;
- real vulnerability-source correlation;
- evidence graph;
- assessment/risk history;
- simulated CRA incident workflow;
- deadline generation;
- reporting-package generation;
- cleanup proof;
- tenant/authorization proof;
- CI success;
- blockers = 0 for accepted v1 scope.

---

## Explicitly deferred from MVP

These are not current blockers:

- GitLab connector;
- Bitbucket connector;
- Jira/Linear integration;
- Slack/Teams integration;
- industrial/firmware specialized scanners;
- S3 object storage migration;
- Redis;
- graph database;
- Kubernetes;
- autonomous legal conclusions;
- autonomous external regulatory submission;
- full generic GRC suite;
- every CRA conformity-assessment workflow.

Deferred work must not creep into an earlier phase unless the roadmap is explicitly revised.
