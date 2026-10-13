import { createHmac, createPrivateKey, sign, timingSafeEqual } from 'node:crypto';

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function createGitHubAppJwt(input: {
  appId: string;
  privateKeyPem: string;
  now?: Date;
}): string {
  const appId = input.appId.trim();
  if (!appId) throw new Error('GitHub App ID is required');

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlJson({
    iat: nowSeconds - 60,
    exp: nowSeconds + 9 * 60,
    iss: appId
  });
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey(input.privateKeyPem.replace(/\\n/g, '\n'));
  const signature = sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), key).toString('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyGitHubWebhookSignature(input: {
  body: string | Buffer;
  signature: string | undefined;
  secret: string;
}): boolean {
  const signature = input.signature?.trim();
  if (!signature?.startsWith('sha256=')) return false;

  const suppliedHex = signature.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/i.test(suppliedHex)) return false;

  const expected = createHmac('sha256', input.secret).update(input.body).digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
