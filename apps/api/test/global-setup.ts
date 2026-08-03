import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const URI_FILE = path.join(__dirname, '.mongo-uri');

export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('confiapp_test');
  writeFileSync(URI_FILE, uri, 'utf8');
  process.env.DATABASE_URL = uri;

  return async () => {
    await mongod.stop();
  };
}
