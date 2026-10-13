import { generateKeyPairSync } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GitHubRepositoryAdapter } from '../src/github/adapter.js';
import { GitHubAppClient, type GitHubFetch } from '../src/github/client.js';
import { ensureGitHubIndexes, githubCollections, registerGitHubInstallation } from '../src/github/store.js';
import { inventoryRepository } from '../src/inventory/service.js';
import { ensureInventoryIndexes, inventoryCollections, upsertProduct } from '../src/inventory/store.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;
const TAG_SHA = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

suite('GitHub repository adapter', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_github_adapter_${Date.now()}`;

  beforeAll(async () => {
    await client.connect();
  });

  beforeEach(async () => {
    await client.db(dbName).dropDatabase();
    await ensureGitHubIndexes(githubCollections(client.db(dbName)));
    await ensureInventoryIndexes(inventoryCollections(client.db(dbName)));
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  it('uses a repository-scoped installation token and inventories exact tag commits', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const calls: Array<{ url: string; authorization?: string; body?: string }> = [];

    const fetchImpl: GitHubFetch = (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({
        url,
        ...(headers.get('authorization') ? { authorization: headers.get('authorization') ?? undefined } : {}),
        ...(typeof init?.body === 'string' ? { body: init.body } : {})
      });

      if (url.endsWith('/app/installations/4004/access_tokens')) {
        return Promise.resolve(new Response(JSON.stringify({
          token: 'ephemeral-installation-token',
          expires_at: '2026-10-13T18:00:00Z'
        }), { status: 201, headers: { 'content-type': 'application/json' } }));
      }
      if (url.endsWith('/repositories/801')) {
        return Promise.resolve(new Response(JSON.stringify({
          id: 801,
          full_name: 'acme/private-product',
          default_branch: 'main'
        }), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      if (url.includes('/repos/acme/private-product/tags?')) {
        return Promise.resolve(new Response(JSON.stringify([
          { name: 'v1.0.0', commit: { sha: TAG_SHA } }
        ]), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    };

    const db = client.db(dbName);
    const github = githubCollections(db);
    const inventory = inventoryCollections(db);
    await registerGitHubInstallation(github.installations, {
      organizationId: 'org-github',
      installationId: 4004,
      selectedRepositories: [{ repositoryId: 801, fullName: 'acme/private-product' }]
    });
    const product = await upsertProduct(inventory.products, {
      organizationId: 'org-github',
      productKey: 'private-product',
      displayName: 'Private Product'
    });

    const githubClient = new GitHubAppClient({
      appId: '123456',
      privateKeyPem,
      apiBaseUrl: 'https://api.github.test',
      fetchImpl
    });
    const adapter = new GitHubRepositoryAdapter(github.installations, githubClient);

    const result = await inventoryRepository(inventory, {
      organizationId: 'org-github',
      productId: product._id,
      adapter,
      adapterInput: {
        organizationId: 'org-github',
        installationId: 4004,
        repositoryId: 801
      }
    });

    expect(result.repositoryCreated).toBe(true);
    expect(result.releasesCreated).toBe(1);
    expect(await inventory.repositories.countDocuments({ provider: 'github', externalId: '801' })).toBe(1);
    expect(await inventory.releases.countDocuments({ commitSha: TAG_SHA })).toBe(1);

    const tokenCalls = calls.filter((call) => call.url.endsWith('/access_tokens'));
    expect(tokenCalls).toHaveLength(1);
    expect(JSON.parse(tokenCalls[0]?.body ?? '{}')).toEqual({ repository_ids: [801] });
    expect(tokenCalls[0]?.authorization).toMatch(/^Bearer /);

    const repositoryCalls = calls.filter((call) => call.url.endsWith('/repositories/801'));
    const tagCalls = calls.filter((call) => call.url.includes('/tags?'));
    expect(repositoryCalls[0]?.authorization).toBe('Bearer ephemeral-installation-token');
    expect(tagCalls[0]?.authorization).toBe('Bearer ephemeral-installation-token');

    const persistedInstallation = await github.installations.findOne({ installationId: 4004 });
    expect(JSON.stringify(persistedInstallation)).not.toContain('ephemeral-installation-token');
  });

  it('blocks repositories that are not selected for the tenant installation', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const db = client.db(dbName);
    const github = githubCollections(db);

    await registerGitHubInstallation(github.installations, {
      organizationId: 'org-github',
      installationId: 5005,
      selectedRepositories: [{ repositoryId: 901, fullName: 'acme/allowed' }]
    });

    const adapter = new GitHubRepositoryAdapter(
      github.installations,
      new GitHubAppClient({
        appId: '123456',
        privateKeyPem,
        fetchImpl: () => Promise.resolve(new Response('{}', { status: 500 }))
      })
    );

    await expect(adapter.inspectRepository({
      organizationId: 'org-github',
      installationId: 5005,
      repositoryId: 902
    })).rejects.toThrow('not selected for this installation');
  });
});
