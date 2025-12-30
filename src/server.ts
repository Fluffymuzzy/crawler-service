import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { createApp } from './app';
import { prismaService } from './db/prisma';
import { closeCrawlQueue } from './queue/crawl.queue';
import { closeRedisConnection } from './queue/connection';

const app = createApp();
const server = createServer(app);

let isShuttingDown = false;

const gracefulShutdown = (signal: string): void => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during server shutdown');
      process.exit(1);
    }
    logger.info('HTTP server closed');

    void (async (): Promise<void> => {
      try {
        await closeCrawlQueue();
        logger.info('Queue closed');

        await closeRedisConnection();
        logger.info('Redis connection closed');

        await prismaService.disconnect();
        logger.info('Database connection closed');

        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during cleanup');
        process.exit(1);
      }
    })();
  });

  setTimeout(() => {
    logger.error('Forcefully shutting down after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(config.port, () => {
  logger.info({ port: config.port }, 'Server started');
});
