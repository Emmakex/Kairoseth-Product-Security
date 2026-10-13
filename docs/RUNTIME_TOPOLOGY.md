# Runtime Topology — Foundation v0.1

## Purpose

This document records the executable runtime introduced by Phase 1. It does not change the ownership boundaries defined in `ARCHITECTURE.md` and `PLATFORM_INTEGRATION.md`.

## Runtime

```text
Kairoseth Platform
  | authenticated / authorized command
  v
MongoDB Atlas
  | product-security jobs + engine data
  v
Kairoseth Product Security worker (Node.js 22, Docker)
```

Phase 1 implements only the worker foundation and Mongo-backed job lease. Product logic begins in later phases.

## Worker guarantees

- Node.js 22 runtime.
- TypeScript strict build.
- One process can run continuously or once (`--once`).
- Jobs are claimed with an atomic MongoDB `findOneAndUpdate` lease.
- Active leases cannot be claimed by another worker until expiry.
- Completion requires the same `leaseOwner` that owns the lease.
- Failure state is structured and safe for logs.
- No customer repository code is handled in Phase 1.

## Job lease lifecycle

```text
queued
  -> leased(workerId, leaseUntil, attempts+1)
      -> completed
      -> failed
      -> queued again only for explicitly retryable work
```

Expired leases are reclaimable. Later phases may add stronger retry/backoff semantics while preserving atomic ownership.

## Current infrastructure decisions

- MongoDB Atlas remains the persistence and initial queue substrate.
- No Redis, PostgreSQL, Kafka, Neo4j, Elasticsearch or Kubernetes.
- The worker is a separately deployable Docker process.
- Auth, organizations and customer RBAC remain in Kairoseth Platform.
