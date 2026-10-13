import { describe, expect, it } from 'vitest';
import { buildLeaseFilter } from '../src/jobs/lease.js';

describe('buildLeaseFilter', () => {
  it('leases queued work or an expired lease only when available and under max attempts', () => {
    const now = new Date('2026-10-13T15:00:00.000Z');
    expect(buildLeaseFilter(now)).toEqual({
      $expr: { $lt: ['$attempts', '$maxAttempts'] },
      availableAt: { $lte: now },
      $or: [
        { status: 'queued' },
        { status: 'leased', leaseUntil: { $lte: now } }
      ]
    });
  });
});
