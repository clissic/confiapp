import { Types, type Schema } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const ISSUER = 'https://auth.identificaciondigital.com.uy/api/v2/openid';

// El env se parsea al importar: configurar ID Digital antes de cargar los módulos.
vi.hoisted(() => {
  process.env.ID_DIGITAL_CLIENT_ID = 'cid';
  process.env.ID_DIGITAL_CLIENT_SECRET = 'csecret';
  process.env.ID_DIGITAL_REDIRECT_URI = 'https://api.example/auth/id-digital/callback';
  process.env.ID_DIGITAL_ISSUER = 'https://auth.identificaciondigital.com.uy/api/v2/openid';
  process.env.ID_DIGITAL_TOKEN_URL =
    'https://auth.identificaciondigital.com.uy/api/v2/openid/token';
  process.env.ID_DIGITAL_AUTH_URL = 'https://login.identificaciondigital.com.uy/v2/authorize';
});

import { UserModel as PackageUserModel } from '@confiapp/database';

import { IdDigitalOAuthStateModel, UserModel } from '../../src/database/models';
import { userSchema } from '../../src/database/schemas/user.schema';
import { idDigitalJwksCache } from '../../src/infrastructure/id-digital/jwks';
import { IdDigitalService } from '../../src/modules/auth/id-digital.service';
import { registerAndLogin } from '../helpers/auth';
import { generateRsaKey, signJwt } from '../helpers/rsa-jwt';
import { setupTestDb, teardownTestDb } from '../helpers/mongo';

const key = generateRsaKey('abitab-kid');
const now = () => Math.floor(Date.now() / 1000);

function installFetch(sub = 'sub-abitab-int') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === `${ISSUER}/token`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'at-1',
            token_type: 'Bearer',
            expires_in: 300,
            id_token: signJwt(
              {
                acr: 'pin',
                amr: null,
                aud: 'cid',
                exp: now() + 300,
                iat: now(),
                iss: ISSUER,
                sub,
              },
              key,
            ),
          }),
        };
      }
      if (url === `${ISSUER}/jwks`) {
        return { ok: true, status: 200, json: async () => ({ keys: [key.jwk] }) };
      }
      if (url === `${ISSUER}/userinfo`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sub,
            document: { document_country: 'UY', document_number: '12345678', document_type: 'CI' },
            registration_level: 2,
            registration_level_description: 'Nivel 2: Presencial',
            validation_methods: [{ name: 'presencial', last_validation_date: '2026-01-02T00:00:00Z' }],
          }),
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

/** Paths hoja, entrando en subschemas (single nested y arrays de subdocumentos). */
function leafPaths(schema: Schema, prefix = '', out = new Set<string>()): Set<string> {
  schema.eachPath((p, type) => {
    const nested = (type as { schema?: Schema }).schema;
    if (nested) leafPaths(nested, `${prefix}${p}.`, out);
    else out.add(`${prefix}${p}`);
  });
  return out;
}

async function runCallback(userId: string) {
  const state = `st-${new Types.ObjectId().toHexString()}`;
  await IdDigitalOAuthStateModel.create({
    state,
    user: new Types.ObjectId(userId),
    purpose: 'agent_onboarding',
    nonce: 'nonce-enviado',
    expiresAt: new Date(Date.now() + 60_000),
  });
  return new IdDigitalService().handleCallback({ code: 'c', state });
}

describe('integration/id-digital persistencia del vínculo (Mongo real)', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 120_000);

  afterAll(async () => {
    await teardownTestDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    idDigitalJwksCache.clear();
  });

  it('el modelo User efectivo conoce todos los paths del schema de la API (incl. idDigital)', () => {
    // La API importa @confiapp/database, que registra 'User' primero: el modelo
    // efectivo es el del paquete. Si le falta un path, Mongoose (strict) lo descarta al guardar.
    expect(UserModel).toBe(PackageUserModel);
    const effective = leafPaths(UserModel.schema);
    const missing = [...leafPaths(userSchema)].filter((p) => !effective.has(p));
    expect(missing).toEqual([]);
  });

  it('callback de onboarding persiste sub, linkedAt y onboardingVerifiedAt en la base', async () => {
    installFetch();
    const user = await registerAndLogin({ fullName: 'Agente IDD' });

    const { redirectUrl } = await runCallback(user.id);
    expect(redirectUrl).toContain('idDigital=ok');

    const raw = await UserModel.collection.findOne({ _id: new Types.ObjectId(user.id) });
    const idd = raw?.idDigital as Record<string, unknown> | undefined;
    expect(idd).toBeDefined();
    expect(idd?.sub).toBe('sub-abitab-int');
    expect(idd?.linkedAt).toBeInstanceOf(Date);
    expect(idd?.onboardingVerifiedAt).toBeInstanceOf(Date);
    expect(idd?.lastAcr).toBe('pin');
    expect(idd?.lastMethods).toEqual(['pin']);
    expect(idd?.registrationLevel).toBe(2);
    expect(idd?.document).toEqual({ number: '12345678', type: 'CI', country: 'UY' });
    expect(idd?.documentMismatch).toBe(false);
    // Sin internals de Mongoose filtrados por el spread del subdocumento.
    expect(Object.keys(idd ?? {}).filter((k) => k.startsWith('$') || k === '_doc')).toEqual([]);

    const status = await new IdDigitalService().getStatus(user.id);
    expect(status.linked).toBe(true);
    expect(status.onboardingVerified).toBe(true);

    const fresh = await UserModel.findById(user.id).exec();
    expect(() => new IdDigitalService().assertOnboardingVerified(fresh!)).not.toThrow();
  });

  it('una segunda verificación conserva linkedAt y actualiza lastVerifiedAt', async () => {
    installFetch('sub-abitab-int-2');
    const user = await registerAndLogin({ fullName: 'Agente IDD 2' });
    await runCallback(user.id);
    const first = (await UserModel.collection.findOne({ _id: new Types.ObjectId(user.id) }))
      ?.idDigital as Record<string, Date>;

    await new Promise((r) => setTimeout(r, 15));
    idDigitalJwksCache.clear();
    const again = await runCallback(user.id);
    expect(again.redirectUrl).toContain('idDigital=ok');
    const second = (await UserModel.collection.findOne({ _id: new Types.ObjectId(user.id) }))
      ?.idDigital as Record<string, unknown>;

    expect(second.sub).toBe('sub-abitab-int-2');
    expect((second.linkedAt as Date).getTime()).toBe(first.linkedAt!.getTime());
    expect((second.lastVerifiedAt as Date).getTime()).toBeGreaterThan(
      first.lastVerifiedAt!.getTime(),
    );
    expect(Object.keys(second).filter((k) => k.startsWith('$') || k === '_doc')).toEqual([]);
  });
});
