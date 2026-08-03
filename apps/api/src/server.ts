import type { Server } from 'node:http';

import { createApp } from './app';
import { DatabaseModule } from './database';
import { realtimeServer } from './infrastructure/realtime/socket-realtime.server';
import { AgentAssignmentService } from './modules/agents/assignment.service';
import { env } from './shared/config/env';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  await DatabaseModule.connect({
    uri: env.DATABASE_URL,
    exitOnFailure: env.NODE_ENV === 'production',
  });

  const app = createApp();

  const server: Server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`listening on http://localhost:${env.PORT}`);
    logger.info(`swagger at http://localhost:${env.PORT}/docs`);
    logger.info('database status', {
      readyState: DatabaseModule.getReadyState(),
      connected: DatabaseModule.isReady(),
    });
  });

  await realtimeServer.start(server);

  const assignmentService = new AgentAssignmentService();
  const expireTimer = setInterval(() => {
    void assignmentService.expireDueOffers().catch((error) => {
      logger.error('expire agent offers failed', error);
    });
  }, 15_000);
  expireTimer.unref();

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — graceful shutdown`);
    clearInterval(expireTimer);

    void (async () => {
      try {
        await realtimeServer.stop();
      } catch (error) {
        logger.error('error stopping realtime', error);
      }

      server.close((closeError) => {
        void (async () => {
          if (closeError) {
            logger.error('error closing HTTP server', closeError);
          }

          try {
            await DatabaseModule.disconnect();
            process.exit(closeError ? 1 : 0);
          } catch (error) {
            logger.error('error disconnecting database', error);
            process.exit(1);
          }
        })();
      });
    })();

    setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

void bootstrap();
