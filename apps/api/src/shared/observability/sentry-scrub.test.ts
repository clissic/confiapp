import { describe, expect, it } from 'vitest';

import { REDACTED, parseSampleRate, scrubSentryEvent } from './sentry-scrub';

describe('scrubSentryEvent', () => {
  it('elimina headers de auth, cookies y campos sensibles', () => {
    const event = scrubSentryEvent({
      request: {
        url: 'https://api.test/oauth/callback?code=abc&state=xyz&page=2',
        headers: { Authorization: 'Bearer x', Cookie: 'sid=1', 'content-type': 'application/json' },
        cookies: { sid: '1' },
        data: JSON.stringify({
          email: 'a@b.c',
          password: 'p',
          nested: { id_token: 't', cedula: '1234' },
        }),
        query_string: 'token=abc&q=hola',
      },
      extra: {
        client_secret: 's',
        access_token: 'a',
        documento: '9',
        ok: 1,
        list: [{ refreshToken: 'r' }],
      },
      user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4' },
    });

    expect(event.request.headers).toEqual({
      Authorization: REDACTED,
      Cookie: REDACTED,
      'content-type': 'application/json',
    });
    expect(event.request.cookies).toBeUndefined();
    expect(JSON.parse(event.request.data)).toEqual({
      email: 'a@b.c',
      password: REDACTED,
      nested: { id_token: REDACTED, cedula: REDACTED },
    });
    expect(event.request.query_string).toBe(`token=${encodeURIComponent(REDACTED)}&q=hola`);
    expect(event.request.url).toContain('page=2');
    expect(event.request.url).not.toContain('abc');
    expect(event.extra).toEqual({
      client_secret: REDACTED,
      access_token: REDACTED,
      documento: REDACTED,
      ok: 1,
      list: [{ refreshToken: REDACTED }],
    });
    expect(event.user).toEqual({ id: 'u1' });
  });

  it('no rompe con eventos vacíos', () => {
    expect(scrubSentryEvent({})).toEqual({});
  });
});

describe('parseSampleRate', () => {
  it('usa 0 por defecto y limita a 0..1', () => {
    expect(parseSampleRate(undefined)).toBe(0);
    expect(parseSampleRate('')).toBe(0);
    expect(parseSampleRate('abc')).toBe(0);
    expect(parseSampleRate('-1')).toBe(0);
    expect(parseSampleRate('0.25')).toBe(0.25);
    expect(parseSampleRate('5')).toBe(1);
  });
});
