import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { connectMongo, disconnectMongo } from '../src/database/connection';

const URI_FILE = path.join(__dirname, '.mongo-uri');

export function getTestMongoUri(): string {
  if (existsSync(URI_FILE)) {
    return readFileSync(URI_FILE, 'utf8').trim();
  }
  return process.env.DATABASE_URL ?? 'mongodb://127.0.0.1:27017/confiapp_test';
}

export async function setupTestDb(): Promise<string> {
  const uri = getTestMongoUri();
  process.env.DATABASE_URL = uri;
  await connectMongo({ uri });
  return uri;
}

export async function teardownTestDb(): Promise<void> {
  await disconnectMongo();
}
