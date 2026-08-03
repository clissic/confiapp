import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api } from '../helpers/create-test-app';
import { bearer, registerAndLogin } from '../helpers/auth';
import { setupTestDb, teardownTestDb } from '../helpers/mongo';

describe('integration/health+auth', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 120_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  it('GET /health responde ok', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
  });

  it('registra, loguea y consulta /auth/me', async () => {
    const user = await registerAndLogin({ fullName: 'Integration User' });
    const me = await api().get('/auth/me').set(bearer(user.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.email ?? me.body.user?.email).toBe(user.email);
  });

  it('rechaza login inválido', async () => {
    const res = await api().post('/auth/login').send({
      email: 'nobody@test.local',
      password: 'WrongPass1!',
    });
    expect(res.status).toBeGreaterThanOrEqual(401);
  });
});
