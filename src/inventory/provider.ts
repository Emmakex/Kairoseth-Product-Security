import type { ReleaseSnapshot, RepositoryProvider, RepositorySnapshot } from './types.js';

export interface RepositoryAdapter<TInput = unknown> {
  readonly provider: RepositoryProvider;
  inspectRepository(input: TInput): Promise<RepositorySnapshot>;
  listReleases(input: TInput): Promise<readonly ReleaseSnapshot[]>;
}

export function normalizeCommitSha(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(normalized)) {
    throw new Error('Commit SHA must be a full 40- or 64-character hexadecimal identifier');
  }
  return normalized;
}

export function normalizeStableKey(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must not be empty`);
  if (normalized.length > 240) throw new Error(`${field} is too long`);
  return normalized;
}
