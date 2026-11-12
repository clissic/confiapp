import { describe, expect, it, vi } from 'vitest';

import { JwksCache, JwksError } from './jwks';
import { generateRsaKey } from '../../../test/helpers/rsa-jwt';

const url = 'https://idp.example/jwks';

describe('JwksCache', () => {
  const k1 = generateRsaKey('k1');
  const k2 = generateRsaKey('k2');

  it('cachea las claves y busca por kid', async () => {
    const fetcher = vi.fn().mockResolvedValue({ keys: [k1.jwk, k2.jwk] });
    const cache = new JwksCache({ fetcher });
    const a = await cache.getKey(url, 'k1');
    const b = await cache.getKey(url, 'k2');
    expect(a.asymmetricKeyType).toBe('rsa');
    expect(b).not.toBe(a);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetchea ante kid desconocido (rotación)', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ keys: [k1.jwk] })
      .mockResolvedValueOnce({ keys: [k1.jwk, k2.jwk] });
    let t = 0;
    const cache = new JwksCache({ fetcher, minRefetchIntervalMs: 1000, now: () => t });
    await cache.getKey(url, 'k1');
    t = 5000;
    await expect(cache.getKey(url, 'k2')).resolves.toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('no refetchea antes del intervalo mínimo', async () => {
    const fetcher = vi.fn().mockResolvedValue({ keys: [k1.jwk] });
    let t = 0;
    const cache = new JwksCache({ fetcher, minRefetchIntervalMs: 30_000, now: () => t });
    await cache.getKey(url, 'k1');
    t = 1000;
    await expect(cache.getKey(url, 'nope')).rejects.toBeInstanceOf(JwksError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('expira por TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue({ keys: [k1.jwk] });
    let t = 0;
    const cache = new JwksCache({ fetcher, ttlMs: 100, now: () => t });
    await cache.getKey(url, 'k1');
    t = 200;
    await cache.getKey(url, 'k1');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ignora claves no RSA o no de firma', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      keys: [
        { kty: 'EC', kid: 'ec', crv: 'P-256', x: 'x', y: 'y' },
        { ...k1.jwk, use: 'enc' },
      ],
    });
    const cache = new JwksCache({ fetcher, minRefetchIntervalMs: Infinity });
    await expect(cache.getKey(url, 'k1')).rejects.toBeInstanceOf(JwksError);
  });

  it('sin kid usa la única clave disponible', async () => {
    const fetcher = vi.fn().mockResolvedValue({ keys: [k1.jwk] });
    const cache = new JwksCache({ fetcher });
    await expect(cache.getKey(url, undefined)).resolves.toBeDefined();
  });
});
