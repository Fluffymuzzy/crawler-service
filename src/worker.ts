import { logger } from './utils/logger';
import { CrawlWorker } from './workers';
import { prismaService } from './db/prisma';
import { closeRedisConnection } from './queue/connection';
import { closeCrawlQueue } from './queue/crawl.queue';

const worker = new CrawlWorker();
let isShuttingDown = false;

const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    await worker.stop();
    logger.info('Worker stopped');

    await closeCrawlQueue();
    logger.info('Queue closed');

    await closeRedisConnection();
    logger.info('Redis connection closed');

    await prismaService.disconnect();
    logger.info('Database connection closed');

    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

const startWorker = (): void => {
  try {
    logger.info('Starting worker...');
    worker.start();
  } catch (error) {
    logger.error({ error }, 'Failed to start worker');
    process.exit(1);
  }
};

startWorker();
