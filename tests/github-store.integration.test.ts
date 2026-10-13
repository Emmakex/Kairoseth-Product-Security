import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureGitHubIndexes,
  getActiveGitHubInstallation,
  githubCollections,
  registerGitHubInstallation,
  revokeGitHubInstallation,
  setGitHubSelectedRepositories
} from '../src/github/store.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;

suite('GitHub installation store', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_github_store_${Date.now()}`;

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

  it('binds one installation to one tenant and blocks cross-tenant reassignment', async () => {
    const { installations } = githubCollections(client.db(dbName));
    await registerGitHubInstallation(installations, {
      organizationId: 'org-a',
      installationId: 1001,
      accountId: 77,
      accountLogin: 'acme',
      selectedRepositories: [{ repositoryId: 501, fullName: 'acme/private-app' }]
    });

    await expect(registerGitHubInstallation(installations, {
      organizationId: 'org-b',
      installationId: 1001
    })).rejects.toThrow('already bound to another organization');

    expect(await installations.countDocuments({ installationId: 1001 })).toBe(1);
  });

  it('honors repository selection and revocation', async () => {
    const { installations } = githubCollections(client.db(dbName));
    await registerGitHubInstallation(installations, {
      organizationId: 'org-a',
      installationId: 2002,
      selectedRepositories: [{ repositoryId: 601, fullName: 'acme/repo-a' }]
    });

    const updated = await setGitHubSelectedRepositories(
      installations,
      'org-a',
      2002,
      [{ repositoryId: 602, fullName: 'acme/repo-b' }]
    );
    expect(updated.selectedRepositories).toEqual([{ repositoryId: 602, fullName: 'acme/repo-b' }]);

    expect(await revokeGitHubInstallation(installations, 2002)).toBe(true);
    expect(await getActiveGitHubInstallation(installations, 'org-a', 2002)).toBeNull();

    await expect(setGitHubSelectedRepositories(
      installations,
      'org-a',
      2002,
      [{ repositoryId: 603, fullName: 'acme/repo-c' }]
    )).rejects.toThrow('Active GitHub installation not found');
  });
});
