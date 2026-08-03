import rateLimit from 'express-rate-limit';

import { env } from '../shared/config/env';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === '/health' ||
    req.path.startsWith('/payments/webhooks'),
  message: {
    statusCode: 429,
    error: 'TooManyRequests',
    code: 'RATE_LIMIT',
    message: 'Too many requests, please try again later',
  },
});
