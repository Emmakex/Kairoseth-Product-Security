import { z } from 'zod';
import { verifyGitHubWebhookSignature } from './crypto.js';
import {
  getActiveGitHubInstallationByProviderId,
  recordGitHubWebhookDelivery,
  revokeGitHubInstallation,
  setGitHubSelectedRepositories,
  type GitHubCollections
} from './store.js';
import type { GitHubSelectedRepository } from './types.js';

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
  if (!normalized) throw new Error(`${name} header is required`);
  return normalized;
}

function normalizeRepositories(repositories: readonly { id: number; full_name: string }[]): GitHubSelectedRepository[] {
  return repositories.map((repository) => ({
    repositoryId: repository.id,
    fullName: repository.full_name
  }));
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
    throw new Error('Invalid GitHub webhook signature');
  }

  const deliveryId = normalizeHeader(input.deliveryId, 'X-GitHub-Delivery');
  const event = normalizeHeader(input.event, 'X-GitHub-Event');
  const bodyText = Buffer.isBuffer(input.body) ? input.body.toString('utf8') : input.body;
  const payload = webhookSchema.parse(JSON.parse(bodyText) as unknown);
  const installationId = payload.installation.id;
  const installation = await getActiveGitHubInstallationByProviderId(
    input.collections.installations,
    installationId
  );
  if (!installation) throw new Error('Unknown or revoked GitHub installation');

  const now = input.now ?? new Date();
  const recorded = await recordGitHubWebhookDelivery(input.collections.deliveries, {
    deliveryId,
    event,
    installationId,
    organizationId: installation.organizationId,
    receivedAt: now,
    ...(payload.action ? { action: payload.action } : {})
  });

  if (!recorded) {
    return {
      status: 'duplicate',
      organizationId: installation.organizationId,
      installationId,
      event
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
