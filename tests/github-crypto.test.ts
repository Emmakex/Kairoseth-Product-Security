import { createHmac, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createGitHubAppJwt, verifyGitHubWebhookSignature } from '../src/github/crypto.js';

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('GitHub App cryptography', () => {
  it('creates a valid RS256 GitHub App JWT with bounded lifetime', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const now = new Date('2026-10-13T16:00:00.000Z');
    const jwt = createGitHubAppJwt({ appId: '123456', privateKeyPem, now });
    const [headerSegment, payloadSegment, signatureSegment] = jwt.split('.');

    expect(headerSegment).toBeTruthy();
    expect(payloadSegment).toBeTruthy();
    expect(signatureSegment).toBeTruthy();
    if (!headerSegment || !payloadSegment || !signatureSegment) return;

    const header = decodeJson(headerSegment);
    const payload = decodeJson(payloadSegment);
    expect(header.alg).toBe('RS256');
    expect(payload.iss).toBe('123456');
    expect(payload.iat).toBe(Math.floor(now.getTime() / 1000) - 60);
    expect(payload.exp).toBe(Math.floor(now.getTime() / 1000) + 540);

    const valid = verify(
      'RSA-SHA256',
      Buffer.from(`${headerSegment}.${payloadSegment}`, 'utf8'),
      publicKey,
      Buffer.from(signatureSegment, 'base64url')
    );
    expect(valid).toBe(true);
  });

  it('accepts only the correct sha256 webhook signature', () => {
    const body = JSON.stringify({ installation: { id: 42 }, action: 'created' });
    const secret = 'a-long-test-webhook-secret';
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

    expect(verifyGitHubWebhookSignature({ body, signature, secret })).toBe(true);
    expect(verifyGitHubWebhookSignature({ body: `${body}x`, signature, secret })).toBe(false);
    expect(verifyGitHubWebhookSignature({ body, signature: 'sha256=00', secret })).toBe(false);
    expect(verifyGitHubWebhookSignature({ body, signature: undefined, secret })).toBe(false);
  });
});
