import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManualRepositoryAdapter } from '../src/inventory/manual-adapter.js';
import { inventoryRepository } from '../src/inventory/service.js';
import {
  ensureInventoryIndexes,
  inventoryCollections,
  upsertProduct
} from '../src/inventory/store.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SHA_C = 'cccccccccccccccccccccccccccccccccccccccc';

suite('Product / repository / release inventory', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_inventory_${Date.now()}`;

  beforeAll(async () => {
    await client.connect();
  });

  beforeEach(async () => {
    await client.db(dbName).dropDatabase();
    await ensureInventoryIndexes(inventoryCollections(client.db(dbName)));
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  it('allows one product to own multiple repositories and inventories idempotently', async () => {
    const collections = inventoryCollections(client.db(dbName));
    const product = await upsertProduct(collections.products, {
      organizationId: 'org-a',
      productKey: 'cra-os',
      displayName: 'CRA OS'
    });
    const adapter = new ManualRepositoryAdapter();

    const repoA = {
      repository: { externalId: 'repo-a', canonicalName: 'org/repo-a', defaultBranch: 'main' },
      releases: [{ sourceKind: 'tag' as const, sourceName: 'v1.0.0', commitSha: SHA_A, version: '1.0.0' }]
    };
    const repoB = {
      repository: { externalId: 'repo-b', canonicalName: 'org/repo-b', defaultBranch: 'main' },
      releases: [{ sourceKind: 'commit' as const, sourceName: SHA_B, commitSha: SHA_B }]
    };

    const first = await inventoryRepository(collections, {
      organizationId: 'org-a', productId: product._id, adapter, adapterInput: repoA
    });
    const repeated = await inventoryRepository(collections, {
      organizationId: 'org-a', productId: product._id, adapter, adapterInput: repoA
    });
    const secondRepository = await inventoryRepository(collections, {
      organizationId: 'org-a', productId: product._id, adapter, adapterInput: repoB
    });

    expect(first.repositoryCreated).toBe(true);
    expect(first.releasesCreated).toBe(1);
    expect(repeated.repositoryCreated).toBe(false);
    expect(repeated.releasesCreated).toBe(0);
    expect(secondRepository.repositoryCreated).toBe(true);
    expect(await collections.repositories.countDocuments({ organizationId: 'org-a', productId: product._id })).toBe(2);
    expect(await collections.releases.countDocuments({ organizationId: 'org-a', productId: product._id })).toBe(2);
  });

  it('enforces tenant scope when attaching repositories to products', async () => {
    const collections = inventoryCollections(client.db(dbName));
    const productA = await upsertProduct(collections.products, {
      organizationId: 'org-a', productKey: 'product-a', displayName: 'Product A'
    });
    await upsertProduct(collections.products, {
      organizationId: 'org-b', productKey: 'product-b', displayName: 'Product B'
    });

    const adapter = new ManualRepositoryAdapter();
    const adapterInput = {
      repository: { externalId: 'shared-repo', canonicalName: 'shared/repo' },
      releases: [{ sourceKind: 'commit' as const, sourceName: SHA_C, commitSha: SHA_C }]
    };

    await expect(inventoryRepository(collections, {
      organizationId: 'org-b', productId: productA._id, adapter, adapterInput
    })).rejects.toThrow('Product does not exist in the requested organization');

    expect(await collections.repositories.countDocuments()).toBe(0);
    expect(await collections.releases.countDocuments()).toBe(0);
  });

  it('preserves historical release identity when a tag moves to another commit', async () => {
    const collections = inventoryCollections(client.db(dbName));
    const product = await upsertProduct(collections.products, {
      organizationId: 'org-a', productKey: 'tag-history', displayName: 'Tag History'
    });
    const adapter = new ManualRepositoryAdapter();
    const repository = { externalId: 'repo-tags', canonicalName: 'org/repo-tags' };

    await inventoryRepository(collections, {
      organizationId: 'org-a',
      productId: product._id,
      adapter,
      adapterInput: {
        repository,
        releases: [{ sourceKind: 'tag', sourceName: 'v2.0.0', commitSha: SHA_A }]
      }
    });
    await inventoryRepository(collections, {
      organizationId: 'org-a',
      productId: product._id,
      adapter,
      adapterInput: {
        repository,
        releases: [{ sourceKind: 'tag', sourceName: 'v2.0.0', commitSha: SHA_B }]
      }
    });

    const releases = await collections.releases.find({
      organizationId: 'org-a', sourceKind: 'tag', sourceName: 'v2.0.0'
    }).sort({ commitSha: 1 }).toArray();

    expect(releases).toHaveLength(2);
    expect(releases.map((release) => release.commitSha)).toEqual([SHA_A, SHA_B]);
  });
});
