import { env } from './config/env';
import { app } from './app';
import { prisma } from './prisma/client';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Server started');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void prisma.$disconnect().finally(() => {
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  logger.error({ message: error instanceof Error ? error.message : 'Unknown startup error' }, 'Failed to start server');
  process.exit(1);
});
