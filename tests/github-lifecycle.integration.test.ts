import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildGitHubInstallationUrl,
  completeGitHubInstallSetup,
  issueGitHubInstallSetup
} from '../src/github/lifecycle.js';
import { ensureGitHubIndexes, githubCollections } from '../src/github/store.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;
const CONTROLLED_FUTURE_NOW = new Date('2099-01-01T00:00:00.000Z');

suite('GitHub installation lifecycle', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_github_lifecycle_${Date.now()}`;

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

  it('stores only a hash of state and allows a verified user to install on a different organization account', async () => {
    const collections = githubCollections(client.db(dbName));
    const now = CONTROLLED_FUTURE_NOW;
    const ticket = await issueGitHubInstallSetup({
      collections,
      organizationId: 'org-secure',
      expectedInstallerUserId: '991',
      now
    });

    expect(ticket.state).toHaveLength(43);
    expect(buildGitHubInstallationUrl('kairoseth-product-security', ticket.state)).toContain(
      `state=${encodeURIComponent(ticket.state)}`
    );

    const stored = await collections.setups.findOne({ organizationId: 'org-secure' });
    expect(stored?.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.stateHash).not.toBe(ticket.state);
    expect(stored?.expectedInstallerUserId).toBe('991');

    const githubClient = {
      getInstallation: (installationId: number) => Promise.resolve({
        installationId,
        accountId: 88001,
        accountLogin: 'acme-security-org',
        repositorySelection: 'selected' as const,
        suspended: false
      })
    };

    const installation = await completeGitHubInstallSetup({
      collections,
      client: githubClient,
      state: ticket.state,
      installationId: 4321,
      verifiedInstallerUserId: '991',
      now: new Date(now.getTime() + 10_000)
    });
    expect(installation.organizationId).toBe('org-secure');
    expect(installation.accountId).toBe(88001);
    expect(installation.accountLogin).toBe('acme-security-org');
    expect(installation.selectedRepositories).toEqual([]);

    await expect(completeGitHubInstallSetup({
      collections,
      client: githubClient,
      state: ticket.state,
      installationId: 4321,
      verifiedInstallerUserId: '991',
      now: new Date(now.getTime() + 20_000)
    })).rejects.toMatchObject({
      code: 'setup_state_invalid'
    });
  });

  it('does not bind an installation when the verified GitHub user differs from setup identity', async () => {
    const collections = githubCollections(client.db(dbName));
    const ticket = await issueGitHubInstallSetup({
      collections,
      organizationId: 'org-a',
      expectedInstallerUserId: '123',
      now: CONTROLLED_FUTURE_NOW
    });

    await expect(completeGitHubInstallSetup({
      collections,
      client: {
        getInstallation: (installationId: number) => Promise.resolve({
          installationId,
          accountId: 999,
          accountLogin: 'organization-account',
          repositorySelection: 'all' as const,
          suspended: false
        })
      },
      state: ticket.state,
      installationId: 555,
      verifiedInstallerUserId: '456',
      now: new Date(CONTROLLED_FUTURE_NOW.getTime() + 10_000)
    })).rejects.toMatchObject({
      code: 'installation_account_mismatch'
    });

    expect(await collections.installations.countDocuments()).toBe(0);
    expect(await collections.setups.countDocuments({ consumedAt: { $exists: true } })).toBe(0);
  });

  it('rejects expired setup state', async () => {
    const collections = githubCollections(client.db(dbName));
    const now = CONTROLLED_FUTURE_NOW;
    const ticket = await issueGitHubInstallSetup({
      collections,
      organizationId: 'org-expired',
      expectedInstallerUserId: '321',
      now,
      ttlMs: 60_000
    });

    await expect(completeGitHubInstallSetup({
      collections,
      client: {
        getInstallation: (installationId: number) => Promise.resolve({
          installationId,
          accountId: 12345,
          accountLogin: 'expired-org',
          repositorySelection: 'selected' as const,
          suspended: false
        })
      },
      state: ticket.state,
      installationId: 777,
      verifiedInstallerUserId: '321',
      now: new Date(now.getTime() + 60_001)
    })).rejects.toMatchObject({
      code: 'setup_state_invalid'
    });
  });
});
