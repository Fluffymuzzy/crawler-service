import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';
import type { CrawlRequest } from '../validation';
import { IQueueService } from '../../interfaces/services/queue.service.interface';
import { IJobRepository } from '../../interfaces/repositories/job.repository.interface';
import { IJobItemRepository } from '../../interfaces/repositories/job-item.repository.interface';
import { ILogger } from '../../interfaces/external/logger.interface';
import { TYPES } from '../../container/types';

@injectable()
export class CrawlController {
  constructor(
    @inject(TYPES.QueueService) private queueService: IQueueService,
    @inject(TYPES.JobRepository) private jobRepo: IJobRepository,
    @inject(TYPES.JobItemRepository) private jobItemRepo: IJobItemRepository,
    @inject(TYPES.Logger) private logger: ILogger,
  ) {}

  createCrawlJob = async (
    req: Request<object, object, CrawlRequest>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { urls, priority } = req.body;

      // Remove duplicates
      const uniqueUrls = [...new Set(urls)];

      this.logger.info('Creating crawl job', { urlCount: uniqueUrls.length, priority });

      // Create job
      const job = await this.jobRepo.create({
        total: uniqueUrls.length,
        processed: 0,
        failed: 0,
        priority: priority ?? 'normal',
        status: 'queued',
      });

      // Create job items
      await this.jobItemRepo.bulkCreate(
        uniqueUrls.map((url) => ({
          jobId: job.id,
          url,
        })),
      );

      // Enqueue job
      await this.queueService.enqueueCrawlJob(job.id, uniqueUrls);

      this.logger.info('Crawl job created and queued', { jobId: job.id });

      res.status(201).json({
        jobId: job.id,
        queued: uniqueUrls.length,
      });
    } catch (error) {
      next(error);
    }
  };
}
