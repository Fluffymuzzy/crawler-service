import { Queue } from 'bullmq';
import { getRedisConnection } from './connection';
import { QUEUE_NAMES } from '../config/queue';
import { logger } from '../utils/logger';

let crawlQueue: Queue<CrawlJobData> | null = null;

export interface CrawlJobData {
  jobId: string;
  profileIds: string[];
  timestamp: number;
}

export const getCrawlQueue = (): Queue<CrawlJobData> => {
  if (!crawlQueue) {
    crawlQueue = new Queue<CrawlJobData>(QUEUE_NAMES.CRAWL, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    logger.info({ queueName: QUEUE_NAMES.CRAWL }, 'Crawl queue initialized');
  }

  return crawlQueue;
};

export const closeCrawlQueue = async (): Promise<void> => {
  if (crawlQueue) {
    await crawlQueue.close();
    crawlQueue = null;
    logger.info('Crawl queue closed');
  }
};
