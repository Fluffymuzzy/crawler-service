import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let connection: Redis | null = null;

export const getRedisConnection = (): Redis => {
  if (!connection) {
    connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    connection.on('connect', () => {
      logger.info('Connected to Redis');
    });

    connection.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });
  }

  return connection;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (connection) {
    await connection.quit();
    connection = null;
    logger.info('Redis connection closed');
  }
};
