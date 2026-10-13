import { MongoClient, type Db } from 'mongodb';
import type { AppEnv } from '../config/env.js';

export interface MongoHandle {
  client: MongoClient;
  db: Db;
}

export async function connectMongo(env: Pick<AppEnv, 'MONGODB_URI' | 'MONGODB_DB'>): Promise<MongoHandle> {
  const client = new MongoClient(env.MONGODB_URI, {
    appName: 'kairoseth-product-security'
  });
  await client.connect();
  return { client, db: client.db(env.MONGODB_DB) };
}
