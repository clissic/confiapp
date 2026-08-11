import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import express, { type Express, type Request } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import {
  errorHandler,
  globalRateLimiter,
  notFoundHandler,
} from './middleware';
import {
  agentsRoutes,
  auditRoutes,
  authRoutes,
  chatsRoutes,
  disputesRoutes,
  evidenceRoutes,
  healthRoutes,
  notificationsRoutes,
  paymentsRoutes,
  transactionsRoutes,
  usersRoutes,
  walletRoutes,
  reviewsRoutes,
} from './modules';
import { env } from './shared/config/env';
import { logger, morganStream } from './utils/logger';
import { openApiDocument } from './utils/openapi';

function corsOrigins(): string | string[] | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void) {
  const configured = env.CORS_ORIGIN.includes(',')
    ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [env.CORS_ORIGIN];

  // Producción: solo orígenes explícitos.
  if (env.NODE_ENV === 'production') {
    return configured.length === 1 ? configured[0]! : configured;
  }

  // Desarrollo: Local + Network (IP LAN) + túneles, sin listar IPs a mano.
  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (configured.includes(origin)) {
      callback(null, true);
      return;
    }
    try {
      const { hostname, protocol } = new URL(origin);
      const isHttp = protocol === 'http:' || protocol === 'https:';
      const isLocal =
        hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
      const isPrivateLan =
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
      const isTunnel =
        hostname.endsWith('.trycloudflare.com') ||
        hostname.endsWith('.ngrok-free.app') ||
        hostname.endsWith('.ngrok.io');
      callback(null, isHttp && (isLocal || isPrivateLan || isTunnel));
    } catch {
      callback(null, false);
    }
  };
}

function isChatMessageWrite(req: Request): boolean {
  return (
    (req.method === 'POST' || req.method === 'PUT') &&
    /^\/chats\/[^/]+\/messages\/?$/.test(req.path)
  );
}

function isUserProfileWrite(req: Request): boolean {
  return (
    (req.method === 'PATCH' || req.method === 'PUT') &&
    /^\/users\/(me|[a-fA-F0-9]{24})\/?$/.test(req.path)
  );
}

/** Altas de venta / confirmación con fotos en data URL. */
function isTransactionMediaWrite(req: Request): boolean {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return false;
  }
  const pathOnly = (req.originalUrl || req.url || req.path || '').split('?')[0] ?? '';
  return (
    /\/transactions\/as-seller\/?$/.test(pathOnly) ||
    /\/transactions\/invite\/[^/]+\/(confirm-sale|accept-purchase)\/?$/.test(pathOnly)
  );
}

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: corsOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(compression());
  // Límite estricto global; chat permite base64 más grande solo en esa ruta.
  app.use((req, res, next) => {
    const limit =
      isChatMessageWrite(req) || isUserProfileWrite(req) || isTransactionMediaWrite(req)
        ? '8mb'
        : '256kb';
    express.json({ limit })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(cookieParser());

  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: morganStream,
      skip: (req) =>
        req.path === '/health' ||
        req.path.startsWith('/payments/webhooks') ||
        req.path.startsWith('/auth/'),
    }),
  );

  app.use(globalRateLimiter);

  if (env.NODE_ENV !== 'production') {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }

  app.use('/health', healthRoutes);
  app.use('/auth', authRoutes);
  app.use('/users', usersRoutes);
  app.use('/agents', agentsRoutes);
  app.use('/transactions', transactionsRoutes);
  app.use('/chats', chatsRoutes);
  app.use('/payments', paymentsRoutes);
  app.use('/wallet', walletRoutes);
  app.use('/audit', auditRoutes);
  app.use('/reviews', reviewsRoutes);
  app.use('/evidence', evidenceRoutes);
  app.use('/disputes', disputesRoutes);
  app.use('/notifications', notificationsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  logger.debug('Express app configured');

  return app;
}
