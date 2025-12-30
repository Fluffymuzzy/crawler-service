import { Worker, type Job } from 'bullmq';
import type { CrawlJobData } from '../queue/crawl.queue';
import { getRedisConnection } from '../queue/connection';
import { QUEUE_NAMES } from '../config/queue';
import { config } from '../config';
import { logger } from '../utils/logger';
import { JobService, ProfileService } from '../services';
import { JobItemRepository } from '../db/repositories';
import { prismaService } from '../db/prisma';
import { fetchPage, parsePublicProfile, shouldUsePlaywright, fetchWithPlaywright } from '../parser';
import type { JobItemData, ItemProcessingResult, ProcessingResult } from '../types/worker';

export class CrawlWorker {
  private worker: Worker<CrawlJobData> | null = null;
  private jobService: JobService;
  private jobItemRepo: JobItemRepository;
  private profileService: ProfileService;

  constructor() {
    this.jobService = new JobService();
    this.jobItemRepo = new JobItemRepository();
    this.profileService = new ProfileService();
  }

  start(): void {
    this.worker = new Worker<CrawlJobData>(QUEUE_NAMES.CRAWL, async (job) => this.processJob(job), {
      connection: getRedisConnection(),
      concurrency: config.queue.concurrency,
    });

    this.worker.on('ready', () => {
      logger.info({ concurrency: config.queue.concurrency }, 'Crawl worker started');
    });

    this.worker.on('error', (err) => {
      logger.error({ err }, 'Worker error');
    });

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, jobData: job?.data, err }, 'Job failed');
    });
  }

  private async processJob(job: Job<CrawlJobData>): Promise<void> {
    const { jobId } = job.data;
    logger.info({ jobId, bullJobId: job.id }, 'Starting job processing');

    try {
      await prismaService.connect();

      const jobData = await this.jobService.getJobWithItems(jobId);
      if (!jobData) {
        throw new Error(`Job ${jobId} not found`);
      }

      await this.jobService.updateJobStatus(jobId, 'running');

      const pendingItems = jobData.items.filter((item) => item.status === 'pending');

      let processed = jobData.processed;
      let failed = jobData.failed;

      for (const item of pendingItems) {
        logger.info({ jobId, itemId: item.id, url: item.url }, 'Processing job item');

        try {
          const result = await this.processSingleItemWithRetries(item);

          await this.jobItemRepo.update(item.id, {
            status: result.finalStatus,
            error: result.error || null,
            attempts: result.totalAttempts,
            lastStatusCode: result.statusCode || null,
          });

          if (result.finalStatus === 'ok') {
            processed++;
          } else {
            failed++;
          }

          logger.info(
            {
              jobId,
              itemId: item.id,
              url: item.url,
              finalStatus: result.finalStatus,
              statusCode: result.statusCode,
              attempts: result.totalAttempts,
            },
            'Job item processed',
          );
        } catch (error) {
          logger.error(
            { jobId, itemId: item.id, url: item.url, error },
            'Failed to process job item',
          );

          await this.jobItemRepo.update(item.id, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            attempts: item.attempts + 1,
          });

          failed++;
        }

        await this.jobService.updateJobProgress(jobId, processed, failed);
      }

      const finalStatus = await this.jobService.calculateFinalJobStatus(jobId);
      await this.jobService.updateJobStatus(jobId, finalStatus);

      logger.info({ jobId, finalStatus, processed, failed }, 'Job processing completed');
    } catch (error) {
      logger.error({ jobId, error }, 'Job processing failed');
      await this.jobService.updateJobStatus(jobId, 'failed');
      throw error;
    }
  }

  private async processSingleItemWithRetries(item: JobItemData): Promise<ItemProcessingResult> {
    const MAX_ATTEMPTS = 3;
    const url = item.url;
    let totalAttempts = item.attempts;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      totalAttempts++;

      logger.info({ url, attempt, maxAttempts: MAX_ATTEMPTS }, 'Processing item attempt');

      try {
        const result = await this.processSingleItem(url);

        // Check if blocked (403) - no retry
        if (result.statusCode === 403) {
          logger.warn({ url, attempt, statusCode: 403 }, 'Item blocked by website - no retry');
          return {
            finalStatus: 'blocked',
            statusCode: 403,
            error: result.error,
            totalAttempts,
          };
        }

        // Success
        if (result.success) {
          return {
            finalStatus: 'ok',
            statusCode: result.statusCode,
            totalAttempts,
          };
        }

        // Check if should retry
        const shouldRetry = this.shouldRetryStatusCode(result.statusCode) && attempt < MAX_ATTEMPTS;

        if (!shouldRetry) {
          logger.error(
            { url, attempt, statusCode: result.statusCode, shouldRetry },
            'Item processing failed - no more retries',
          );
          return {
            finalStatus: 'error',
            statusCode: result.statusCode,
            error: result.error,
            totalAttempts,
          };
        }

        // Wait before retry with exponential backoff
        const delay = 500 * Math.pow(2, attempt - 1);
        logger.warn(
          { url, attempt, statusCode: result.statusCode, delayMs: delay },
          'Item processing failed - retrying with backoff',
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        logger.error(
          { url, attempt, error: error instanceof Error ? error.message : 'Unknown error' },
          'Item processing attempt failed',
        );

        if (attempt === MAX_ATTEMPTS) {
          return {
            finalStatus: 'error',
            statusCode: 0,
            error: error instanceof Error ? error.message : 'Processing error',
            totalAttempts,
          };
        }

        // Wait before retry
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return {
      finalStatus: 'error',
      statusCode: 0,
      error: 'Max attempts exceeded',
      totalAttempts,
    };
  }

  private shouldRetryStatusCode(statusCode?: number): boolean {
    if (!statusCode) return true; // Retry network errors

    // Retry 429 and 5xx
    if (statusCode === 429 || statusCode >= 500) {
      return true;
    }

    return false;
  }

  private async processSingleItem(url: string): Promise<ProcessingResult> {
    try {
      const fetchResult = await fetchPage(url);

      if (fetchResult.statusCode === 403) {
        return {
          success: false,
          statusCode: 403,
          error: 'Blocked by website',
        };
      }

      if (fetchResult.statusCode !== 200 || !fetchResult.html) {
        return {
          success: false,
          statusCode: fetchResult.statusCode,
          error: `HTTP ${fetchResult.statusCode}`,
        };
      }

      let parsed = parsePublicProfile(fetchResult.html, fetchResult.finalUrl);

      // Check if we need Playwright fallback
      if (shouldUsePlaywright(fetchResult, parsed)) {
        logger.info({ url }, 'Playwright fallback triggered');

        const playwrightResult = await fetchWithPlaywright(fetchResult.finalUrl);

        if (playwrightResult.statusCode === 403) {
          return {
            success: false,
            statusCode: 403,
            error: 'Blocked by website (Playwright)',
          };
        }

        if (playwrightResult.statusCode === 200 && playwrightResult.html) {
          // Re-parse with JS-rendered HTML
          parsed = parsePublicProfile(playwrightResult.html, fetchResult.finalUrl);
          logger.info(
            { url, htmlSize: playwrightResult.html.length },
            'Re-parsed after Playwright render',
          );
        } else {
          logger.warn({ url, statusCode: playwrightResult.statusCode }, 'Playwright fetch failed');
        }
      }

      await this.profileService.saveOrUpdateProfile(parsed);

      return {
        success: true,
        statusCode: 200,
      };
    } catch (error) {
      logger.error({ url, error }, 'Error processing item');
      return {
        success: false,
        statusCode: 0,
        error: error instanceof Error ? error.message : 'Processing error',
      };
    }
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('Crawl worker stopped');
    }
  }
}
