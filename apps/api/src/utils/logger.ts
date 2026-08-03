import { env } from '../shared/config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'trace' | 'silent';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
  silent: 100,
};

function shouldLog(level: LogLevel): boolean {
  const configured = env.LOG_LEVEL as LogLevel;
  if (configured === 'silent') return false;
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[configured];
}

function write(level: Exclude<LogLevel, 'silent'>, message: string, meta?: unknown): void {
  if (!shouldLog(level)) return;

  const payload = {
    level,
    message,
    service: 'confiapp-api',
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    ...(meta !== undefined ? { meta } : {}),
  };

  const line = JSON.stringify(payload);

  if (level === 'error' || level === 'fatal') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.info(line);
}

/** Logger estructurado JSON (compatible con agregadores: Datadog, Loki, CloudWatch). */
export const logger = {
  trace: (message: string, meta?: unknown) => write('trace', message, meta),
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
  fatal: (message: string, meta?: unknown) => write('fatal', message, meta),
};

/** Stream para Morgan → mismo formato estructurado. */
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
