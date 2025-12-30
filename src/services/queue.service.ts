import { getCrawlQueue } from '../queue/crawl.queue';
import { JOB_NAMES } from '../config/queue';
import { logger } from '../utils/logger';

export class QueueService {
  async enqueueCrawlJob(jobId: string): Promise<void> {
    const queue = getCrawlQueue();

    await queue.add(
      JOB_NAMES.PROCESS_CRAWL,
      { jobId },
      {
        priority: 0,
      },
    );

    logger.info({ jobId }, 'Crawl job enqueued');
  }
}
