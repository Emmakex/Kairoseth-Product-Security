import type { ObjectId } from 'mongodb';

export type GitHubInstallationStatus = 'active' | 'revoked';

export interface GitHubSelectedRepository {
  repositoryId: number;
  fullName: string;
}

export interface GitHubInstallationDocument {
  _id?: ObjectId;
  organizationId: string;
  installationId: number;
  accountId?: number;
  accountLogin?: string;
  status: GitHubInstallationStatus;
  selectedRepositories: GitHubSelectedRepository[];
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
}

export interface GitHubInstallSetupDocument {
  _id?: ObjectId;
  stateHash: string;
  organizationId: string;
  expectedAccountId: number;
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
  installationId?: number;
}

export interface GitHubWebhookDeliveryDocument {
  _id?: ObjectId;
  deliveryId: string;
  event: string;
  installationId: number;
  organizationId: string;
  receivedAt: Date;
  action?: string;
}

export interface GitHubInstallationToken {
  token: string;
  expiresAt: Date;
}

export interface GitHubRepositoryDescriptor {
  repositoryId: number;
  fullName: string;
}
