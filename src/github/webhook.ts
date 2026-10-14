import { createHash } from 'node:crypto';
import { z } from 'zod';
import { verifyGitHubWebhookSignature } from './crypto.js';
import { githubConnectorError } from './errors.js';
import {
  getActiveGitHubInstallationByProviderId,
  getGitHubWebhookDelivery,
  recordGitHubWebhookDelivery,
  revokeGitHubInstallation,
  setGitHubSelectedRepositories,
  type GitHubCollections
} from './store.js';
import type { GitHubSelectedRepository, GitHubWebhookDeliveryDocument } from './types.js';

const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string().min(3)
});

const webhookSchema = z.object({
  action: z.string().optional(),
  installation: z.object({ id: z.number().int().positive() }),
  repositories_added: z.array(repositorySchema).optional(),
  repositories_removed: z.array(repositorySchema).optional()
});

export type GitHubWebhookProcessResult =
  | { status: 'accepted'; organizationId: string; installationId: number; event: string }
  | { status: 'duplicate'; organizationId: string; installationId: number; event: string };

function normalizeHeader(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw githubConnectorError('invalid_input', `${name} header is required`);
  return normalized;
}

function normalizeRepositories(repositories: readonly { id: number; full_name: string }[]): GitHubSelectedRepository[] {
  return repositories.map((repository) => ({
    repositoryId: repository.id,
    fullName: repository.full_name
  }));
}

function hashBody(body: string | Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

function assertMatchingReplay(
  delivery: GitHubWebhookDeliveryDocument,
  event: string,
  payloadSha256: string
): void {
  if (delivery.event !== event || delivery.payloadSha256 !== payloadSha256) {
    throw githubConnectorError(
      'webhook_delivery_conflict',
      'GitHub webhook delivery ID was reused with conflicting event or payload'
    );
  }
}

export async function processGitHubWebhook(input: {
  collections: GitHubCollections;
  webhookSecret: string;
  body: string | Buffer;
  signature: string | undefined;
  deliveryId: string | undefined;
  event: string | undefined;
  now?: Date;
}): Promise<GitHubWebhookProcessResult> {
  if (!verifyGitHubWebhookSignature({
    body: input.body,
    signature: input.signature,
    secret: input.webhookSecret
  })) {
    throw githubConnectorError('invalid_webhook_signature', 'Invalid GitHub webhook signature');
  }

  const deliveryId = normalizeHeader(input.deliveryId, 'X-GitHub-Delivery');
  const event = normalizeHeader(input.event, 'X-GitHub-Event');
  const payloadSha256 = hashBody(input.body);
  const duplicate = await getGitHubWebhookDelivery(input.collections.deliveries, deliveryId);
  if (duplicate) {
    assertMatchingReplay(duplicate, event, payloadSha256);
    return {
      status: 'duplicate',
      organizationId: duplicate.organizationId,
      installationId: duplicate.installationId,
      event: duplicate.event
    };
  }

  const bodyText = Buffer.isBuffer(input.body) ? input.body.toString('utf8') : input.body;
  const payload = webhookSchema.parse(JSON.parse(bodyText) as unknown);
  const installationId = payload.installation.id;
  const installation = await getActiveGitHubInstallationByProviderId(
    input.collections.installations,
    installationId
  );
  if (!installation) {
    throw githubConnectorError('installation_not_active', 'Unknown or revoked GitHub installation');
  }

  const now = input.now ?? new Date();
  const recorded = await recordGitHubWebhookDelivery(input.collections.deliveries, {
    deliveryId,
    event,
    payloadSha256,
    installationId,
    organizationId: installation.organizationId,
    receivedAt: now,
    ...(payload.action ? { action: payload.action } : {})
  });

  if (!recorded) {
    const concurrentDuplicate = await getGitHubWebhookDelivery(input.collections.deliveries, deliveryId);
    if (!concurrentDuplicate) {
      throw githubConnectorError('webhook_delivery_conflict', 'GitHub webhook delivery deduplication failed');
    }
    assertMatchingReplay(concurrentDuplicate, event, payloadSha256);
    return {
      status: 'duplicate',
      organizationId: concurrentDuplicate.organizationId,
      installationId: concurrentDuplicate.installationId,
      event: concurrentDuplicate.event
    };
  }

  if (event === 'installation' && (payload.action === 'deleted' || payload.action === 'suspend')) {
    await revokeGitHubInstallation(input.collections.installations, installationId, now);
  }

  if (event === 'installation_repositories') {
    const selected = new Map(
      installation.selectedRepositories.map((repository) => [repository.repositoryId, repository])
    );
    for (const repository of normalizeRepositories(payload.repositories_added ?? [])) {
      selected.set(repository.repositoryId, repository);
    }
    for (const repository of payload.repositories_removed ?? []) {
      selected.delete(repository.id);
    }
    await setGitHubSelectedRepositories(
      input.collections.installations,
      installation.organizationId,
      installationId,
      [...selected.values()],
      now
    );
  }

  return {
    status: 'accepted',
    organizationId: installation.organizationId,
    installationId,
    event
  };
}
