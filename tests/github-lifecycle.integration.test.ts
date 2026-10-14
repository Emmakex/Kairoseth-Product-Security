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

  it('stores only a hash of state and binds the verified GitHub account exactly once', async () => {
    const collections = githubCollections(client.db(dbName));
    const now = new Date('2026-10-14T05:00:00.000Z');
    const ticket = await issueGitHubInstallSetup({
      collections,
      organizationId: 'org-secure',
      expectedAccountId: 991,
      now
    });

    expect(ticket.state).toHaveLength(43);
    expect(buildGitHubInstallationUrl('kairoseth-product-security', ticket.state)).toContain(
      `state=${encodeURIComponent(ticket.state)}`
    );

    const stored = await collections.setups.findOne({ organizationId: 'org-secure' });
    expect(stored?.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.stateHash).not.toBe(ticket.state);

    const githubClient = {
      getInstallation: (installationId: number) => Promise.resolve({
        installationId,
        accountId: 991,
        accountLogin: 'acme-security',
        repositorySelection: 'selected' as const,
        suspended: false
      })
    };

    const installation = await completeGitHubInstallSetup({
      collections,
      client: githubClient,
      state: ticket.state,
      installationId: 4321,
      now: new Date(now.getTime() + 10_000)
    });
    expect(installation.organizationId).toBe('org-secure');
    expect(installation.accountId).toBe(991);
    expect(installation.selectedRepositories).toEqual([]);

    await expect(completeGitHubInstallSetup({
      collections,
      client: githubClient,
      state: ticket.state,
      installationId: 4321,
      now: new Date(now.getTime() + 20_000)
    })).rejects.toMatchObject({
      code: 'setup_state_invalid',
      message: expect.stringContaining('invalid, expired or already consumed')
    });
  });

  it('does not bind an installation for a different GitHub account', async () => {
    const collections = githubCollections(client.db(dbName));
    const ticket = await issueGitHubInstallSetup({
      collections,
      organizationId: 'org-a',
      expectedAccountId: 123
    });

    await expect(completeGitHubInstallSetup({
      collections,
      client: {
        getInstallation: (installationId: number) => Promise.resolve({
          installationId,
          accountId: 999,
          accountLogin: 'other-account',
          repositorySelection: 'all' as const,
          suspended: false
        })
      },
      state: ticket.state,
      installationId: 555
    })).rejects.toMatchObject({
      code: 'installation_account_mismatch',
      message: expect.stringContaining('server-verified setup account')
    });

    expect(await collections.installations.countDocuments()).toBe(0);
    expect(await collections.setups.countDocuments({ consumedAt: { $exists: true } })).toBe(0);
  });

  it('rejects expired setup state', async () => {
    const collections = githubCollections(client.db(dbName));
    const now = new Date('2026-10-14T05:00:00.000Z');
    const ticket = await issueGitHubInstallSetup({
      collections,
      organizationId: 'org-expired',
      expectedAccountId: 321,
      now,
      ttlMs: 60_000
    });

    await expect(completeGitHubInstallSetup({
      collections,
      client: {
        getInstallation: (installationId: number) => Promise.resolve({
          installationId,
          accountId: 321,
          accountLogin: 'expired-account',
          repositorySelection: 'selected' as const,
          suspended: false
        })
      },
      state: ticket.state,
      installationId: 777,
      now: new Date(now.getTime() + 60_001)
    })).rejects.toMatchObject({
      code: 'setup_state_invalid'
    });
  });
});
