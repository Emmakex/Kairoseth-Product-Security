# CI Gates — Foundation v0.1

## Pull request / main validation

The CI workflow must pass:

1. dependency installation with `npm install --ignore-scripts` (temporary until the first lockfile is committed);
2. ESLint;
3. TypeScript strict typecheck;
4. unit tests;
5. Mongo-backed job lease integration test;
6. production build;
7. high/critical production dependency audit;
8. Docker worker image build.

## Mongo service

CI starts MongoDB 7 as an isolated service and exposes `TEST_MONGODB_URI` only to the validation job. Tests use an ephemeral database name and drop it after execution.

## Failure policy

A Phase 1 change is not accepted when a required gate fails. Dependency audit failures at configured severity are blockers unless a documented, time-bounded exception is approved.

## Lockfile follow-up

The repository starts from an empty bootstrap. The first accepted dependency resolution must commit `package-lock.json`; after that, CI and Docker switch to `npm ci` and treat lockfile drift as a blocker.
