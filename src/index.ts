export { envSchema, loadEnv } from './config/env.js';
export { connectMongo } from './db/mongo.js';
export { createLogger } from './logger.js';
export { buildLeaseFilter, completeJob, failJob, leaseNextJob } from './jobs/lease.js';
export { enqueueJob, ensureJobIndexes, JOBS_COLLECTION } from './jobs/store.js';
export type { JobDocument, JobStatus, JobType } from './jobs/types.js';

export { executeInventoryRepositoryJob } from './inventory/job.js';
export { ManualRepositoryAdapter } from './inventory/manual-adapter.js';
export type { ManualRepositoryInput } from './inventory/manual-adapter.js';
export { normalizeCommitSha, normalizeStableKey } from './inventory/provider.js';
export type { RepositoryAdapter } from './inventory/provider.js';
export { inventoryRepository } from './inventory/service.js';
export {
  ensureInventoryIndexes,
  inventoryCollections,
  normalizeProductKey,
  observeRelease,
  PRODUCTS_COLLECTION,
  RELEASES_COLLECTION,
  REPOSITORIES_COLLECTION,
  upsertProduct,
  upsertRepository
} from './inventory/store.js';
export type {
  InventoryCollections,
  UpsertProductInput
} from './inventory/store.js';
export type {
  InventoryResult,
  ProductDocument,
  ProductStatus,
  ReleaseDocument,
  ReleaseSnapshot,
  ReleaseSourceKind,
  RepositoryDocument,
  RepositoryProvider,
  RepositorySnapshot
} from './inventory/types.js';
