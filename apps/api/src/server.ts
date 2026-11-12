// Sentry debe inicializarse antes que Express y el resto de los módulos.
import './instrument';

import type { Server } from 'node:http';

import { createApp } from './app';
import { DatabaseModule } from './database';
import { realtimeServer } from './infrastructure/realtime/socket-realtime.server';
import { AgentAssignmentService } from './modules/agents/assignment.service';
import { env } from './shared/config/env';
import { withJobLock } from './shared/jobs/with-job-lock';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  await DatabaseModule.connect({
    uri: env.DATABASE_URL,
    exitOnFailure: env.NODE_ENV === 'production',
  });

  if (DatabaseModule.isReady()) {
    const { ensureBootstrapAdmin } = await import('./modules/auth/bootstrap-admin');
    await ensureBootstrapAdmin().catch((error) => {
      logger.error('bootstrap admin failed', error);
    });
  }

  const app = createApp();

  const server: Server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`listening on http://localhost:${env.PORT}`);
    logger.info(`swagger at http://localhost:${env.PORT}/docs`);
    logger.info(
      `payments checkoutMode=${env.PAYMENTS_CHECKOUT_MODE} mpToken=${env.MERCADOPAGO_ACCESS_TOKEN?.trim() ? 'set' : 'empty'}`,
    );
    logger.info('database status', {
      readyState: DatabaseModule.getReadyState(),
      connected: DatabaseModule.isReady(),
    });
  });

  await realtimeServer.start(server);

  const timers: NodeJS.Timeout[] = [];

  if (env.RUN_CRONS) {
    logger.info('RUN_CRONS=true — starting in-process job timers');
    const assignmentService = new AgentAssignmentService();
    const expireTimer = setInterval(() => {
      void withJobLock('cron:expire-offers', 14_000, () =>
        assignmentService.expireDueOffers(),
      ).catch((error) => {
        logger.error('expire agent offers failed', error);
      });
    }, 15_000);
    expireTimer.unref();
    timers.push(expireTimer);

    const { TransactionsService } = await import('./modules/transactions/service');
    const transactionsService = new TransactionsService();
    const deadlineTimer = setInterval(() => {
      void withJobLock('cron:expire-deadlines', 10 * 60_000, () =>
        transactionsService.expireOperationalDeadlines(),
      ).catch((error) => {
        logger.error('operation deadline reminders failed', error);
      });
    }, 60 * 60_000);
    deadlineTimer.unref();
    timers.push(deadlineTimer);

    const autoDeliveryTimer = setInterval(() => {
      void withJobLock('cron:auto-delivery', 10 * 60_000, () =>
        transactionsService.autoCompleteStaleDeliveries(50),
      ).catch((error) => {
        logger.error('auto complete stale deliveries failed', error);
      });
    }, 15 * 60_000);
    autoDeliveryTimer.unref();
    timers.push(autoDeliveryTimer);

    const { agentCommissionService } = await import('./modules/finance/commission.service');
    const commissionTimer = setInterval(() => {
      void withJobLock('cron:release-commissions', 10 * 60_000, () =>
        agentCommissionService.releaseDue(),
      ).catch((error) => {
        logger.error('release agent commissions failed', error);
      });
    }, 15 * 60_000);
    commissionTimer.unref();
    timers.push(commissionTimer);
  } else {
    logger.info('RUN_CRONS=false — in-process job timers disabled');
  }

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — graceful shutdown`);
    for (const timer of timers) clearInterval(timer);

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
