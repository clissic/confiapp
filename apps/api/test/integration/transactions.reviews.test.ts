import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api } from '../helpers/create-test-app';
import { bearer, registerAndLogin } from '../helpers/auth';
import { setupTestDb, teardownTestDb } from '../helpers/mongo';

describe('integration/transactions+reviews', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 120_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  it('crea operación comprador y obtiene detalle', async () => {
    const buyer = await registerAndLogin({ fullName: 'Buyer Test' });
    const create = await api()
      .post('/transactions')
      .set(bearer(buyer.accessToken))
      .send({
        title: 'iPhone 15 Pro',
        description: 'Equipo en excelente estado',
        conditionsSummary: 'Entrega presencial con agente intermediario',
        amount: 25000,
        currency: 'UYU',
        inviteExpiresInDays: 7,
      });

    expect(create.status).toBeLessThan(300);
    const code = create.body.code ?? create.body.data?.code;
    expect(code).toBeTruthy();

    const detail = await api()
      .get(`/transactions/by-code/${code}`)
      .set(bearer(buyer.accessToken));
    expect(detail.status).toBe(200);
  });

  it('expone reputación del usuario autenticado', async () => {
    const user = await registerAndLogin();
    const rep = await api()
      .get('/reviews/reputation/me')
      .set(bearer(user.accessToken));
    expect(rep.status).toBe(200);
    expect(rep.body.score).toBeTypeOf('number');
    expect(rep.body.roleRatings).toBeTruthy();
  });

  it('lista auditoría propia', async () => {
    const user = await registerAndLogin();
    const audit = await api().get('/audit').set(bearer(user.accessToken));
    expect(audit.status).toBe(200);
    expect(Array.isArray(audit.body.items)).toBe(true);
  });
});
