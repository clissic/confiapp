import mongoose, { type ConnectOptions } from 'mongoose';

import { env } from '../shared/config/env';
import { logger } from '../utils/logger';

export type MongoReadyState = 0 | 1 | 2 | 3;

export interface DatabaseConnectionOptions {
  uri?: string;
  /** Si true, aborta el proceso cuando no se puede conectar (producción). */
  exitOnFailure?: boolean;
}

const READY_STATE_LABEL: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let listenersAttached = false;
let isShuttingDown = false;

function maskMongoUri(uri: string): string {
  return uri.replace(/\/\/([^@/]+)@/, '//***:***@');
}

function buildConnectOptions(): ConnectOptions {
  const isProd = env.NODE_ENV === 'production';

  return {
    autoIndex: !isProd,
    autoCreate: !isProd,
    maxPoolSize: isProd ? 20 : 5,
    minPoolSize: isProd ? 2 : 0,
    serverSelectionTimeoutMS: isProd ? 15_000 : 10_000,
    socketTimeoutMS: 45_000,
    connectTimeoutMS: 10_000,
    heartbeatFrequencyMS: 10_000,
    retryWrites: true,
    retryReads: true,
  };
}

function attachConnectionListeners(): void {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;

  const { connection } = mongoose;

  connection.on('connecting', () => {
    logger.info('connecting…');
  });

  connection.on('connected', () => {
    logger.info('connected');
  });

  connection.on('open', () => {
    logger.info('connection open — ready for queries');
  });

  connection.on('reconnected', () => {
    logger.info('reconnected');
  });

  connection.on('disconnected', () => {
    if (!isShuttingDown) {
      logger.warn('disconnected — driver will attempt reconnection');
    }
  });

  connection.on('error', (error: Error) => {
    logger.error('connection error', {
      name: error.name,
      message: error.message,
    });
  });

  connection.on('fullsetup', () => {
    logger.info('replica set primary + secondaries reachable');
  });
}

function classifyMongoError(error: unknown): {
  code?: string | number;
  message: string;
  retryable: boolean;
} {
  if (!error || typeof error !== 'object') {
    return { message: String(error), retryable: false };
  }

  const err = error as {
    name?: string;
    message?: string;
    code?: string | number;
    codeName?: string;
  };

  const code = err.code ?? err.codeName;
  const message = err.message ?? err.name ?? 'Unknown MongoDB error';

  const retryableCodes = new Set([
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'MongoServerSelectionError',
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
  ]);

  const retryable =
    retryableCodes.has(String(err.name)) ||
    retryableCodes.has(String(code)) ||
    /server selection|network|timeout|ECONNREFUSED/i.test(message);

  return { code, message, retryable };
}

/**
 * Conexión MongoDB con logging, opciones por ambiente y listeners de reconexión.
 * El driver de Mongoose reintenta automáticamente tras `disconnected`.
 */
export async function connectDatabase(
  options: DatabaseConnectionOptions = {},
): Promise<typeof mongoose> {
  const uri = options.uri ?? env.DATABASE_URL;
  const exitOnFailure = options.exitOnFailure ?? env.NODE_ENV === 'production';

  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', true);

  if (env.NODE_ENV === 'development') {
    mongoose.set('debug', env.LOG_LEVEL === 'debug');
  }

  attachConnectionListeners();

  if (mongoose.connection.readyState === 1) {
    logger.info('already connected — reusing connection');
    return mongoose;
  }

  logger.info(`connecting to ${maskMongoUri(uri)} (${env.NODE_ENV})`);

  try {
    await mongoose.connect(uri, buildConnectOptions());
    logger.info(
      `ready — state=${READY_STATE_LABEL[mongoose.connection.readyState] ?? 'unknown'}`,
    );
    return mongoose;
  } catch (error) {
    const classified = classifyMongoError(error);
    logger.error('initial connection failed', classified);

    if (exitOnFailure) {
      throw error;
    }

    logger.warn(
      'continuing without DB (non-production). Queries will fail until Mongo is available.',
    );
    return mongoose;
  }
}

/** Cierre ordenado: espera operaciones pendientes y libera el pool. */
export async function disconnectDatabase(): Promise<void> {
  isShuttingDown = true;

  if (mongoose.connection.readyState === 0) {
    logger.info('already disconnected');
    return;
  }

  logger.info('closing connection…');
  await mongoose.connection.close(false);
  logger.info('connection closed cleanly');
}

export function getDatabaseReadyState(): MongoReadyState {
  return mongoose.connection.readyState as MongoReadyState;
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getDatabaseConnection() {
  return mongoose.connection;
}
