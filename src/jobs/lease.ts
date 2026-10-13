import type { Collection, Filter, WithId } from 'mongodb';
import type { JobDocument } from './types.js';

export interface LeaseOptions {
  workerId: string;
  now?: Date;
  leaseMs: number;
}

export function buildLeaseFilter(now: Date): Filter<JobDocument> {
  return {
    $expr: { $lt: ['$attempts', '$maxAttempts'] },
    availableAt: { $lte: now },
    $or: [
      { status: 'queued' },
      { status: 'leased', leaseUntil: { $lte: now } }
    ]
  };
}

export async function leaseNextJob(
  collection: Collection<JobDocument>,
  options: LeaseOptions
): Promise<WithId<JobDocument> | null> {
  const now = options.now ?? new Date();
  const leaseUntil = new Date(now.getTime() + options.leaseMs);

  return collection.findOneAndUpdate(
    buildLeaseFilter(now),
    {
      $set: {
        status: 'leased',
        leaseOwner: options.workerId,
        leaseUntil,
        updatedAt: now
      },
      $inc: { attempts: 1 }
    },
    {
      sort: { availableAt: 1, createdAt: 1 },
      returnDocument: 'after'
    }
  );
}

export async function completeJob(
  collection: Collection<JobDocument>,
  job: WithId<JobDocument>,
  workerId: string,
  now = new Date()
): Promise<boolean> {
  const result = await collection.updateOne(
    { _id: job._id, status: 'leased', leaseOwner: workerId },
    {
      $set: { status: 'completed', completedAt: now, updatedAt: now },
      $unset: { leaseOwner: '', leaseUntil: '' }
    }
  );
  return result.modifiedCount === 1;
}

export async function failJob(
  collection: Collection<JobDocument>,
  job: WithId<JobDocument>,
  workerId: string,
  error: { code: string; safeMessage: string; retryable: boolean },
  now = new Date()
): Promise<boolean> {
  const terminal = !error.retryable || job.attempts >= job.maxAttempts;
  const result = await collection.updateOne(
    { _id: job._id, status: 'leased', leaseOwner: workerId },
    {
      $set: {
        status: terminal ? 'failed' : 'queued',
        updatedAt: now,
        ...(terminal ? { failedAt: now } : { availableAt: now }),
        lastError: error
      },
      $unset: { leaseOwner: '', leaseUntil: '' }
    }
  );
  return result.modifiedCount === 1;
}
