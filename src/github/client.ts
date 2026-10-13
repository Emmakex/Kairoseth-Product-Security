import { z } from 'zod';
import { createGitHubAppJwt } from './crypto.js';
import type { GitHubInstallationToken, GitHubRepositoryDescriptor } from './types.js';

export type GitHubFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const tokenResponseSchema = z.object({
  token: z.string().min(1),
  expires_at: z.iso.datetime()
});

const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string().min(3),
  default_branch: z.string().min(1).nullable().optional()
});

const tagSchema = z.object({
  name: z.string().min(1),
  commit: z.object({ sha: z.string().regex(/^[0-9a-fA-F]{40}$/) })
});

export interface GitHubTagDescriptor {
  name: string;
  commitSha: string;
}

export class GitHubAppClient {
  private readonly fetchImpl: GitHubFetch;
  private readonly apiBaseUrl: string;

  constructor(private readonly config: {
    appId: string;
    privateKeyPem: string;
    userAgent?: string;
    apiBaseUrl?: string;
    fetchImpl?: GitHubFetch;
  }) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.apiBaseUrl = (config.apiBaseUrl ?? 'https://api.github.com').replace(/\/$/, '');
  }

  private headers(authorization: string): HeadersInit {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: authorization,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': this.config.userAgent ?? 'Kairoseth-Product-Security'
    };
  }

  async createInstallationToken(
    installationId: number,
    repositoryIds: readonly number[]
  ): Promise<GitHubInstallationToken> {
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      throw new Error('GitHub installationId must be a positive integer');
    }
    if (repositoryIds.length === 0) throw new Error('At least one selected GitHub repository is required');
    if (repositoryIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw new Error('GitHub repository IDs must be positive integers');
    }

    const appJwt = createGitHubAppJwt({
      appId: this.config.appId,
      privateKeyPem: this.config.privateKeyPem
    });

    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          ...this.headers(`Bearer ${appJwt}`),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ repository_ids: [...repositoryIds] })
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub installation token request failed with HTTP ${response.status}`);
    }

    const payload = tokenResponseSchema.parse(await response.json());
    return { token: payload.token, expiresAt: new Date(payload.expires_at) };
  }

  async getRepository(token: string, repositoryId: number): Promise<GitHubRepositoryDescriptor & { defaultBranch?: string }> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}/repositories/${repositoryId}`, {
      headers: this.headers(`Bearer ${token}`)
    });
    if (!response.ok) throw new Error(`GitHub repository lookup failed with HTTP ${response.status}`);

    const payload = repositorySchema.parse(await response.json());
    return {
      repositoryId: payload.id,
      fullName: payload.full_name,
      ...(payload.default_branch ? { defaultBranch: payload.default_branch } : {})
    };
  }

  async listTags(token: string, fullName: string): Promise<readonly GitHubTagDescriptor[]> {
    if (!/^[^/\s]+\/[^/\s]+$/.test(fullName)) throw new Error('GitHub fullName must be owner/repository');
    const encodedPath = fullName.split('/').map(encodeURIComponent).join('/');
    const tags: GitHubTagDescriptor[] = [];

    for (let page = 1; page <= 10; page += 1) {
      const response = await this.fetchImpl(
        `${this.apiBaseUrl}/repos/${encodedPath}/tags?per_page=100&page=${page}`,
        { headers: this.headers(`Bearer ${token}`) }
      );
      if (!response.ok) throw new Error(`GitHub tag listing failed with HTTP ${response.status}`);

      const payload = z.array(tagSchema).parse(await response.json());
      for (const tag of payload) tags.push({ name: tag.name, commitSha: tag.commit.sha.toLowerCase() });
      if (payload.length < 100) break;
      if (page === 10) throw new Error('GitHub tag inventory exceeded the bounded 1000-tag Phase 3 limit');
    }

    return tags;
  }
}
