# Phase 3 — Production runtime and real GitHub App acceptance

## Purpose

This runbook closes the deployment gap between the deterministic Phase 3 connector and the required real private-repository acceptance test.

Phase 3 is **not accepted for production** until the real GitHub App E2E described below passes. Phase 4 remains blocked until then.

## Runtime topology

Use the existing Kairoseth infrastructure and one Product Security image with two process roles:

```text
Kairoseth Platform
  https://kairoseth.com
        |
        | HTTPS + short-lived scoped service token
        v
Product Security API
  node dist/src/server.js
        |\
        | \--> /webhooks/github  <-- GitHub App webhook
        |
        +----> MongoDB Atlas

Product Security Worker
  node dist/src/worker.js
        |
        +----> MongoDB Atlas
```

The API and worker are separate processes of the **same image**. This is not a second application platform and does not introduce PostgreSQL, Redis, Neo4j or Kubernetes.

The versioned example is `deploy/docker-compose.production.example.yml`.

## Runtime origin

Recommended production origin:

```text
https://product-security-runtime.kairoseth.com
```

The example Nginx contract is `deploy/nginx-product-security.conf.example`.

This hostname is a deployment convention only; DNS and TLS must exist before the real E2E. The Node service itself remains bound to the host loopback through Docker Compose and is exposed only through the reverse proxy.

If a private service origin between Platform and Product Security is available later, `PRODUCT_SECURITY_INTERNAL_URL` may use it. The GitHub webhook still requires a publicly reachable HTTPS URL.

## Required Product Security runtime environment

Create `.env.production` on the runtime host. Do not commit it.

```text
NODE_ENV=production
LOG_LEVEL=info
MONGODB_URI=<existing Kairoseth MongoDB Atlas URI>
MONGODB_DB=kairoseth_product_security
WORKER_ID=product-security-prod-01
WORKER_POLL_MS=2000
JOB_LEASE_MS=30000
WORKER_ONCE=false

PRODUCT_SECURITY_SERVICE_SECRET=<random shared secret >= 32 bytes>
PRODUCT_SECURITY_API_HOST=0.0.0.0
PRODUCT_SECURITY_API_PORT=8787

GITHUB_APP_ID=<GitHub App numeric ID>
GITHUB_APP_SLUG=<GitHub App slug>
GITHUB_APP_PRIVATE_KEY=<GitHub App private key PEM>
GITHUB_WEBHOOK_SECRET=<random webhook secret>
GITHUB_API_BASE_URL=https://api.github.com
```

Generate independent secrets, for example:

```bash
openssl rand -base64 48
```

`PRODUCT_SECURITY_SERVICE_SECRET` must be identical in Kairoseth Platform and Product Security. `GITHUB_WEBHOOK_SECRET` is independent and is shared only with GitHub's webhook configuration.

## Required Kairoseth Platform environment

Configure server-only values in the deployed Platform environment:

```text
PRODUCT_SECURITY_GITHUB_CLIENT_ID=<GitHub App client ID>
PRODUCT_SECURITY_GITHUB_CLIENT_SECRET=<GitHub App client secret>
PRODUCT_SECURITY_INTERNAL_URL=https://product-security-runtime.kairoseth.com
PRODUCT_SECURITY_SERVICE_SECRET=<same shared secret as Product Security>
```

No Product Security secret may use a `NEXT_PUBLIC_` prefix.

## GitHub App registration

Use one GitHub App for Product Security.

```text
Homepage URL:
https://kairoseth.com/

User authorization callback URL:
https://kairoseth.com/api/auth/callback/github

Setup URL:
https://kairoseth.com/api/product-security/github/callback

Webhook URL:
https://product-security-runtime.kairoseth.com/webhooks/github
```

Do **not** enable `Request user authorization (OAuth) during installation`. Kairoseth explicitly links the human GitHub identity first through Better Auth; repository installation is a separate flow.

Repository permissions for Phase 3:

```text
Metadata: read
Contents: read
```

Subscribe to the installation lifecycle/repository-selection events required by the connector, including `installation` and `installation_repositories`.

Install only on selected repositories during the production acceptance test.

## Deploy

From the repository root on the runtime host:

```bash
docker compose -f deploy/docker-compose.production.example.yml build
docker compose -f deploy/docker-compose.production.example.yml up -d
```

Acceptance preflight:

```bash
curl --fail --silent --show-error \
  https://product-security-runtime.kairoseth.com/healthz
```

Expected response:

```json
{"status":"ok"}
```

The internal installation endpoint must reject an unauthenticated request:

```bash
curl --silent --show-error \
  -X POST \
  -H 'content-type: application/json' \
  -d '{}' \
  https://product-security-runtime.kairoseth.com/internal/product-security/v1/github/install/setup
```

Expected HTTP status: `401`.

## Real private-repository E2E

Use a private Kairoseth/Emmakex repository that is safe for acceptance testing.

Pass criteria, in order:

1. Sign in to Kairoseth Platform with an existing Kairoseth user.
2. Enable/access `Kairoseth Product Security` for the test organization as Product Owner/Admin.
3. Explicitly link the human GitHub identity from the Product Security workspace.
4. Start GitHub App installation from the Kairoseth Product Security workspace.
5. Install the App on **selected repositories**, including at least one private repository.
6. Return through the configured Setup URL.
7. Platform re-checks Kairoseth session, organization and Product Security role.
8. Platform verifies the linked GitHub user can access the returned `installation_id`.
9. Platform signs the short-lived completion claim.
10. Product Security independently verifies the App installation and one-time setup state.
11. Product Security discovers and persists only the repositories selected in the installation.
12. Run repository inventory and prove the stored default-branch commit SHA exactly equals GitHub's current SHA.
13. Remove the repository from the installation or uninstall/revoke the GitHub App.
14. Process the corresponding signed GitHub webhook.
15. Attempt another repository access/inventory operation.
16. Prove the revoked/removed repository can no longer be accessed.

## Required acceptance evidence

Record, without secrets or source code:

```text
Platform merge SHA
Product Security merge SHA
GitHub App slug
GitHub installation ID
Kairoseth organization ID
selected repository IDs + full names
inventory timestamp
repository default-branch SHA from GitHub
repository default-branch SHA stored by Product Security
webhook delivery ID for removal/revocation
revocation timestamp
post-revocation access result
```

Never record access tokens, OAuth tokens, private keys, webhook secrets, service secrets or cloned source code in the acceptance evidence.

## Phase gate

Phase 3 may be marked `COMPLETE / PRODUCTION ACCEPTED` only when every E2E pass criterion above has evidence.

Until then:

```text
Phase 3 — MERGED / DETERMINISTIC VERIFIED / REAL E2E PENDING
Phase 4 — BLOCKED ON PHASE 3 PRODUCTION ACCEPTANCE
```
