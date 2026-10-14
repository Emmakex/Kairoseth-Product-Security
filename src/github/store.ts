import type { Collection, Db, WithId } from 'mongodb';
import type {
  GitHubInstallationDocument,
  GitHubInstallSetupDocument,
  GitHubSelectedRepository,
  GitHubWebhookDeliveryDocument
} from './types.js';

export const GITHUB_INSTALLATIONS_COLLECTION = 'product_security_github_installations';
export const GITHUB_INSTALL_SETUPS_COLLECTION = 'product_security_github_install_setups';
export const GITHUB_WEBHOOK_DELIVERIES_COLLECTION = 'product_security_github_webhook_deliveries';

export interface GitHubCollections {
  installations: Collection<GitHubInstallationDocument>;
  setups: Collection<GitHubInstallSetupDocument>;
  deliveries: Collection<GitHubWebhookDeliveryDocument>;
}

export function githubCollections(db: Db): GitHubCollections {
  return {
    installations: db.collection<GitHubInstallationDocument>(GITHUB_INSTALLATIONS_COLLECTION),
    setups: db.collection<GitHubInstallSetupDocument>(GITHUB_INSTALL_SETUPS_COLLECTION),
    deliveries: db.collection<GitHubWebhookDeliveryDocument>(GITHUB_WEBHOOK_DELIVERIES_COLLECTION)
  };
}

export async function ensureGitHubIndexes(collections: GitHubCollections): Promise<void> {
  await collections.installations.createIndex({ installationId: 1 }, { unique: true });
  await collections.installations.createIndex({ organizationId: 1, status: 1, updatedAt: -1 });
  await collections.setups.createIndex({ stateHash: 1 }, { unique: true });
  await collections.setups.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await collections.setups.createIndex({ organizationId: 1, expiresAt: -1 });
  await collections.deliveries.createIndex({ deliveryId: 1 }, { unique: true });
  await collections.deliveries.createIndex({ organizationId: 1, receivedAt: -1 });
}

function normalizeOrganizationId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('organizationId must not be empty');
  return normalized;
}

function normalizeGitHubUserId(value: string): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) throw new Error('GitHub user ID must contain digits only');
  return normalized;
}

function normalizeRepository(repository: GitHubSelectedRepository): GitHubSelectedRepository {
  if (!Number.isSafeInteger(repository.repositoryId) || repository.repositoryId <= 0) {
    throw new Error('GitHub repositoryId must be a positive integer');
  }
  const fullName = repository.fullName.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(fullName)) throw new Error('GitHub fullName must be owner/repository');
  return { repositoryId: repository.repositoryId, fullName };
}

export async function createGitHubInstallSetup(
  collection: Collection<GitHubInstallSetupDocument>,
  input: Omit<GitHubInstallSetupDocument, '_id' | 'consumedAt' | 'installationId'>
): Promise<void> {
  await collection.insertOne({
    stateHash: input.stateHash,
    organizationId: normalizeOrganizationId(input.organizationId),
    expectedInstallerUserId: normalizeGitHubUserId(input.expectedInstallerUserId),
    createdAt: input.createdAt,
    expiresAt: input.expiresAt
  });
}

export async function getPendingGitHubInstallSetup(
  collection: Collection<GitHubInstallSetupDocument>,
  stateHash: string,
  now = new Date()
): Promise<WithId<GitHubInstallSetupDocument> | null> {
  return collection.findOne({
    stateHash,
    consumedAt: { $exists: false },
    expiresAt: { $gt: now }
  });
}

export async function consumeGitHubInstallSetup(
  collection: Collection<GitHubInstallSetupDocument>,
  stateHash: string,
  installationId: number,
  now = new Date()
): Promise<WithId<GitHubInstallSetupDocument> | null> {
  return collection.findOneAndUpdate(
    {
      stateHash,
      consumedAt: { $exists: false },
      expiresAt: { $gt: now }
    },
    {
      $set: {
        consumedAt: now,
        installationId
      }
    },
    { returnDocument: 'after' }
  );
}

export async function registerGitHubInstallation(
  collection: Collection<GitHubInstallationDocument>,
  input: {
    organizationId: string;
    installationId: number;
    accountId?: number;
    accountLogin?: string;
    selectedRepositories?: readonly GitHubSelectedRepository[];
  },
  now = new Date()
): Promise<WithId<GitHubInstallationDocument>> {
  const organizationId = normalizeOrganizationId(input.organizationId);
  if (!Number.isSafeInteger(input.installationId) || input.installationId <= 0) {
    throw new Error('GitHub installationId must be a positive integer');
  }

  const existing = await collection.findOne({ installationId: input.installationId });
  if (existing && existing.organizationId !== organizationId) {
    throw new Error('GitHub installation is already bound to another organization');
  }

  const selectedRepositories = (input.selectedRepositories ?? []).map(normalizeRepository);
  const accountLogin = input.accountLogin?.trim();

  await collection.updateOne(
    { installationId: input.installationId, organizationId },
    {
      $set: {
        status: 'active',
        selectedRepositories,
        updatedAt: now,
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(accountLogin ? { accountLogin } : {})
      },
      $unset: { revokedAt: '' },
      $setOnInsert: {
        organizationId,
        installationId: input.installationId,
        createdAt: now
      }
    },
    { upsert: true }
  );

  const installation = await collection.findOne({ installationId: input.installationId, organizationId });
  if (!installation) throw new Error('GitHub installation registration failed');
  return installation;
}

export async function getActiveGitHubInstallation(
  collection: Collection<GitHubInstallationDocument>,
  organizationId: string,
  installationId: number
): Promise<WithId<GitHubInstallationDocument> | null> {
  return collection.findOne({
    organizationId: normalizeOrganizationId(organizationId),
    installationId,
    status: 'active'
  });
}

export async function getActiveGitHubInstallationByProviderId(
  collection: Collection<GitHubInstallationDocument>,
  installationId: number
): Promise<WithId<GitHubInstallationDocument> | null> {
  return collection.findOne({ installationId, status: 'active' });
}

export async function revokeGitHubInstallation(
  collection: Collection<GitHubInstallationDocument>,
  installationId: number,
  now = new Date()
): Promise<boolean> {
  const result = await collection.updateOne(
    { installationId, status: 'active' },
    { $set: { status: 'revoked', revokedAt: now, updatedAt: now } }
  );
  return result.modifiedCount === 1;
}

export async function setGitHubSelectedRepositories(
  collection: Collection<GitHubInstallationDocument>,
  organizationId: string,
  installationId: number,
  repositories: readonly GitHubSelectedRepository[],
  now = new Date()
): Promise<WithId<GitHubInstallationDocument>> {
  const selectedRepositories = repositories.map(normalizeRepository);
  const result = await collection.updateOne(
    {
      organizationId: normalizeOrganizationId(organizationId),
      installationId,
      status: 'active'
    },
    { $set: { selectedRepositories, updatedAt: now } }
  );
  if (result.matchedCount !== 1) throw new Error('Active GitHub installation not found for organization');

  const installation = await collection.findOne({
    organizationId: normalizeOrganizationId(organizationId),
    installationId,
    status: 'active'
  });
  if (!installation) throw new Error('GitHub installation repository update failed');
  return installation;
}

export async function getGitHubWebhookDelivery(
  collection: Collection<GitHubWebhookDeliveryDocument>,
  deliveryId: string
): Promise<WithId<GitHubWebhookDeliveryDocument> | null> {
  return collection.findOne({ deliveryId });
}

export async function recordGitHubWebhookDelivery(
  collection: Collection<GitHubWebhookDeliveryDocument>,
  delivery: GitHubWebhookDeliveryDocument
): Promise<boolean> {
  try {
    await collection.insertOne(delivery);
    return true;
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) return false;
    throw error;
  }
}
