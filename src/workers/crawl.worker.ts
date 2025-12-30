import { injectable, inject } from 'inversify';
import { Worker, type Job } from 'bullmq';
import { ILogger } from '../interfaces/external/logger.interface';
import { TYPES } from '../container/types';
import { getRedisConnection } from '../queue/connection';
import { QUEUE_NAMES } from '../config/queue';
import { config } from '../config';
import { CrawlOrchestrator, CrawlJobData } from './crawl.orchestrator';

@injectable()
export class CrawlWorker {
  private worker: Worker<CrawlJobData> | null = null;

  constructor(
    @inject(TYPES.CrawlOrchestrator) private orchestrator: CrawlOrchestrator,
    @inject(TYPES.Logger) private logger: ILogger,
  ) {}

  start(): void {
    this.worker = new Worker<CrawlJobData>(QUEUE_NAMES.CRAWL, async (job) => this.processJob(job), {
      connection: getRedisConnection(),
      concurrency: config.queue.concurrency,
    });

    this.worker.on('ready', () => {
      this.logger.info('Crawl worker started', { concurrency: config.queue.concurrency });
    });

    this.worker.on('error', (err) => {
      this.logger.error('Worker error', err);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error('Job failed', {
        jobId: job?.id,
        jobData: job?.data,
        error: err,
      });
    });
  }

  private async processJob(job: Job<CrawlJobData>): Promise<void> {
    const { jobId } = job.data;

    this.logger.info('Starting job processing', { jobId, bullJobId: job.id });

    try {
      await this.orchestrator.orchestrate(job);
      this.logger.info('Job processing completed successfully', { jobId });
    } catch (error) {
      this.logger.error('Job processing failed', { jobId, error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.logger.info('Crawl worker stopped');
    }
  }
}
