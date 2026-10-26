import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DatabaseModule } from '../../src/database';
import { api } from '../helpers/create-test-app';
import { setupTestDb, teardownTestDb } from '../helpers/mongo';

describe('integration/health', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 120_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  it('GET /health retorna 200 cuando la DB está conectada', async () => {
    const res = await api().get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      uptime: expect.any(Number),
      database: {
        connected: true,
        readyState: 1,
      },
    });
  });

  it('GET /health retorna 503 cuando la DB está desconectada', async () => {
    await DatabaseModule.disconnect();

    const res = await api().get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'error',
      uptime: expect.any(Number),
      database: {
        connected: false,
        readyState: 0,
      },
    });

    await setupTestDb();
  });
});
