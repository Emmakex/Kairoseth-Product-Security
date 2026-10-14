import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { loadEnv, requireGitHubAppEnv, requireInternalApiEnv } from './config/env.js';
import { connectMongo } from './db/mongo.js';
import { GitHubAppClient } from './github/client.js';
import { isGitHubConnectorError } from './github/errors.js';
import { ensureGitHubIndexes, githubCollections } from './github/store.js';
import { processGitHubWebhook } from './github/webhook.js';
import { completeInternalGitHubInstall, createInternalGitHubInstallSetup } from './internal/github-install.js';
import {
  bearerTokenFromAuthorizationHeader,
  ProductSecurityServiceAuthError,
  verifyProductSecurityServiceToken
} from './internal/service-auth.js';
import { createLogger } from './logger.js';

const MAX_BODY_BYTES = 64 * 1024;
const INSTALL_SETUP_PATH = '/internal/product-security/v1/github/install/setup';
const INSTALL_COMPLETE_PATH = '/internal/product-security/v1/github/install/complete';
const GITHUB_WEBHOOK_PATH = '/webhooks/github';

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error('request_body_too_large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseJsonBody(body: Buffer): unknown {
  if (body.length === 0) return {};
  return JSON.parse(body.toString('utf8')) as unknown;
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const apiEnv = requireInternalApiEnv(env);
  const githubEnv = requireGitHubAppEnv(env);
  const logger = createLogger(env);
  const mongo = await connectMongo(env);
  const collections = githubCollections(mongo.db);
  await ensureGitHubIndexes(collections);
  const githubClient = new GitHubAppClient({
    appId: githubEnv.appId,
    privateKeyPem: githubEnv.privateKeyPem,
    apiBaseUrl: githubEnv.apiBaseUrl
  });

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', 'http://product-security.internal');

    try {
      if (method === 'GET' && url.pathname === '/healthz') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }

      if (method === 'POST' && url.pathname === GITHUB_WEBHOOK_PATH) {
        const body = await readBody(request);
        const result = await processGitHubWebhook({
          collections,
          webhookSecret: githubEnv.webhookSecret,
          body,
          signature: firstHeader(request.headers['x-hub-signature-256']),
          deliveryId: firstHeader(request.headers['x-github-delivery']),
          event: firstHeader(request.headers['x-github-event'])
        });
        sendJson(response, result.status === 'duplicate' ? 200 : 202, result);
        return;
      }

      if (
        method === 'POST' &&
        (url.pathname === INSTALL_SETUP_PATH || url.pathname === INSTALL_COMPLETE_PATH)
      ) {
        const serviceToken = bearerTokenFromAuthorizationHeader(firstHeader(request.headers.authorization));
        const claims = verifyProductSecurityServiceToken({
          token: serviceToken,
          secret: apiEnv.serviceSecret,
          requiredScope: 'github:install'
        });
        const body = parseJsonBody(await readBody(request));

        if (url.pathname === INSTALL_SETUP_PATH) {
          const result = await createInternalGitHubInstallSetup({
            claims,
            body,
            collections,
            appSlug: githubEnv.appSlug
          });
          sendJson(response, 201, result);
          return;
        }

        const result = await completeInternalGitHubInstall({
          claims,
          body,
          collections,
          client: githubClient
        });
        sendJson(response, 200, result);
        return;
      }

      sendJson(response, 404, { code: 'not_found' });
    } catch (error: unknown) {
      if (error instanceof ProductSecurityServiceAuthError) {
        sendJson(response, error.code === 'service_scope_denied' ? 403 : 401, { code: error.code });
        return;
      }
      if (isGitHubConnectorError(error)) {
        sendJson(response, 400, { code: error.code });
        return;
      }
      if (error instanceof ZodError || (error instanceof SyntaxError && method === 'POST')) {
        sendJson(response, 400, { code: 'invalid_input' });
        return;
      }
      if (error instanceof Error && error.message === 'request_body_too_large') {
        sendJson(response, 413, { code: 'request_body_too_large' });
        return;
      }
      logger.error({ err: error, path: url.pathname }, 'Internal Product Security API request failed');
      sendJson(response, 500, { code: 'internal_error' });
    }
  }

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });

  server.listen(apiEnv.port, apiEnv.host, () => {
    logger.info({ host: apiEnv.host, port: apiEnv.port }, 'Product Security internal API listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Product Security internal API shutting down');
    server.close();
    await mongo.client.close();
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

await main();
