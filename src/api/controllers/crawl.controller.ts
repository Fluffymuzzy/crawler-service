import type { Request, Response, NextFunction } from 'express';
import type { CrawlRequest } from '../validation';
import { QueueService } from '../../services';
import { JobRepository, JobItemRepository } from '../../db/repositories';
import { logger } from '../../utils/logger';

export class CrawlController {
  private queueService: QueueService;
  private jobRepo: JobRepository;
  private jobItemRepo: JobItemRepository;

  constructor() {
    this.queueService = new QueueService();
    this.jobRepo = new JobRepository();
    this.jobItemRepo = new JobItemRepository();
  }

  createCrawlJob = async (
    req: Request<object, object, CrawlRequest>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { urls, priority } = req.body;

      // Remove duplicates
      const uniqueUrls = [...new Set(urls)];

      logger.info({ urlCount: uniqueUrls.length, priority }, 'Creating crawl job');

      // Create job
      const job = await this.jobRepo.create({
        total: uniqueUrls.length,
        priority,
        status: 'queued',
      });

      // Create job items
      await this.jobItemRepo.createMany(
        uniqueUrls.map((url) => ({
          jobId: job.id,
          url,
        })),
      );

      // Enqueue job
      await this.queueService.enqueueCrawlJob(job.id);

      logger.info({ jobId: job.id }, 'Crawl job created and queued');

      res.status(201).json({
        jobId: job.id,
        queued: uniqueUrls.length,
      });
    } catch (error) {
      next(error);
    }
  };
}
