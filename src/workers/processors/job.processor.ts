import { injectable, inject } from 'inversify';
import { JobItem, JobItemStatus } from '@prisma/client';
import { IJobService } from '../../interfaces/services/job.service.interface';
import { IJobItemRepository } from '../../interfaces/repositories/job-item.repository.interface';
import { ILogger } from '../../interfaces/external/logger.interface';
import { TYPES } from '../../container/types';

export interface ProcessingResult {
  itemId: string;
  url: string;
  success: boolean;
  status: JobItemStatus;
  error?: string;
}

export interface ItemProcessor {
  (item: JobItem): Promise<ProcessingResult>;
}

@injectable()
export class JobProcessor {
  constructor(
    @inject(TYPES.JobService) private jobService: IJobService,
    @inject(TYPES.JobItemRepository) private jobItemRepo: IJobItemRepository,
    @inject(TYPES.Logger) private logger: ILogger,
  ) {}

  async processJob(jobId: string, itemProcessor: ItemProcessor): Promise<ProcessingResult[]> {
    this.logger.info('Getting job with items', { jobId });
    const job = await this.jobService.getJobWithItems(jobId);
    this.logger.info('Retrieved job with items', { jobId, itemCount: job.items.length });
    const pendingItems = job.items.filter((item: JobItem) => item.status === 'pending');

    this.logger.info('Starting job processing', {
      jobId,
      totalItems: job.items.length,
      pendingItems: pendingItems.length,
    });

    const results: ProcessingResult[] = [];
    let processedCount = 0;
    let failedCount = 0;

    for (const item of pendingItems) {
      try {
        this.logger.info('Processing item', { itemId: item.id, url: item.url });
        const result = await itemProcessor(item);
        this.logger.info('Item processed', { itemId: item.id, success: result.success });
        results.push(result);

        await this.jobItemRepo.updateStatus(item.id, result.status, result.error);

        if (result.success) {
          processedCount++;
        } else {
          failedCount++;
        }

        // Update job progress periodically
        if ((processedCount + failedCount) % 10 === 0) {
          await this.jobService.updateJobStatus(jobId, 'running');
        }
      } catch (error) {
        this.logger.error('Error processing item', { itemId: item.id, error });

        const errorResult: ProcessingResult = {
          itemId: item.id,
          url: item.url,
          success: false,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        results.push(errorResult);
        failedCount++;

        await this.jobItemRepo.updateStatus(item.id, 'error', errorResult.error);
      }
    }

    this.logger.info('Job processing completed', {
      jobId,
      processed: processedCount,
      failed: failedCount,
      total: results.length,
    });

    return results;
  }
}
