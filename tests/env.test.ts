import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

describe('loadEnv', () => {
  it('parses required Mongo configuration and safe defaults', () => {
    const env = loadEnv({ MONGODB_URI: 'mongodb://example:27017' });
    expect(env.MONGODB_DB).toBe('kairoseth_product_security');
    expect(env.WORKER_POLL_MS).toBe(2000);
    expect(env.WORKER_ONCE).toBe(false);
  });

  it('rejects an empty Mongo URI', () => {
    expect(() => loadEnv({ MONGODB_URI: '' })).toThrow();
  });
});
