import 'reflect-metadata';
import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';
import { container } from './container';
import type { ILogger } from './interfaces/external/logger.interface';
import type { IDatabase } from './interfaces/external/database.interface';
import type { IMessageQueue } from './interfaces/external/message-queue.interface';
import { TYPES } from './container/types';
import { closeCrawlQueue } from './queue/crawl.queue';
import { closeRedisConnection } from './queue/connection';

const logger = container.get<ILogger>(TYPES.Logger);
const database = container.get<IDatabase>(TYPES.Database);
const messageQueue = container.get<IMessageQueue>(TYPES.MessageQueue);

const app = createApp(container);
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
      logger.error('Error during server shutdown', err);
      process.exit(1);
    }
    logger.info('HTTP server closed');

    void (async (): Promise<void> => {
      try {
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
        logger.error('Error during cleanup', error as Error);
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

// Initialize database before starting server
void (async (): Promise<void> => {
  try {
    await database.connect();
    logger.info('Database connected');

    server.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
})();
