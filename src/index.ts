export { envSchema, loadEnv, requireGitHubAppEnv } from './config/env.js';
export type { AppEnv, GitHubAppEnv } from './config/env.js';
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

export { GitHubRepositoryAdapter } from './github/adapter.js';
export type { GitHubRepositoryInput } from './github/adapter.js';
export { GitHubAppClient } from './github/client.js';
export type {
  GitHubFetch,
  GitHubInstallationDescriptor,
  GitHubTagDescriptor
} from './github/client.js';
export { createGitHubAppJwt, verifyGitHubWebhookSignature } from './github/crypto.js';
export {
  buildGitHubInstallationUrl,
  completeGitHubInstallSetup,
  issueGitHubInstallSetup
} from './github/lifecycle.js';
export type { GitHubInstallSetupTicket } from './github/lifecycle.js';
export {
  consumeGitHubInstallSetup,
  createGitHubInstallSetup,
  ensureGitHubIndexes,
  getActiveGitHubInstallation,
  getActiveGitHubInstallationByProviderId,
  getGitHubWebhookDelivery,
  getPendingGitHubInstallSetup,
  githubCollections,
  GITHUB_INSTALLATIONS_COLLECTION,
  GITHUB_INSTALL_SETUPS_COLLECTION,
  GITHUB_WEBHOOK_DELIVERIES_COLLECTION,
  recordGitHubWebhookDelivery,
  registerGitHubInstallation,
  revokeGitHubInstallation,
  setGitHubSelectedRepositories
} from './github/store.js';
export type { GitHubCollections } from './github/store.js';
export type {
  GitHubInstallationDocument,
  GitHubInstallationStatus,
  GitHubInstallationToken,
  GitHubInstallSetupDocument,
  GitHubRepositoryDescriptor,
  GitHubSelectedRepository,
  GitHubWebhookDeliveryDocument
} from './github/types.js';
export { processGitHubWebhook } from './github/webhook.js';
export type { GitHubWebhookProcessResult } from './github/webhook.js';
