import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeJob, leaseNextJob } from '../src/jobs/lease.js';
import { enqueueJob, ensureJobIndexes, JOBS_COLLECTION } from '../src/jobs/store.js';
import type { JobDocument } from '../src/jobs/types.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;

suite('Mongo job lease integration', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_test_${Date.now()}`;

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  it('leases and completes one no-op job atomically', async () => {
    const collection = client.db(dbName).collection<JobDocument>(JOBS_COLLECTION);
    await ensureJobIndexes(collection);
    const created = await enqueueJob(collection, { organizationId: 'org-test', type: 'noop' });

    const leased = await leaseNextJob(collection, { workerId: 'worker-a', leaseMs: 30_000 });
    expect(leased?._id.toHexString()).toBe(created._id.toHexString());
    expect(leased?.status).toBe('leased');
    expect(leased?.attempts).toBe(1);

    const secondLease = await leaseNextJob(collection, { workerId: 'worker-b', leaseMs: 30_000 });
    expect(secondLease).toBeNull();

    expect(leased).not.toBeNull();
    if (!leased) return;
    expect(await completeJob(collection, leased, 'worker-a')).toBe(true);

    const stored = await collection.findOne({ _id: created._id });
    expect(stored?.status).toBe('completed');
    expect(stored?.leaseOwner).toBeUndefined();
  });
});
