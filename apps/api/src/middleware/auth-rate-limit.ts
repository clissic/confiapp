import rateLimit from 'express-rate-limit';

import { env } from '../shared/config/env';
import { createRateLimitStore } from './rate-limit-store';

export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore('auth'),
  message: {
    statusCode: 429,
    error: 'TooManyRequests',
    code: 'AUTH_RATE_LIMIT',
    message: 'Too many auth attempts, please try again later',
  },
});
