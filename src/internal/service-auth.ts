import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const PRODUCT_SECURITY_SERVICE_AUDIENCE = 'kairoseth-product-security';
export const KAIROSETH_PLATFORM_ISSUER = 'kairoseth-platform';

export const serviceScopeSchema = z.enum(['github:install']);
export type ProductSecurityServiceScope = z.infer<typeof serviceScopeSchema>;

const githubNumericIdSchema = z.string().regex(/^\d+$/).max(32);

const tokenPayloadSchema = z.object({
  iss: z.literal(KAIROSETH_PLATFORM_ISSUER),
  aud: z.literal(PRODUCT_SECURITY_SERVICE_AUDIENCE),
  sub: z.string().min(1).max(256),
  organizationId: z.string().min(1).max(256),
  productSlug: z.literal('product-security'),
  scopes: z.array(serviceScopeSchema).min(1).max(16),
  githubUserId: githubNumericIdSchema.optional(),
  verifiedGitHubInstallationId: githubNumericIdSchema.optional(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  jti: z.string().uuid()
});

const tokenHeaderSchema = z.object({
  alg: z.literal('HS256'),
  typ: z.literal('KPS-ST')
});

export type ProductSecurityServiceClaims = z.infer<typeof tokenPayloadSchema>;

export class ProductSecurityServiceAuthError extends Error {
  readonly code: 'invalid_service_token' | 'service_scope_denied';

  constructor(code: ProductSecurityServiceAuthError['code'], message: string) {
    super(message);
    this.name = 'ProductSecurityServiceAuthError';
    this.code = code;
  }
}

function assertSecret(secret: string): void {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new ProductSecurityServiceAuthError(
      'invalid_service_token',
      'Product Security service secret must be at least 32 bytes'
    );
  }
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Malformed service token payload');
  }
}

function signParts(header: string, payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${header}.${payload}`, 'utf8').digest();
}

export function signProductSecurityServiceToken(input: {
  secret: string;
  actorId: string;
  organizationId: string;
  scopes: readonly ProductSecurityServiceScope[];
  githubUserId?: string;
  verifiedGitHubInstallationId?: string;
  now?: Date;
  ttlSeconds?: number;
  jti?: string;
}): string {
  assertSecret(input.secret);
  const now = input.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1000);
  const ttlSeconds = input.ttlSeconds ?? 60;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 10 || ttlSeconds > 120) {
    throw new ProductSecurityServiceAuthError(
      'invalid_service_token',
      'Service token TTL must be between 10 and 120 seconds'
    );
  }

  const header = encodeJson({ alg: 'HS256', typ: 'KPS-ST' });
  const payload = tokenPayloadSchema.parse({
    iss: KAIROSETH_PLATFORM_ISSUER,
    aud: PRODUCT_SECURITY_SERVICE_AUDIENCE,
    sub: input.actorId,
    organizationId: input.organizationId,
    productSlug: 'product-security',
    scopes: [...new Set(input.scopes)],
    ...(input.githubUserId ? { githubUserId: input.githubUserId } : {}),
    ...(input.verifiedGitHubInstallationId
      ? { verifiedGitHubInstallationId: input.verifiedGitHubInstallationId }
      : {}),
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: input.jti ?? randomUUID()
  });
  const encodedPayload = encodeJson(payload);
  const signature = signParts(header, encodedPayload, input.secret).toString('base64url');
  return `${header}.${encodedPayload}.${signature}`;
}

export function verifyProductSecurityServiceToken(input: {
  token: string;
  secret: string;
  requiredScope: ProductSecurityServiceScope;
  now?: Date;
  clockSkewSeconds?: number;
}): ProductSecurityServiceClaims {
  assertSecret(input.secret);
  const parts = input.token.split('.');
  if (parts.length !== 3) {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Malformed service token');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Malformed service token');
  }

  const parsedHeader = tokenHeaderSchema.safeParse(decodeJson(encodedHeader));
  const parsedPayload = tokenPayloadSchema.safeParse(decodeJson(encodedPayload));
  if (!parsedHeader.success || !parsedPayload.success) {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Invalid service token claims');
  }

  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(encodedSignature, 'base64url');
  } catch {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Malformed service token signature');
  }
  const expectedSignature = signParts(encodedHeader, encodedPayload, input.secret);
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Invalid service token signature');
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const skew = input.clockSkewSeconds ?? 5;
  if (!Number.isSafeInteger(skew) || skew < 0 || skew > 30) {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Invalid service-token clock skew');
  }
  if (parsedPayload.data.iat > nowSeconds + skew || parsedPayload.data.exp <= nowSeconds - skew) {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Expired or not-yet-valid service token');
  }
  if (parsedPayload.data.exp - parsedPayload.data.iat > 120) {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Service token lifetime exceeds maximum');
  }
  if (!parsedPayload.data.scopes.includes(input.requiredScope)) {
    throw new ProductSecurityServiceAuthError('service_scope_denied', 'Required service scope is missing');
  }

  return parsedPayload.data;
}

export function bearerTokenFromAuthorizationHeader(value: string | undefined): string {
  const match = /^Bearer\s+(.+)$/i.exec(value?.trim() ?? '');
  if (!match?.[1]) {
    throw new ProductSecurityServiceAuthError('invalid_service_token', 'Bearer service token is required');
  }
  return match[1];
}
