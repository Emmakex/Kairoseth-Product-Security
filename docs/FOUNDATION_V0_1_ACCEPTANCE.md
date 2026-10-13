# Foundation v0.1 Acceptance

## Scope

This document records the pre-merge acceptance evidence for Phase 1 — Foundation v0.1 of Kairoseth Product Security / CRA OS.

Pull request: **#1 — Foundation v0.1: runtime, Mongo job leases, worker and CI**

Accepted pre-merge head before this documentation-only closure update:

```text
373b14e533a155590e0f1b9bf64f48965e41e286
```

Canonical CI acceptance run:

```text
Run ID: 38423778865
Run number: 13
Result: success
```

## Accepted runtime foundation

- Node.js 22 runtime contract;
- TypeScript strict mode;
- validated environment configuration;
- structured Pino logging with secret redaction;
- MongoDB connection layer;
- tenant-scoped job documents with `organizationId`;
- atomic MongoDB lease / complete / fail primitives;
- worker entrypoint with bounded one-shot mode;
- reproducible `package-lock.json` + `npm ci` installs;
- multi-stage Docker worker image running as the `node` user;
- read-only GitHub Actions CI token for normal validation;
- current supported ESLint 10 toolchain;
- Vitest 5.0.4 after resolving vulnerable development dependencies.

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
Test files: 4 passed / 4
Tests:      5 passed / 5
```

Coverage of the acceptance suite includes:

- environment validation;
- MongoDB lease semantics;
- prevention of double lease while an active lease exists;
- lease completion cleanup;
- real worker-entrypoint execution;
- a `noop` job being leased and transitioned to `completed` by the worker.

The worker E2E acceptance test is:

```text
worker integration
→ leases and completes a no-op job through the real worker entrypoint
→ PASS
```

## Security and architecture checks

The accepted Foundation does not introduce customer repository access yet.

The following project boundaries remain intact:

- Kairoseth Platform remains authoritative for authentication, organizations, product-scoped RBAC, billing and customer-facing shell;
- MongoDB-first remains the persistence/queue strategy;
- no PostgreSQL, Redis, Neo4j, Kafka or Kubernetes was introduced;
- no customer source code is persisted or analyzed in this phase;
- no AI authority or CRA decision engine is introduced in this phase;
- normal CI validation has `contents: read` only;
- dependency installation uses lifecycle scripts disabled in CI/Docker foundation stages;
- production and development dependency audits both report zero vulnerabilities at acceptance.

## ES / EN product contract

Foundation v0.1 is engine/runtime work and has no customer-facing interface yet.

The project-wide product requirement is nevertheless binding from this acceptance onward:

> Every customer-facing Product Security surface, status, error, notification and workflow ships in Spanish and English in the same change set. English/Spanish parity is an acceptance criterion, not deferred translation work.

Internal identifiers, storage fields and engineering logs remain locale-neutral where appropriate.

## Phase closure

All Phase 1 exit criteria are satisfied:

```text
clean build                                  PASS
lint/typecheck/tests                         PASS
worker no-op leased job E2E                  PASS
no secrets committed / normal CI read-only   PASS
MongoDB lease semantics tested               PASS
dependency audits                            PASS — 0 vulnerabilities
Docker build                                 PASS
required documentation                       PASS
blockers                                     0
```

**Decision: Foundation v0.1 is accepted for merge.**

After merge, `main` CI must pass before Phase 2 implementation proceeds.