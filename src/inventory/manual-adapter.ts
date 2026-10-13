import type { RepositoryAdapter } from './provider.js';
import { normalizeCommitSha, normalizeStableKey } from './provider.js';
import type { ReleaseSnapshot, RepositorySnapshot } from './types.js';

export interface ManualRepositoryInput {
  repository: {
    externalId: string;
    canonicalName: string;
    defaultBranch?: string;
  };
  releases: readonly Array<{
    sourceKind: 'tag' | 'commit' | 'manual';
    sourceName: string;
    commitSha: string;
    version?: string;
    publishedAt?: Date;
  }>;
}

export class ManualRepositoryAdapter implements RepositoryAdapter<ManualRepositoryInput> {
  readonly provider = 'manual' as const;

  async inspectRepository(input: ManualRepositoryInput): Promise<RepositorySnapshot> {
    const externalId = normalizeStableKey(input.repository.externalId, 'externalId');
    const canonicalName = normalizeStableKey(input.repository.canonicalName, 'canonicalName');
    const defaultBranch = input.repository.defaultBranch?.trim();

    return {
      provider: this.provider,
      externalId,
      canonicalName,
      ...(defaultBranch ? { defaultBranch } : {})
    };
  }

  async listReleases(input: ManualRepositoryInput): Promise<readonly ReleaseSnapshot[]> {
    return input.releases.map((release) => ({
      sourceKind: release.sourceKind,
      sourceName: normalizeStableKey(release.sourceName, 'sourceName'),
      commitSha: normalizeCommitSha(release.commitSha),
      ...(release.version?.trim() ? { version: release.version.trim() } : {}),
      ...(release.publishedAt ? { publishedAt: release.publishedAt } : {})
    }));
  }
}
