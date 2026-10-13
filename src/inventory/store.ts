import type { Collection, Db, ObjectId, WithId } from 'mongodb';
import { normalizeCommitSha, normalizeStableKey } from './provider.js';
import type {
  ProductDocument,
  ReleaseDocument,
  ReleaseSnapshot,
  RepositoryDocument,
  RepositorySnapshot
} from './types.js';

export const PRODUCTS_COLLECTION = 'product_security_products';
export const REPOSITORIES_COLLECTION = 'product_security_repositories';
export const RELEASES_COLLECTION = 'product_security_releases';

export interface InventoryCollections {
  products: Collection<ProductDocument>;
  repositories: Collection<RepositoryDocument>;
  releases: Collection<ReleaseDocument>;
}

export interface UpsertProductInput {
  organizationId: string;
  productKey: string;
  displayName: string;
}

export function inventoryCollections(db: Db): InventoryCollections {
  return {
    products: db.collection<ProductDocument>(PRODUCTS_COLLECTION),
    repositories: db.collection<RepositoryDocument>(REPOSITORIES_COLLECTION),
    releases: db.collection<ReleaseDocument>(RELEASES_COLLECTION)
  };
}

export async function ensureInventoryIndexes(collections: InventoryCollections): Promise<void> {
  await collections.products.createIndex({ organizationId: 1, productKey: 1 }, { unique: true });
  await collections.repositories.createIndex(
    { organizationId: 1, productId: 1, provider: 1, externalId: 1 },
    { unique: true }
  );
  await collections.repositories.createIndex({ organizationId: 1, productId: 1, updatedAt: -1 });
  await collections.releases.createIndex(
    { organizationId: 1, repositoryId: 1, sourceKind: 1, sourceName: 1, commitSha: 1 },
    { unique: true }
  );
  await collections.releases.createIndex({ organizationId: 1, productId: 1, lastObservedAt: -1 });
}

export function normalizeProductKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
    throw new Error('productKey must use lowercase letters, numbers and hyphens and be at most 63 characters');
  }
  return normalized;
}

export async function upsertProduct(
  collection: Collection<ProductDocument>,
  input: UpsertProductInput,
  now = new Date()
): Promise<WithId<ProductDocument>> {
  const organizationId = normalizeStableKey(input.organizationId, 'organizationId');
  const productKey = normalizeProductKey(input.productKey);
  const displayName = normalizeStableKey(input.displayName, 'displayName');

  await collection.updateOne(
    { organizationId, productKey },
    {
      $set: { displayName, updatedAt: now },
      $setOnInsert: { organizationId, productKey, status: 'active', createdAt: now }
    },
    { upsert: true }
  );

  const product = await collection.findOne({ organizationId, productKey });
  if (!product) throw new Error('Product upsert did not return a product');
  return product;
}

export async function upsertRepository(
  collections: InventoryCollections,
  organizationId: string,
  productId: ObjectId,
  snapshot: RepositorySnapshot,
  now = new Date()
): Promise<{ repository: WithId<RepositoryDocument>; created: boolean }> {
  const tenant = normalizeStableKey(organizationId, 'organizationId');
  const product = await collections.products.findOne({ _id: productId, organizationId: tenant });
  if (!product) throw new Error('Product does not exist in the requested organization');

  const externalId = normalizeStableKey(snapshot.externalId, 'externalId');
  const canonicalName = normalizeStableKey(snapshot.canonicalName, 'canonicalName');
  const defaultBranch = snapshot.defaultBranch?.trim();
  const filter = { organizationId: tenant, productId, provider: snapshot.provider, externalId };

  const result = await collections.repositories.updateOne(
    filter,
    {
      $set: {
        canonicalName,
        updatedAt: now,
        lastInventoriedAt: now,
        ...(defaultBranch ? { defaultBranch } : {})
      },
      $setOnInsert: {
        organizationId: tenant,
        productId,
        provider: snapshot.provider,
        externalId,
        createdAt: now
      }
    },
    { upsert: true }
  );

  const repository = await collections.repositories.findOne(filter);
  if (!repository) throw new Error('Repository upsert did not return a repository');
  return { repository, created: result.upsertedCount === 1 };
}

export async function observeRelease(
  collections: InventoryCollections,
  organizationId: string,
  productId: ObjectId,
  repositoryId: ObjectId,
  snapshot: ReleaseSnapshot,
  now = new Date()
): Promise<{ release: WithId<ReleaseDocument>; created: boolean }> {
  const tenant = normalizeStableKey(organizationId, 'organizationId');
  const repository = await collections.repositories.findOne({
    _id: repositoryId,
    organizationId: tenant,
    productId
  });
  if (!repository) throw new Error('Repository does not exist for the requested product and organization');

  const sourceName = normalizeStableKey(snapshot.sourceName, 'sourceName');
  const commitSha = normalizeCommitSha(snapshot.commitSha);
  const filter = {
    organizationId: tenant,
    repositoryId,
    sourceKind: snapshot.sourceKind,
    sourceName,
    commitSha
  };

  const result = await collections.releases.updateOne(
    filter,
    {
      $set: {
        lastObservedAt: now,
        ...(snapshot.version ? { version: normalizeStableKey(snapshot.version, 'version') } : {}),
        ...(snapshot.publishedAt ? { publishedAt: snapshot.publishedAt } : {})
      },
      $setOnInsert: {
        organizationId: tenant,
        productId,
        repositoryId,
        sourceKind: snapshot.sourceKind,
        sourceName,
        commitSha,
        firstObservedAt: now
      }
    },
    { upsert: true }
  );

  const release = await collections.releases.findOne(filter);
  if (!release) throw new Error('Release observation did not return a release');
  return { release, created: result.upsertedCount === 1 };
}
