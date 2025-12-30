import { injectable, inject } from 'inversify';
import { IQueueService, CrawlJobData } from '../interfaces/services/queue.service.interface';
import { IMessageQueue } from '../interfaces/external/message-queue.interface';
import { ILogger } from '../interfaces/external/logger.interface';
import { TYPES } from '../container/types';
import { QUEUE_NAMES } from '../config/queue';

@injectable()
export class QueueService implements IQueueService {
  constructor(
    @inject(TYPES.MessageQueue) private messageQueue: IMessageQueue,
    @inject(TYPES.Logger) private logger: ILogger,
  ) {}

  async enqueueCrawlJob(jobId: string, urls: string[]): Promise<void> {
    const jobData: CrawlJobData = {
      jobId,
      profileIds: urls, // Renamed later for clarity
      timestamp: Date.now(),
    };

    await this.messageQueue.publish(QUEUE_NAMES.CRAWL, jobData);

    this.logger.info('Crawl job enqueued', { jobId, profileCount: urls.length });
  }
}
