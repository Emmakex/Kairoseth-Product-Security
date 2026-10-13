import type { ObjectId } from 'mongodb';

export const PRODUCT_STATUSES = ['active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const REPOSITORY_PROVIDERS = ['manual', 'github', 'gitlab', 'bitbucket'] as const;
export type RepositoryProvider = (typeof REPOSITORY_PROVIDERS)[number];

export const RELEASE_SOURCE_KINDS = ['tag', 'commit', 'manual'] as const;
export type ReleaseSourceKind = (typeof RELEASE_SOURCE_KINDS)[number];

export interface ProductDocument {
  _id?: ObjectId;
  organizationId: string;
  productKey: string;
  displayName: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositoryDocument {
  _id?: ObjectId;
  organizationId: string;
  productId: ObjectId;
  provider: RepositoryProvider;
  externalId: string;
  canonicalName: string;
  defaultBranch?: string;
  createdAt: Date;
  updatedAt: Date;
  lastInventoriedAt?: Date;
}

export interface ReleaseDocument {
  _id?: ObjectId;
  organizationId: string;
  productId: ObjectId;
  repositoryId: ObjectId;
  sourceKind: ReleaseSourceKind;
  sourceName: string;
  commitSha: string;
  version?: string;
  publishedAt?: Date;
  firstObservedAt: Date;
  lastObservedAt: Date;
}

export interface RepositorySnapshot {
  provider: RepositoryProvider;
  externalId: string;
  canonicalName: string;
  defaultBranch?: string;
}

export interface ReleaseSnapshot {
  sourceKind: ReleaseSourceKind;
  sourceName: string;
  commitSha: string;
  version?: string;
  publishedAt?: Date;
}

export interface InventoryResult {
  productId: ObjectId;
  repositoryId: ObjectId;
  repositoryCreated: boolean;
  releasesObserved: number;
  releasesCreated: number;
}
