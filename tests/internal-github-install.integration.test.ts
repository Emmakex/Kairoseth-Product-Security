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

  it('binds setup to the verified GitHub user and accepts an organization installation after Platform verification', async () => {
    const collections = githubCollections(client.db(dbName));
    const setupServiceToken = signProductSecurityServiceToken({
      secret,
      actorId: 'platform-user-1',
      organizationId: 'org-secure',
      scopes: ['github:install'],
      githubUserId: '991',
      now
    });
    const setupClaims = verifyProductSecurityServiceToken({
      token: setupServiceToken,
      secret,
      requiredScope: 'github:install',
      now
    });

    const setup = await createInternalGitHubInstallSetup({
      claims: setupClaims,
      body: {},
      collections,
      appSlug: 'kairoseth-product-security',
      now
    });
    const state = new URL(setup.installUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    const callbackServiceToken = signProductSecurityServiceToken({
      secret,
      actorId: 'platform-user-1',
      organizationId: 'org-secure',
      scopes: ['github:install'],
      githubUserId: '991',
      verifiedGitHubInstallationId: '4321',
      now: new Date(now.getTime() + 10_000)
    });
    const callbackClaims = verifyProductSecurityServiceToken({
      token: callbackServiceToken,
      secret,
      requiredScope: 'github:install',
      now: new Date(now.getTime() + 10_000)
    });

    const result = await completeInternalGitHubInstall({
      claims: callbackClaims,
      body: { state, installationId: 4321 },
      collections,
      client: {
        getInstallation: (installationId: number) => Promise.resolve({
          installationId,
          accountId: 88001,
          accountLogin: 'acme-security-org',
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
      accountId: 88001,
      accountLogin: 'acme-security-org',
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

  it('rejects completion when Platform has not verified the callback installation ID', async () => {
    const collections = githubCollections(client.db(dbName));
    const setupToken = signProductSecurityServiceToken({
      secret,
      actorId: 'platform-user-1',
      organizationId: 'org-secure',
      scopes: ['github:install'],
      githubUserId: '991',
      now
    });
    const setupClaims = verifyProductSecurityServiceToken({
      token: setupToken,
      secret,
      requiredScope: 'github:install',
      now
    });
    const setup = await createInternalGitHubInstallSetup({
      claims: setupClaims,
      body: {},
      collections,
      appSlug: 'kairoseth-product-security',
      now
    });
    const state = new URL(setup.installUrl).searchParams.get('state');

    const unverifiedToken = signProductSecurityServiceToken({
      secret,
      actorId: 'platform-user-1',
      organizationId: 'org-secure',
      scopes: ['github:install'],
      githubUserId: '991',
      now: new Date(now.getTime() + 10_000)
    });
    const unverifiedClaims = verifyProductSecurityServiceToken({
      token: unverifiedToken,
      secret,
      requiredScope: 'github:install',
      now: new Date(now.getTime() + 10_000)
    });

    await expect(completeInternalGitHubInstall({
      claims: unverifiedClaims,
      body: { state, installationId: 4321 },
      collections,
      client: {
        getInstallation: () => Promise.reject(new Error('must not reach GitHub App lookup')),
        createBootstrapInstallationToken: () => Promise.reject(new Error('must not mint token')),
        listInstallationRepositories: () => Promise.reject(new Error('must not list repositories'))
      },
      now: new Date(now.getTime() + 10_000)
    })).rejects.toThrow('do not verify this GitHub installation');
  });
});
