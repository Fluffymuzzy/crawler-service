import 'reflect-metadata';
import { container } from './container';
import { CrawlWorker } from './workers';
import type { ILogger } from './interfaces/external/logger.interface';
import type { IDatabase } from './interfaces/external/database.interface';
import type { IMessageQueue } from './interfaces/external/message-queue.interface';
import { TYPES } from './container/types';
import { closeCrawlQueue } from './queue/crawl.queue';
import { closeRedisConnection } from './queue/connection';

const logger = container.get<ILogger>(TYPES.Logger);
const database = container.get<IDatabase>(TYPES.Database);
const messageQueue = container.get<IMessageQueue>(TYPES.MessageQueue);
const worker = container.get(CrawlWorker);

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

    await messageQueue.close();
    logger.info('Message queue closed');

    await closeCrawlQueue();
    logger.info('Legacy queue closed');

    await closeRedisConnection();
    logger.info('Redis connection closed');

    await database.disconnect();
    logger.info('Database connection closed');

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

const startWorker = async (): Promise<void> => {
  try {
    logger.info('Connecting to database...');
    await database.connect();
    logger.info('Database connected');

    logger.info('Starting worker...');
    worker.start();
    logger.info('Worker started successfully');
  } catch (error) {
    logger.error('Failed to start worker', error as Error);
    process.exit(1);
  }
};

void startWorker();
