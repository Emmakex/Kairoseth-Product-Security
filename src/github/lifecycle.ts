import { createHash, randomBytes } from 'node:crypto';
import type { WithId } from 'mongodb';
import type { GitHubAppClient } from './client.js';
import { githubConnectorError } from './errors.js';
import {
  consumeGitHubInstallSetup,
  createGitHubInstallSetup,
  getPendingGitHubInstallSetup,
  registerGitHubInstallation,
  type GitHubCollections
} from './store.js';
import type { GitHubInstallationDocument } from './types.js';

const DEFAULT_SETUP_TTL_MS = 10 * 60_000;
const MIN_SETUP_TTL_MS = 60_000;
const MAX_SETUP_TTL_MS = 30 * 60_000;

function normalizeOrganizationId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw githubConnectorError('invalid_input', 'organizationId must not be empty');
  return normalized;
}

function stateHash(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

export interface GitHubInstallSetupTicket {
  state: string;
  expiresAt: Date;
}

export async function issueGitHubInstallSetup(input: {
  collections: GitHubCollections;
  organizationId: string;
  expectedAccountId: number;
  now?: Date;
  ttlMs?: number;
}): Promise<GitHubInstallSetupTicket> {
  const organizationId = normalizeOrganizationId(input.organizationId);
  if (!Number.isSafeInteger(input.expectedAccountId) || input.expectedAccountId <= 0) {
    throw githubConnectorError(
      'invalid_input',
      'expectedAccountId must be a positive GitHub account ID verified server-side'
    );
  }

  const ttlMs = input.ttlMs ?? DEFAULT_SETUP_TTL_MS;
  if (!Number.isSafeInteger(ttlMs) || ttlMs < MIN_SETUP_TTL_MS || ttlMs > MAX_SETUP_TTL_MS) {
    throw githubConnectorError('invalid_input', 'GitHub install setup TTL must be between 1 and 30 minutes');
  }

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const state = randomBytes(32).toString('base64url');

  await createGitHubInstallSetup(input.collections.setups, {
    stateHash: stateHash(state),
    organizationId,
    expectedAccountId: input.expectedAccountId,
    createdAt: now,
    expiresAt
  });

  return { state, expiresAt };
}

export function buildGitHubInstallationUrl(appSlug: string, state: string): string {
  const normalizedSlug = appSlug.trim();
  const normalizedState = state.trim();
  if (!normalizedSlug) throw githubConnectorError('invalid_input', 'GitHub App slug must not be empty');
  if (!normalizedState) throw githubConnectorError('invalid_input', 'GitHub install state must not be empty');

  const url = new URL(`https://github.com/apps/${encodeURIComponent(normalizedSlug)}/installations/new`);
  url.searchParams.set('state', normalizedState);
  return url.toString();
}

export async function completeGitHubInstallSetup(input: {
  collections: GitHubCollections;
  client: Pick<GitHubAppClient, 'getInstallation'>;
  state: string;
  installationId: number;
  now?: Date;
}): Promise<WithId<GitHubInstallationDocument>> {
  const normalizedState = input.state.trim();
  if (!normalizedState) throw githubConnectorError('setup_state_invalid', 'GitHub install state is required');
  if (!Number.isSafeInteger(input.installationId) || input.installationId <= 0) {
    throw githubConnectorError('invalid_input', 'GitHub installationId must be a positive integer');
  }

  const now = input.now ?? new Date();
  const hash = stateHash(normalizedState);
  const setup = await getPendingGitHubInstallSetup(input.collections.setups, hash, now);
  if (!setup) {
    throw githubConnectorError(
      'setup_state_invalid',
      'GitHub install setup state is invalid, expired or already consumed'
    );
  }

  const installation = await input.client.getInstallation(input.installationId);
  if (installation.installationId !== input.installationId) {
    throw githubConnectorError('installation_not_active', 'GitHub installation identity mismatch');
  }
  if (installation.suspended) {
    throw githubConnectorError('installation_suspended', 'Suspended GitHub installation cannot be connected');
  }
  if (installation.accountId !== setup.expectedAccountId) {
    throw githubConnectorError(
      'installation_account_mismatch',
      'GitHub installation account does not match the server-verified setup account'
    );
  }

  const consumed = await consumeGitHubInstallSetup(
    input.collections.setups,
    hash,
    input.installationId,
    now
  );
  if (!consumed) {
    throw githubConnectorError('setup_state_invalid', 'GitHub install setup state was already consumed');
  }

  return registerGitHubInstallation(
    input.collections.installations,
    {
      organizationId: setup.organizationId,
      installationId: input.installationId,
      accountId: installation.accountId,
      accountLogin: installation.accountLogin,
      selectedRepositories: []
    },
    now
  );
}
