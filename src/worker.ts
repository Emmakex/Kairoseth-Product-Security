import { setTimeout as sleep } from 'node:timers/promises';
import { loadEnv } from './config/env.js';
import { connectMongo } from './db/mongo.js';
import { executeInventoryRepositoryJob } from './inventory/job.js';
import { ensureInventoryIndexes, inventoryCollections } from './inventory/store.js';
import { createLogger } from './logger.js';
import { completeJob, failJob, leaseNextJob } from './jobs/lease.js';
import { ensureJobIndexes, JOBS_COLLECTION } from './jobs/store.js';
import type { JobDocument } from './jobs/types.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const once = process.argv.includes('--once') || env.WORKER_ONCE;
  const { client, db } = await connectMongo(env);
  const collection = db.collection<JobDocument>(JOBS_COLLECTION);
  const inventory = inventoryCollections(db);
  await ensureJobIndexes(collection);
  await ensureInventoryIndexes(inventory);

  logger.info({ workerId: env.WORKER_ID, once }, 'worker_started');

  try {
    do {
      const job = await leaseNextJob(collection, {
        workerId: env.WORKER_ID,
        leaseMs: env.JOB_LEASE_MS
      });

      if (!job) {
        if (once) break;
        await sleep(env.WORKER_POLL_MS);
        continue;
      }

      logger.info({ jobId: job._id.toHexString(), type: job.type, organizationId: job.organizationId }, 'job_leased');

      try {
        if (job.type === 'inventory.repository') {
          const result = await executeInventoryRepositoryJob(inventory, job.organizationId, job.payload);
          logger.info(
            {
              jobId: job._id.toHexString(),
              repositoryId: result.repositoryId.toHexString(),
              releasesObserved: result.releasesObserved,
              releasesCreated: result.releasesCreated
            },
            'repository_inventory_completed'
          );
        } else if (job.type !== 'noop') {
          throw new Error(`Unsupported job type: ${String(job.type)}`);
        }

        const completed = await completeJob(collection, job, env.WORKER_ID);
        if (!completed) throw new Error('Job lease ownership lost before completion');
        logger.info({ jobId: job._id.toHexString() }, 'job_completed');
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message : 'Unknown worker failure';
        await failJob(collection, job, env.WORKER_ID, {
          code: 'WORKER_JOB_FAILED',
          safeMessage,
          retryable: false
        });
        logger.error({ jobId: job._id.toHexString(), err: safeMessage }, 'job_failed');
        if (once) process.exitCode = 1;
      }
    } while (!once);
  } finally {
    await client.close();
    logger.info('worker_stopped');
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup failure';
  process.stderr.write(`${JSON.stringify({ code: 'WORKER_STARTUP_FAILED', component: 'worker', safeMessage: message })}\n`);
  process.exitCode = 1;
});
