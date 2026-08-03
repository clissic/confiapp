import rateLimit from 'express-rate-limit';

import { env } from '../shared/config/env';

/** Rate limit estricto para login/register/forgot (OWASP brute-force). */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    error: 'TooManyRequests',
    code: 'AUTH_RATE_LIMIT',
    message: 'Too many authentication attempts, please try again later',
  },
});
