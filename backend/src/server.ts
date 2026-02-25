import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  // Connect to database before accepting requests
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

  function shutdown(signal: string): void {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection:', reason);
    process.exit(1);
  });
}

main().catch((error: unknown) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
