import { z } from 'zod';
import type { GitHubAppClient } from '../github/client.js';
import { buildGitHubInstallationUrl, completeGitHubInstallSetup, issueGitHubInstallSetup } from '../github/lifecycle.js';
import type { GitHubCollections } from '../github/store.js';
import type { ProductSecurityServiceClaims } from './service-auth.js';

const positiveIntegerFromJson = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+$/).transform((value) => Number(value))
]).refine((value) => Number.isSafeInteger(value) && value > 0, 'Expected a positive safe integer');

const setupBodySchema = z.object({
  expectedAccountId: positiveIntegerFromJson
}).strict();

const completeBodySchema = z.object({
  state: z.string().min(20).max(512),
  installationId: positiveIntegerFromJson
}).strict();

export interface GitHubInstallSetupResponse {
  installUrl: string;
  expiresAt: string;
}

export interface GitHubInstallCompleteResponse {
  organizationId: string;
  installationId: number;
  accountId: number;
  accountLogin: string;
  status: 'active';
}

function assertClaims(claims: ProductSecurityServiceClaims): void {
  if (claims.productSlug !== 'product-security') {
    throw new Error('Invalid Product Security service claims');
  }
}

export async function createInternalGitHubInstallSetup(input: {
  claims: ProductSecurityServiceClaims;
  body: unknown;
  collections: GitHubCollections;
  appSlug: string;
  now?: Date;
}): Promise<GitHubInstallSetupResponse> {
  assertClaims(input.claims);
  const body = setupBodySchema.parse(input.body);
  const ticket = await issueGitHubInstallSetup({
    collections: input.collections,
    organizationId: input.claims.organizationId,
    expectedAccountId: body.expectedAccountId,
    ...(input.now ? { now: input.now } : {})
  });
  return {
    installUrl: buildGitHubInstallationUrl(input.appSlug, ticket.state),
    expiresAt: ticket.expiresAt.toISOString()
  };
}

export async function completeInternalGitHubInstall(input: {
  claims: ProductSecurityServiceClaims;
  body: unknown;
  collections: GitHubCollections;
  client: Pick<GitHubAppClient, 'getInstallation'>;
  now?: Date;
}): Promise<GitHubInstallCompleteResponse> {
  assertClaims(input.claims);
  const body = completeBodySchema.parse(input.body);
  const installation = await completeGitHubInstallSetup({
    collections: input.collections,
    client: input.client,
    state: body.state,
    installationId: body.installationId,
    ...(input.now ? { now: input.now } : {})
  });
  if (installation.organizationId !== input.claims.organizationId) {
    throw new Error('GitHub installation setup resolved to a different organization');
  }
  return {
    organizationId: installation.organizationId,
    installationId: installation.installationId,
    accountId: installation.accountId,
    accountLogin: installation.accountLogin,
    status: 'active'
  };
}
