import type { Collection } from 'mongodb';
import type { RepositoryAdapter } from '../inventory/provider.js';
import type { ReleaseSnapshot, RepositorySnapshot } from '../inventory/types.js';
import { GitHubAppClient } from './client.js';
import { getActiveGitHubInstallation } from './store.js';
import type { GitHubInstallationDocument, GitHubInstallationToken } from './types.js';

export interface GitHubRepositoryInput {
  organizationId: string;
  installationId: number;
  repositoryId: number;
}

export class GitHubRepositoryAdapter implements RepositoryAdapter<GitHubRepositoryInput> {
  readonly provider = 'github' as const;
  private readonly tokenCache = new Map<string, GitHubInstallationToken>();

  constructor(
    private readonly installations: Collection<GitHubInstallationDocument>,
    private readonly client: GitHubAppClient
  ) {}

  private async installationFor(input: GitHubRepositoryInput) {
    const installation = await getActiveGitHubInstallation(
      this.installations,
      input.organizationId,
      input.installationId
    );
    if (!installation) throw new Error('Active GitHub installation not found for organization');

    const selected = installation.selectedRepositories.find(
      (repository) => repository.repositoryId === input.repositoryId
    );
    if (!selected) throw new Error('GitHub repository is not selected for this installation');
    return { installation, selected };
  }

  private async tokenFor(input: GitHubRepositoryInput): Promise<GitHubInstallationToken> {
    const key = `${input.organizationId}:${input.installationId}:${input.repositoryId}`;
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt.getTime() - Date.now() > 2 * 60_000) return cached;

    const token = await this.client.createInstallationToken(input.installationId, [input.repositoryId]);
    this.tokenCache.set(key, token);
    return token;
  }

  async inspectRepository(input: GitHubRepositoryInput): Promise<RepositorySnapshot> {
    const { selected } = await this.installationFor(input);
    const { token } = await this.tokenFor(input);
    const repository = await this.client.getRepository(token, input.repositoryId);

    if (repository.repositoryId !== selected.repositoryId || repository.fullName !== selected.fullName) {
      throw new Error('GitHub repository identity does not match the authorized installation mapping');
    }

    return {
      provider: this.provider,
      externalId: String(repository.repositoryId),
      canonicalName: repository.fullName,
      ...(repository.defaultBranch ? { defaultBranch: repository.defaultBranch } : {})
    };
  }

  async listReleases(input: GitHubRepositoryInput): Promise<readonly ReleaseSnapshot[]> {
    const { selected } = await this.installationFor(input);
    const { token } = await this.tokenFor(input);
    const tags = await this.client.listTags(token, selected.fullName);

    return tags.map((tag) => ({
      sourceKind: 'tag' as const,
      sourceName: tag.name,
      commitSha: tag.commitSha
    }));
  }
}
