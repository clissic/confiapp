import rateLimit from 'express-rate-limit';

import { env } from '../shared/config/env';
import { createRateLimitStore } from './rate-limit-store';

const tooMany = {
  statusCode: 429,
  error: 'TooManyRequests',
  code: 'RATE_LIMIT',
  message: 'Too many requests, please try again later',
};

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore('global'),
  skip: (req) => req.path === '/health',
  message: tooMany,
});

export const webhookRateLimiter = rateLimit({
  windowMs: env.WEBHOOK_RATE_LIMIT_WINDOW_MS,
  max: env.WEBHOOK_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore('webhook'),
  message: {
    ...tooMany,
    code: 'WEBHOOK_RATE_LIMIT',
  },
});

export const checkoutRateLimiter = rateLimit({
  windowMs: env.CHECKOUT_RATE_LIMIT_WINDOW_MS,
  max: env.CHECKOUT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore('checkout'),
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  validate: { keyGeneratorIpFallback: false },
  message: {
    ...tooMany,
    code: 'CHECKOUT_RATE_LIMIT',
    message: 'Too many checkout attempts, please try again later',
  },
});

export const geoRateLimiter = rateLimit({
  windowMs: env.GEO_RATE_LIMIT_WINDOW_MS,
  max: env.GEO_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore('geo'),
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  validate: { keyGeneratorIpFallback: false },
  message: {
    ...tooMany,
    code: 'GEO_RATE_LIMIT',
  },
});

export const chatRateLimiter = rateLimit({
  windowMs: env.CHAT_RATE_LIMIT_WINDOW_MS,
  max: env.CHAT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore('chat'),
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  validate: { keyGeneratorIpFallback: false },
  message: {
    ...tooMany,
    code: 'CHAT_RATE_LIMIT',
  },
});

export const mediaRateLimiter = rateLimit({
  windowMs: env.MEDIA_RATE_LIMIT_WINDOW_MS,
  max: env.MEDIA_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore('media'),
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  validate: { keyGeneratorIpFallback: false },
  message: {
    ...tooMany,
    code: 'MEDIA_RATE_LIMIT',
  },
});

export const oauthRateLimiter = rateLimit({
  windowMs: env.OAUTH_RATE_LIMIT_WINDOW_MS,
  max: env.OAUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore('oauth'),
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  validate: { keyGeneratorIpFallback: false },
  message: {
    ...tooMany,
    code: 'OAUTH_RATE_LIMIT',
  },
});
