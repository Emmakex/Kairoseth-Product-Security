import type { Collection, WithId } from 'mongodb';
import type { JobDocument, JobType } from './types.js';

export const JOBS_COLLECTION = 'product_security_jobs';

export interface EnqueueJobInput {
  organizationId: string;
  type: JobType;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  availableAt?: Date;
}

export async function ensureJobIndexes(collection: Collection<JobDocument>): Promise<void> {
  await collection.createIndex({ status: 1, availableAt: 1, leaseUntil: 1, createdAt: 1 });
  await collection.createIndex({ organizationId: 1, status: 1, createdAt: -1 });
}

export async function enqueueJob(
  collection: Collection<JobDocument>,
  input: EnqueueJobInput,
  now = new Date()
): Promise<WithId<JobDocument>> {
  const document: JobDocument = {
    organizationId: input.organizationId,
    type: input.type,
    status: 'queued',
    payload: input.payload ?? {},
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    availableAt: input.availableAt ?? now,
    createdAt: now,
    updatedAt: now
  };
  const result = await collection.insertOne(document);
  return { ...document, _id: result.insertedId };
}
