import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { ManualRepositoryAdapter, type ManualRepositoryInput } from './manual-adapter.js';
import { inventoryRepository } from './service.js';
import type { InventoryCollections } from './store.js';
import type { InventoryResult } from './types.js';

const releaseSchema = z.object({
  sourceKind: z.enum(['tag', 'commit', 'manual']),
  sourceName: z.string().min(1).max(240),
  commitSha: z.string().regex(/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/),
  version: z.string().min(1).max(240).optional(),
  publishedAt: z.iso.datetime().optional()
});

const inventoryRepositoryJobSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  provider: z.literal('manual'),
  repository: z.object({
    externalId: z.string().min(1).max(240),
    canonicalName: z.string().min(1).max(240),
    defaultBranch: z.string().min(1).max(240).optional()
  }),
  releases: z.array(releaseSchema).max(10_000)
});

export type InventoryRepositoryJobPayload = z.infer<typeof inventoryRepositoryJobSchema>;

export async function executeInventoryRepositoryJob(
  collections: InventoryCollections,
  organizationId: string,
  rawPayload: Record<string, unknown>,
  now = new Date()
): Promise<InventoryResult> {
  const payload = inventoryRepositoryJobSchema.parse(rawPayload);
  const adapterInput: ManualRepositoryInput = {
    repository: payload.repository,
    releases: payload.releases.map((release) => ({
      sourceKind: release.sourceKind,
      sourceName: release.sourceName,
      commitSha: release.commitSha,
      ...(release.version ? { version: release.version } : {}),
      ...(release.publishedAt ? { publishedAt: new Date(release.publishedAt) } : {})
    }))
  };

  return inventoryRepository(collections, {
    organizationId,
    productId: new ObjectId(payload.productId),
    adapter: new ManualRepositoryAdapter(),
    adapterInput
  }, now);
}
