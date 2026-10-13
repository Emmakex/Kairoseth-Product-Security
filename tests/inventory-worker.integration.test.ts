import { spawn } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inventoryCollections, upsertProduct } from '../src/inventory/store.js';
import { enqueueJob, ensureJobIndexes, JOBS_COLLECTION } from '../src/jobs/store.js';
import type { JobDocument } from '../src/jobs/types.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;
const SHA = 'dddddddddddddddddddddddddddddddddddddddd';

function runWorkerOnce(env: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/worker.ts', '--once'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

suite('repository inventory worker', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_inventory_worker_${Date.now()}`;

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  it('persists repository and immutable release identity from an inventory job', async () => {
    const db = client.db(dbName);
    const inventory = inventoryCollections(db);
    const product = await upsertProduct(inventory.products, {
      organizationId: 'org-worker-inventory',
      productKey: 'worker-product',
      displayName: 'Worker Product'
    });
    const jobs = db.collection<JobDocument>(JOBS_COLLECTION);
    await ensureJobIndexes(jobs);

    const created = await enqueueJob(jobs, {
      organizationId: 'org-worker-inventory',
      type: 'inventory.repository',
      payload: {
        productId: product._id.toHexString(),
        provider: 'manual',
        repository: {
          externalId: 'manual-repo-1',
          canonicalName: 'manual/repo-1',
          defaultBranch: 'main'
        },
        releases: [{
          sourceKind: 'tag',
          sourceName: 'v0.1.0',
          commitSha: SHA,
          version: '0.1.0'
        }]
      }
    });

    const result = await runWorkerOnce({
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      MONGODB_URI: uri,
      MONGODB_DB: dbName,
      WORKER_ID: 'inventory-worker-e2e',
      WORKER_ONCE: 'true'
    });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('repository_inventory_completed');
    expect(result.stdout).toContain('job_completed');

    const job = await jobs.findOne({ _id: created._id });
    expect(job?.status).toBe('completed');

    const repository = await inventory.repositories.findOne({
      organizationId: 'org-worker-inventory',
      productId: product._id,
      externalId: 'manual-repo-1'
    });
    expect(repository).not.toBeNull();
    if (!repository) return;

    const release = await inventory.releases.findOne({
      organizationId: 'org-worker-inventory',
      productId: product._id,
      repositoryId: repository._id,
      commitSha: SHA
    });
    expect(release?.sourceName).toBe('v0.1.0');
  });
});
