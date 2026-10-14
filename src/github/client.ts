import { z } from 'zod';
import { createGitHubAppJwt } from './crypto.js';
import { githubConnectorError } from './errors.js';
import type { GitHubInstallationToken, GitHubRepositoryDescriptor } from './types.js';

export type GitHubFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type GitHubHeaders = Record<string, string>;

const GITHUB_API_VERSION = '2026-03-10';

const tokenResponseSchema = z.object({
  token: z.string().min(1),
  expires_at: z.iso.datetime()
});

const installationSchema = z.object({
  id: z.number().int().positive(),
  account: z.object({
    id: z.number().int().positive(),
    login: z.string().min(1)
  }),
  repository_selection: z.enum(['all', 'selected']),
  suspended_at: z.iso.datetime().nullable().optional()
});

const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string().min(3),
  default_branch: z.string().min(1).nullable().optional()
});

const installationRepositoriesSchema = z.object({
  total_count: z.number().int().nonnegative(),
  repositories: z.array(repositorySchema)
});

const tagSchema = z.object({
  name: z.string().min(1),
  commit: z.object({ sha: z.string().regex(/^[0-9a-fA-F]{40}$/) })
});

export interface GitHubTagDescriptor {
  name: string;
  commitSha: string;
}

export interface GitHubInstallationDescriptor {
  installationId: number;
  accountId: number;
  accountLogin: string;
  repositorySelection: 'all' | 'selected';
  suspended: boolean;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function parseProviderPayload<T>(schema: z.ZodType<T>, value: unknown, context: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw githubConnectorError('provider_payload_invalid', `Invalid GitHub ${context} payload`);
  }
  return parsed.data;
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

  private headers(authorization: string): GitHubHeaders {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: authorization,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': this.config.userAgent ?? 'Kairoseth-Product-Security'
    };
  }

  private appAuthorization(): string {
    return `Bearer ${createGitHubAppJwt({
      appId: this.config.appId,
      privateKeyPem: this.config.privateKeyPem
    })}`;
  }

  private async requestInstallationToken(
    installationId: number,
    repositoryIds?: readonly number[]
  ): Promise<GitHubInstallationToken> {
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      throw githubConnectorError('invalid_input', 'GitHub installationId must be a positive integer');
    }
    if (repositoryIds?.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw githubConnectorError('invalid_input', 'GitHub repository IDs must be positive integers');
    }

    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          ...this.headers(this.appAuthorization()),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(repositoryIds ? { repository_ids: [...repositoryIds] } : {})
      }
    );

    if (!response.ok) {
      throw githubConnectorError(
        'provider_http_failure',
        `GitHub installation token request failed with HTTP ${response.status}`
      );
    }

    const payload = parseProviderPayload(tokenResponseSchema, await readJson(response), 'installation token');
    return { token: payload.token, expiresAt: new Date(payload.expires_at) };
  }

  async getInstallation(installationId: number): Promise<GitHubInstallationDescriptor> {
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      throw githubConnectorError('invalid_input', 'GitHub installationId must be a positive integer');
    }

    const response = await this.fetchImpl(`${this.apiBaseUrl}/app/installations/${installationId}`, {
      headers: this.headers(this.appAuthorization())
    });
    if (!response.ok) {
      throw githubConnectorError(
        'provider_http_failure',
        `GitHub installation lookup failed with HTTP ${response.status}`
      );
    }

    const payload = parseProviderPayload(installationSchema, await readJson(response), 'installation');
    return {
      installationId: payload.id,
      accountId: payload.account.id,
      accountLogin: payload.account.login,
      repositorySelection: payload.repository_selection,
      suspended: Boolean(payload.suspended_at)
    };
  }

  async createInstallationToken(
    installationId: number,
    repositoryIds: readonly number[]
  ): Promise<GitHubInstallationToken> {
    if (repositoryIds.length === 0) {
      throw githubConnectorError('invalid_input', 'At least one selected GitHub repository is required');
    }
    return this.requestInstallationToken(installationId, repositoryIds);
  }

  /**
   * Bootstrap-only credential used immediately after a verified installation callback.
   * GitHub itself limits this token to repositories granted to that installation. It is
   * used only in memory to discover those repository IDs; all later Product Security
   * operations return to explicit repository_ids-scoped installation tokens.
   */
  async createBootstrapInstallationToken(installationId: number): Promise<GitHubInstallationToken> {
    return this.requestInstallationToken(installationId);
  }

  async listInstallationRepositories(token: string): Promise<readonly GitHubRepositoryDescriptor[]> {
    if (!token.trim()) {
      throw githubConnectorError('invalid_input', 'GitHub installation token is required');
    }
    const repositories: GitHubRepositoryDescriptor[] = [];

    for (let page = 1; page <= 10; page += 1) {
      const response = await this.fetchImpl(
        `${this.apiBaseUrl}/installation/repositories?per_page=100&page=${page}`,
        { headers: this.headers(`Bearer ${token}`) }
      );
      if (!response.ok) {
        throw githubConnectorError(
          'provider_http_failure',
          `GitHub installation repository listing failed with HTTP ${response.status}`
        );
      }

      const payload = parseProviderPayload(
        installationRepositoriesSchema,
        await readJson(response),
        'installation repository list'
      );
      for (const repository of payload.repositories) {
        repositories.push({
          repositoryId: repository.id,
          fullName: repository.full_name
        });
      }
      if (payload.repositories.length < 100 || repositories.length >= payload.total_count) break;
      if (page === 10) {
        throw githubConnectorError(
          'tag_inventory_bound_exceeded',
          'GitHub installation repository inventory exceeded the bounded 1000-repository Phase 3 limit'
        );
      }
    }

    return repositories;
  }

  async getRepository(token: string, repositoryId: number): Promise<GitHubRepositoryDescriptor & { defaultBranch?: string }> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}/repositories/${repositoryId}`, {
      headers: this.headers(`Bearer ${token}`)
    });
    if (!response.ok) {
      throw githubConnectorError(
        'provider_http_failure',
        `GitHub repository lookup failed with HTTP ${response.status}`
      );
    }

    const payload = parseProviderPayload(repositorySchema, await readJson(response), 'repository');
    return {
      repositoryId: payload.id,
      fullName: payload.full_name,
      ...(payload.default_branch ? { defaultBranch: payload.default_branch } : {})
    };
  }

  async listTags(token: string, fullName: string): Promise<readonly GitHubTagDescriptor[]> {
    if (!/^[^/\s]+\/[^/\s]+$/.test(fullName)) {
      throw githubConnectorError('invalid_input', 'GitHub fullName must be owner/repository');
    }
    const encodedPath = fullName.split('/').map(encodeURIComponent).join('/');
    const tags: GitHubTagDescriptor[] = [];

    for (let page = 1; page <= 10; page += 1) {
      const response = await this.fetchImpl(
        `${this.apiBaseUrl}/repos/${encodedPath}/tags?per_page=100&page=${page}`,
        { headers: this.headers(`Bearer ${token}`) }
      );
      if (!response.ok) {
        throw githubConnectorError(
          'provider_http_failure',
          `GitHub tag listing failed with HTTP ${response.status}`
        );
      }

      const payload = parseProviderPayload(z.array(tagSchema), await readJson(response), 'tag list');
      for (const tag of payload) tags.push({ name: tag.name, commitSha: tag.commit.sha.toLowerCase() });
      if (payload.length < 100) break;
      if (page === 10) {
        throw githubConnectorError(
          'tag_inventory_bound_exceeded',
          'GitHub tag inventory exceeded the bounded 1000-tag Phase 3 limit'
        );
      }
    }

    return tags;
  }
}
