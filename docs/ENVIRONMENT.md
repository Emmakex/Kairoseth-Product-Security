# Environment Contract — Foundation v0.1

All secrets are server/worker-side only. `.env.example` contains placeholders and safe defaults, never real credentials.

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `NODE_ENV` | no | `development` | Runtime mode |
| `LOG_LEVEL` | no | `info` | Structured log level |
| `MONGODB_URI` | yes | — | MongoDB connection URI |
| `MONGODB_DB` | no | `kairoseth_product_security` | Database name |
| `WORKER_ID` | no | `product-security-worker` | Lease owner identity |
| `WORKER_POLL_MS` | no | `2000` | Queue polling interval |
| `JOB_LEASE_MS` | no | `30000` | Lease duration |
| `WORKER_ONCE` | no | `false` | Exit after one polling cycle/job |
| `TEST_MONGODB_URI` | tests only | — | Enables Mongo lease integration tests |

## Validation

Runtime configuration is validated at process startup with a typed schema. Invalid configuration fails closed before connecting to MongoDB.

## Secret policy

Never expose `MONGODB_URI` or future connector/provider credentials in client bundles, logs, model prompts, evidence exports or committed files.
