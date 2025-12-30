import { injectable, inject } from 'inversify';
import { Job } from 'bullmq';
import { JobItem, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { IJobService } from '../interfaces/services/job.service.interface';
import { IProfileService } from '../interfaces/services/profile.service.interface';
import { ILogger } from '../interfaces/external/logger.interface';
import { IDatabase } from '../interfaces/external/database.interface';
import { TYPES } from '../container/types';
import { JobProcessor, ProcessingResult } from './processors/job.processor';
import { RetryManager } from './processors/retry.manager';
import { JobStatusCalculator } from './processors/job-status.calculator';
import { IParser } from '../interfaces/parser.interface';
import { IFetcher } from '../interfaces/fetcher.interface';

export interface CrawlJobData {
  jobId: string;
}

@injectable()
export class CrawlOrchestrator {
  constructor(
    @inject(TYPES.JobService) private jobService: IJobService,
    @inject(TYPES.ProfileService) private profileService: IProfileService,
    @inject(TYPES.JobProcessor) private jobProcessor: JobProcessor,
    @inject(TYPES.RetryManager) private retryManager: RetryManager,
    @inject(TYPES.JobStatusCalculator) private statusCalculator: JobStatusCalculator,
    @inject(TYPES.Database) private database: IDatabase,
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.ParserRegistry)
    private parserRegistry: { getParser: (url: string) => IParser | null },
    @inject(TYPES.FetcherRegistry)
    private fetcherRegistry: { getFetcher: (url: string) => IFetcher | null },
  ) {}

  async orchestrate(job: Job<CrawlJobData>): Promise<void> {
    const { jobId } = job.data;
    this.logger.debug('Orchestrate method called', { jobId, jobData: job.data });

    try {
      this.logger.debug('Connecting to database', { jobId });
      await this.database.connect();
      this.logger.debug('Connected to database', { jobId });

      this.logger.info('Starting crawl orchestration', { jobId });

      // Update job status to running
      this.logger.debug('Updating job status to running', { jobId });
      await this.jobService.updateJobStatus(jobId, 'running');
      this.logger.debug('Updated job status to running', { jobId });

      // Process the job
      this.logger.debug('Starting job processing', { jobId });
      await this.jobProcessor.processJob(jobId, async (item) => {
        return await this.processSingleItem(item);
      });
      this.logger.debug('Finished processing job', { jobId });

      // Calculate final status
      const jobData = await this.jobService.getJobWithItems(jobId);
      const finalStatus = this.statusCalculator.calculateStatus(jobData.items);

      // Update final job status
      await this.jobService.updateJobStatus(jobId, finalStatus);

      const counts = this.statusCalculator.getStatusCounts(jobData.items);
      this.logger.info('Crawl orchestration completed', {
        jobId,
        finalStatus,
        ...counts,
      });
    } catch (error) {
      this.logger.error('Orchestration failed', { jobId, error });
      await this.jobService.updateJobStatus(jobId, 'failed');
      throw error;
    } finally {
      await this.database.disconnect();
    }
  }

  private async processSingleItem(item: JobItem): Promise<ProcessingResult> {
    const { id: itemId, url } = item;

    try {
      // Execute with retry
      await this.retryManager.executeWithRetry(
        async () => {
          // Get appropriate fetcher
          this.logger.debug('Looking for fetcher', { url, itemId });
          const fetcher = this.fetcherRegistry.getFetcher(url);
          this.logger.debug('Found fetcher', {
            url,
            itemId,
            fetcherName: fetcher?.constructor.name || 'NONE',
          });
          if (!fetcher) {
            throw new Error('No fetcher available for URL');
          }

          // Fetch content
          this.logger.debug('Starting fetch', { url, itemId });
          const fetchResult = await fetcher.fetch(url);
          this.logger.info('Fetch completed', {
            url,
            itemId,
            htmlLength: fetchResult.html.length,
            finalUrl: fetchResult.finalUrl,
            htmlPreview: fetchResult.html.substring(0, 100)
          });

          // Get appropriate parser
          this.logger.debug('Looking for parser', { url, itemId });
          const parser = this.parserRegistry.getParser(url);
          this.logger.debug('Found parser', {
            url,
            itemId,
            parserName: parser?.name || 'NONE',
          });
          if (!parser) {
            throw new Error('No parser available for URL');
          }

          // Parse content
          this.logger.debug('Starting parse', {
            url,
            itemId,
            parserName: parser.name,
            htmlLength: fetchResult.html.length,
          });
          const parsed = parser.parse(fetchResult.html, fetchResult.finalUrl);
          this.logger.debug('Parse result', {
            url,
            itemId,
            success: !!parsed,
          });
          if (!parsed) {
            throw new Error('Failed to parse profile');
          }

          const checksum = this.calculateChecksum(fetchResult.html);
          this.logger.info('Parsed profile data', {
            url,
            itemId,
            username: parsed.username,
            displayName: parsed.displayName,
            bio: parsed.bio,
            avatarUrl: parsed.avatarUrl,
            htmlLength: fetchResult.html.length,
            checksum: checksum.substring(0, 8)
          });

          // Save profile
          await this.profileService.saveOrUpdateProfile({
            sourceUrl: fetchResult.finalUrl,
            username: parsed.username || null,
            displayName: parsed.displayName || null,
            bio: parsed.bio || null,
            avatarUrl: parsed.avatarUrl || null,
            coverUrl: parsed.coverUrl || null,
            publicStats: parsed.publicStats ? (parsed.publicStats as Prisma.JsonValue) : null,
            links: parsed.links ? (parsed.links as Prisma.JsonValue) : null,
            scrapedAt: new Date(),
            rawHtmlChecksum: checksum,
          });
        },
        {
          maxAttempts: 3,
          delayMs: 1000,
          shouldRetry: (error) => {
            // Don't retry on parser/content errors
            return !error.message.includes('parse') && !error.message.includes('No parser');
          },
        },
      );

      return {
        itemId,
        url,
        success: true,
        status: 'ok',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Determine if it's a block or regular error
      const isBlocked =
        errorMessage.includes('403') ||
        errorMessage.includes('blocked') ||
        errorMessage.includes('captcha');

      return {
        itemId,
        url,
        success: false,
        status: isBlocked ? 'blocked' : 'error',
        error: errorMessage,
      };
    }
  }

  private calculateChecksum(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }
}
