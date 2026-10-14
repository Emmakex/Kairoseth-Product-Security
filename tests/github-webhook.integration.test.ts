import { createHmac } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureGitHubIndexes,
  getActiveGitHubInstallation,
  githubCollections,
  registerGitHubInstallation
} from '../src/github/store.js';
import { processGitHubWebhook } from '../src/github/webhook.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;
const secret = 'phase3-webhook-secret-value';

function signature(body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

suite('GitHub webhooks', () => {
  const client = new MongoClient(uri ?? 'mongodb://localhost:27017');
  const dbName = `kps_github_webhook_${Date.now()}`;

  beforeAll(async () => {
    await client.connect();
  });

  beforeEach(async () => {
    await client.db(dbName).dropDatabase();
    const collections = githubCollections(client.db(dbName));
    await ensureGitHubIndexes(collections);
    await registerGitHubInstallation(collections.installations, {
      organizationId: 'org-webhook',
      installationId: 3003,
      selectedRepositories: [{ repositoryId: 701, fullName: 'acme/repo-a' }]
    });
  });

  afterAll(async () => {
    await client.db(dbName).dropDatabase();
    await client.close();
  });

  it('verifies signature, updates repository selection and deduplicates exact delivery replays', async () => {
    const collections = githubCollections(client.db(dbName));
    const body = JSON.stringify({
      action: 'added',
      installation: { id: 3003 },
      repositories_added: [{ id: 702, full_name: 'acme/repo-b' }],
      repositories_removed: [{ id: 701, full_name: 'acme/repo-a' }]
    });

    const first = await processGitHubWebhook({
      collections,
      webhookSecret: secret,
      body,
      signature: signature(body),
      deliveryId: 'delivery-1',
      event: 'installation_repositories'
    });
    expect(first.status).toBe('accepted');

    const installation = await getActiveGitHubInstallation(collections.installations, 'org-webhook', 3003);
    expect(installation?.selectedRepositories).toEqual([{ repositoryId: 702, fullName: 'acme/repo-b' }]);

    const duplicate = await processGitHubWebhook({
      collections,
      webhookSecret: secret,
      body,
      signature: signature(body),
      deliveryId: 'delivery-1',
      event: 'installation_repositories'
    });
    expect(duplicate.status).toBe('duplicate');
    expect(await collections.deliveries.countDocuments({ deliveryId: 'delivery-1' })).toBe(1);
    expect((await collections.deliveries.findOne({ deliveryId: 'delivery-1' }))?.payloadSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a reused delivery ID when the signed payload differs', async () => {
    const collections = githubCollections(client.db(dbName));
    const firstBody = JSON.stringify({ installation: { id: 3003 } });
    await processGitHubWebhook({
      collections,
      webhookSecret: secret,
      body: firstBody,
      signature: signature(firstBody),
      deliveryId: 'delivery-conflict',
      event: 'ping'
    });

    const conflictingBody = JSON.stringify({
      action: 'deleted',
      installation: { id: 3003 }
    });
    await expect(processGitHubWebhook({
      collections,
      webhookSecret: secret,
      body: conflictingBody,
      signature: signature(conflictingBody),
      deliveryId: 'delivery-conflict',
      event: 'installation'
    })).rejects.toThrow('reused with conflicting event or payload');
  });

  it('rejects bad signatures before processing', async () => {
    const collections = githubCollections(client.db(dbName));
    const body = JSON.stringify({ installation: { id: 3003 } });

    await expect(processGitHubWebhook({
      collections,
      webhookSecret: secret,
      body,
      signature: 'sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      deliveryId: 'delivery-bad',
      event: 'ping'
    })).rejects.toThrow('Invalid GitHub webhook signature');

    expect(await collections.deliveries.countDocuments()).toBe(0);
  });

  it('revokes suspended installations, accepts exact signed replays as duplicates and rejects new use', async () => {
    const collections = githubCollections(client.db(dbName));
    const body = JSON.stringify({ action: 'suspend', installation: { id: 3003 } });

    const result = await processGitHubWebhook({
      collections,
      webhookSecret: secret,
      body,
      signature: signature(body),
      deliveryId: 'delivery-suspend',
      event: 'installation'
    });
    expect(result.status).toBe('accepted');
    expect(await getActiveGitHubInstallation(collections.installations, 'org-webhook', 3003)).toBeNull();

    const replay = await processGitHubWebhook({
      collections,
      webhookSecret: secret,
      body,
      signature: signature(body),
      deliveryId: 'delivery-suspend',
      event: 'installation'
    });
    expect(replay.status).toBe('duplicate');

    const laterBody = JSON.stringify({ installation: { id: 3003 } });
    await expect(processGitHubWebhook({
      collections,
      webhookSecret: secret,
      body: laterBody,
      signature: signature(laterBody),
      deliveryId: 'delivery-after-revoke',
      event: 'ping'
    })).rejects.toThrow('Unknown or revoked GitHub installation');
  });
});
