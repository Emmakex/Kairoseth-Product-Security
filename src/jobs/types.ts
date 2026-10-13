import type { ObjectId } from 'mongodb';

export const JOB_TYPES = ['noop'] as const;
export type JobType = (typeof JOB_TYPES)[number];
export type JobStatus = 'queued' | 'leased' | 'completed' | 'failed';

export interface JobDocument {
  _id?: ObjectId;
  organizationId: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  leaseOwner?: string;
  leaseUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  lastError?: {
    code: string;
    safeMessage: string;
    retryable: boolean;
  };
}
