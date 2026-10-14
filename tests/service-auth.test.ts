import { describe, expect, it } from 'vitest';
import {
  ProductSecurityServiceAuthError,
  signProductSecurityServiceToken,
  verifyProductSecurityServiceToken
} from '../src/internal/service-auth.js';

const secret = 'kairoseth-product-security-service-secret-0123456789';
const now = new Date('2099-01-01T00:00:00.000Z');

describe('Product Security internal service authentication', () => {
  it('signs and verifies short-lived organization-scoped claims', () => {
    const token = signProductSecurityServiceToken({
      secret,
      actorId: 'user-1',
      organizationId: 'org-1',
      scopes: ['github:install'],
      now,
      ttlSeconds: 60,
      jti: '00000000-0000-4000-8000-000000000001'
    });

    const claims = verifyProductSecurityServiceToken({
      token,
      secret,
      requiredScope: 'github:install',
      now: new Date(now.getTime() + 30_000)
    });

    expect(claims.organizationId).toBe('org-1');
    expect(claims.sub).toBe('user-1');
    expect(claims.productSlug).toBe('product-security');
    expect(claims.scopes).toEqual(['github:install']);
  });

  it('rejects tampering', () => {
    const token = signProductSecurityServiceToken({
      secret,
      actorId: 'user-1',
      organizationId: 'org-1',
      scopes: ['github:install'],
      now
    });
    const [header, payload, signature] = token.split('.');
    const tampered = `${header}.${payload}x.${signature}`;

    expect(() => verifyProductSecurityServiceToken({
      token: tampered,
      secret,
      requiredScope: 'github:install',
      now
    })).toThrow(ProductSecurityServiceAuthError);
  });

  it('rejects expired tokens', () => {
    const token = signProductSecurityServiceToken({
      secret,
      actorId: 'user-1',
      organizationId: 'org-1',
      scopes: ['github:install'],
      now,
      ttlSeconds: 10
    });

    expect(() => verifyProductSecurityServiceToken({
      token,
      secret,
      requiredScope: 'github:install',
      now: new Date(now.getTime() + 20_000),
      clockSkewSeconds: 0
    })).toThrow(ProductSecurityServiceAuthError);
  });

  it('requires a high-entropy shared secret', () => {
    expect(() => signProductSecurityServiceToken({
      secret: 'too-short',
      actorId: 'user-1',
      organizationId: 'org-1',
      scopes: ['github:install'],
      now
    })).toThrow(ProductSecurityServiceAuthError);
  });
});
