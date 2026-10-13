import { spawn } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enqueueJob, ensureJobIndexes, JOBS_COLLECTION } from '../src/jobs/store.js';
import type { JobDocument } from '../src/jobs/types.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;

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

suite('worker integration', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_worker_test_${Date.now()}`;

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  it('leases and completes a no-op job through the real worker entrypoint', async () => {
    const collection = client.db(dbName).collection<JobDocument>(JOBS_COLLECTION);
    await ensureJobIndexes(collection);
    const created = await enqueueJob(collection, { organizationId: 'org-worker-e2e', type: 'noop' });

    const result = await runWorkerOnce({
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      MONGODB_URI: uri,
      MONGODB_DB: dbName,
      WORKER_ID: 'worker-e2e',
      WORKER_ONCE: 'true'
    });

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('worker_started');
    expect(result.stdout).toContain('job_leased');
    expect(result.stdout).toContain('job_completed');
    expect(result.stdout).toContain('worker_stopped');

    const stored = await collection.findOne({ _id: created._id });
    expect(stored?.status).toBe('completed');
    expect(stored?.attempts).toBe(1);
    expect(stored?.leaseOwner).toBeUndefined();
  });
});
