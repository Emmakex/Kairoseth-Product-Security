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
  WORKER_ONCE: booleanFromString.default(false)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}
