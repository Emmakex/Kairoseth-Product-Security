import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureGitHubIndexes, githubCollections } from '../src/github/store.js';
import { completeInternalGitHubInstall, createInternalGitHubInstallSetup } from '../src/internal/github-install.js';
import { signProductSecurityServiceToken, verifyProductSecurityServiceToken } from '../src/internal/service-auth.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;
const secret = 'kairoseth-product-security-service-secret-0123456789';
const now = new Date('2099-01-01T00:00:00.000Z');

suite('internal GitHub installation bridge', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_internal_github_${Date.now()}`;

  beforeAll(async () => {
    await client.connect();
  });

  beforeEach(async () => {
    await client.db(dbName).dropDatabase();
    await ensureGitHubIndexes(githubCollections(client.db(dbName)));
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  it('binds setup to service claims and bootstraps exact selected repositories', async () => {
    const collections = githubCollections(client.db(dbName));
    const serviceToken = signProductSecurityServiceToken({
      secret,
      actorId: 'platform-user-1',
      organizationId: 'org-secure',
      scopes: ['github:install'],
      now
    });
    const claims = verifyProductSecurityServiceToken({
      token: serviceToken,
      secret,
      requiredScope: 'github:install',
      now
    });

    const setup = await createInternalGitHubInstallSetup({
      claims,
      body: { expectedAccountId: '991' },
      collections,
      appSlug: 'kairoseth-product-security',
      now
    });
    const state = new URL(setup.installUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    const result = await completeInternalGitHubInstall({
      claims,
      body: { state, installationId: 4321 },
      collections,
      client: {
        getInstallation: (installationId: number) => Promise.resolve({
          installationId,
          accountId: 991,
          accountLogin: 'acme-security',
          repositorySelection: 'selected' as const,
          suspended: false
        }),
        createBootstrapInstallationToken: () => Promise.resolve({
          token: 'bootstrap-only-token',
          expiresAt: new Date(now.getTime() + 60 * 60_000)
        }),
        listInstallationRepositories: () => Promise.resolve([
          { repositoryId: 1001, fullName: 'acme/api' },
          { repositoryId: 1002, fullName: 'acme/web' }
        ])
      },
      now: new Date(now.getTime() + 10_000)
    });

    expect(result).toMatchObject({
      organizationId: 'org-secure',
      installationId: 4321,
      accountId: 991,
      selectedRepositoryCount: 2,
      status: 'active'
    });

    const stored = await collections.installations.findOne({ installationId: 4321 });
    expect(stored?.organizationId).toBe('org-secure');
    expect(stored?.selectedRepositories).toEqual([
      { repositoryId: 1001, fullName: 'acme/api' },
      { repositoryId: 1002, fullName: 'acme/web' }
    ]);
  });
});
