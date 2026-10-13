import type { ObjectId } from 'mongodb';
import type { RepositoryAdapter } from './provider.js';
import { observeRelease, upsertRepository, type InventoryCollections } from './store.js';
import type { InventoryResult } from './types.js';

export interface InventoryRepositoryInput<TAdapterInput> {
  organizationId: string;
  productId: ObjectId;
  adapter: RepositoryAdapter<TAdapterInput>;
  adapterInput: TAdapterInput;
}

export async function inventoryRepository<TAdapterInput>(
  collections: InventoryCollections,
  input: InventoryRepositoryInput<TAdapterInput>,
  now = new Date()
): Promise<InventoryResult> {
  const repositorySnapshot = await input.adapter.inspectRepository(input.adapterInput);
  if (repositorySnapshot.provider !== input.adapter.provider) {
    throw new Error('Repository adapter returned a mismatched provider');
  }

  const { repository, created: repositoryCreated } = await upsertRepository(
    collections,
    input.organizationId,
    input.productId,
    repositorySnapshot,
    now
  );

  const releaseSnapshots = await input.adapter.listReleases(input.adapterInput);
  let releasesCreated = 0;

  for (const releaseSnapshot of releaseSnapshots) {
    const { created } = await observeRelease(
      collections,
      input.organizationId,
      input.productId,
      repository._id,
      releaseSnapshot,
      now
    );
    if (created) releasesCreated += 1;
  }

  return {
    productId: input.productId,
    repositoryId: repository._id,
    repositoryCreated,
    releasesObserved: releaseSnapshots.length,
    releasesCreated
  };
}
