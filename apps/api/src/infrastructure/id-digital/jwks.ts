import { createPublicKey, type JsonWebKey, type KeyObject } from 'node:crypto';

/** JWK pública tal como la expone el endpoint JWKS del proveedor. */
export interface Jwk extends JsonWebKey {
  kid?: string;
  kty?: string;
  use?: string;
  alg?: string;
}

export class JwksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwksError';
  }
}

export type JwksFetcher = (url: string) => Promise<{ keys: Jwk[] }>;

const defaultFetcher: JwksFetcher = async (url) => {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new JwksError(`JWKS respondió HTTP ${res.status}`);
  }
  const body = (await res.json()) as { keys?: unknown };
  if (!body || !Array.isArray(body.keys)) {
    throw new JwksError('JWKS sin array keys');
  }
  return { keys: body.keys as Jwk[] };
};

interface CacheEntry {
  keys: Map<string, KeyObject>;
  /** Claves sin kid (solo se usan si el token tampoco trae kid). */
  anonymous: KeyObject[];
  fetchedAt: number;
}

/**
 * Cache de claves públicas RSA por URL de JWKS, con búsqueda por `kid`.
 * - TTL de cache (por defecto 10 min).
 * - Si llega un `kid` desconocido se vuelve a pedir el JWKS (rotación de claves),
 *   con un intervalo mínimo entre refetches para no martillar al proveedor.
 */
export class JwksCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<CacheEntry>>();

  constructor(
    private readonly options: {
      fetcher?: JwksFetcher;
      ttlMs?: number;
      minRefetchIntervalMs?: number;
      now?: () => number;
    } = {},
  ) {}

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  async getKey(jwksUrl: string, kid: string | undefined): Promise<KeyObject> {
    const ttl = this.options.ttlMs ?? 10 * 60 * 1000;
    const minRefetch = this.options.minRefetchIntervalMs ?? 30 * 1000;

    let entry = this.cache.get(jwksUrl);
    const age = entry ? this.now() - entry.fetchedAt : Infinity;

    if (!entry || age > ttl) {
      entry = await this.load(jwksUrl);
    }

    let key = this.pick(entry, kid);
    if (!key && this.now() - entry.fetchedAt >= minRefetch) {
      entry = await this.load(jwksUrl);
      key = this.pick(entry, kid);
    }
    if (!key) {
      throw new JwksError(
        kid ? `No hay clave pública para kid=${kid}` : 'No hay clave pública sin kid',
      );
    }
    return key;
  }

  private pick(entry: CacheEntry, kid: string | undefined): KeyObject | undefined {
    if (kid) return entry.keys.get(kid);
    if (entry.keys.size + entry.anonymous.length === 1) {
      return entry.anonymous[0] ?? [...entry.keys.values()][0];
    }
    return undefined;
  }

  private async load(jwksUrl: string): Promise<CacheEntry> {
    const pending = this.inflight.get(jwksUrl);
    if (pending) return pending;

    const fetcher = this.options.fetcher ?? defaultFetcher;
    const promise = (async () => {
      const { keys } = await fetcher(jwksUrl);
      const entry: CacheEntry = { keys: new Map(), anonymous: [], fetchedAt: this.now() };
      for (const jwk of keys) {
        if (jwk.kty !== 'RSA') continue;
        if (jwk.use && jwk.use !== 'sig') continue;
        let keyObject: KeyObject;
        try {
          keyObject = createPublicKey({ key: jwk, format: 'jwk' });
        } catch {
          continue;
        }
        if (jwk.kid) entry.keys.set(jwk.kid, keyObject);
        else entry.anonymous.push(keyObject);
      }
      this.cache.set(jwksUrl, entry);
      return entry;
    })();

    this.inflight.set(jwksUrl, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(jwksUrl);
    }
  }
}

/** Cache compartida por el proceso (callback ID Digital). */
export const idDigitalJwksCache = new JwksCache();
