import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1).default('kairoseth_product_security'),
  WORKER_ID: z.string().min(1).default('product-security-worker'),
  WORKER_POLL_MS: z.coerce.number().int().min(100).max(60_000).default(2_000),
  JOB_LEASE_MS: z.coerce.number().int().min(1_000).max(15 * 60_000).default(30_000),
  WORKER_ONCE: booleanFromString.default(false),
  PRODUCT_SECURITY_SERVICE_SECRET: z.string().min(32).optional(),
  PRODUCT_SECURITY_API_HOST: z.string().min(1).default('0.0.0.0'),
  PRODUCT_SECURITY_API_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_SLUG: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_WEBHOOK_SECRET: z.string().min(16).optional(),
  GITHUB_API_BASE_URL: z.url().default('https://api.github.com')
});

export type AppEnv = z.infer<typeof envSchema>;

export interface GitHubAppEnv {
  appId: string;
  appSlug: string;
  privateKeyPem: string;
  webhookSecret: string;
  apiBaseUrl: string;
}

export interface InternalApiEnv {
  serviceSecret: string;
  host: string;
  port: number;
}

export function loadEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}

export function requireGitHubAppEnv(env: AppEnv): GitHubAppEnv {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_SLUG || !env.GITHUB_APP_PRIVATE_KEY || !env.GITHUB_WEBHOOK_SECRET) {
    throw new Error(
      'GitHub App connector requires GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY and GITHUB_WEBHOOK_SECRET'
    );
  }

  return {
    appId: env.GITHUB_APP_ID,
    appSlug: env.GITHUB_APP_SLUG,
    privateKeyPem: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    apiBaseUrl: env.GITHUB_API_BASE_URL
  };
}

export function requireInternalApiEnv(env: AppEnv): InternalApiEnv {
  if (!env.PRODUCT_SECURITY_SERVICE_SECRET) {
    throw new Error('Internal Product Security API requires PRODUCT_SECURITY_SERVICE_SECRET');
  }
  return {
    serviceSecret: env.PRODUCT_SECURITY_SERVICE_SECRET,
    host: env.PRODUCT_SECURITY_API_HOST,
    port: env.PRODUCT_SECURITY_API_PORT
  };
}
