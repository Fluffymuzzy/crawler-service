import type { Job, JobStatus, JobItem } from '@prisma/client';
import { JobRepository, JobItemRepository } from '../db/repositories';
import { logger } from '../utils/logger';

export class JobService {
  private jobRepo: JobRepository;
  private jobItemRepo: JobItemRepository;

  constructor() {
    this.jobRepo = new JobRepository();
    this.jobItemRepo = new JobItemRepository();
  }

  async getJobWithItems(jobId: string): Promise<(Job & { items: JobItem[] }) | null> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      return null;
    }

    const items = await this.jobItemRepo.findByJobId(jobId);
    return { ...job, items };
  }

  async updateJobStatus(jobId: string, status: JobStatus): Promise<Job> {
    logger.info({ jobId, status }, 'Updating job status');
    return this.jobRepo.update(jobId, { status });
  }

  async updateJobProgress(jobId: string, processed: number, failed: number): Promise<Job> {
    return this.jobRepo.update(jobId, { processed, failed });
  }

  async calculateFinalJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const items = await this.jobItemRepo.findByJobId(jobId);

    const okCount = items.filter((item) => item.status === 'ok').length;
    const blockedCount = items.filter((item) => item.status === 'blocked').length;
    const errorCount = items.filter((item) => item.status === 'error').length;
    const pendingCount = items.filter((item) => item.status === 'pending').length;

    logger.info(
      {
        jobId,
        total: items.length,
        ok: okCount,
        blocked: blockedCount,
        error: errorCount,
        pending: pendingCount,
      },
      'Calculating final job status',
    );

    if (pendingCount > 0) {
      return 'running';
    }

    // All items processed successfully
    if (okCount === items.length) {
      return 'done';
    }

    // All items failed (error or blocked)
    if (errorCount + blockedCount === items.length) {
      return 'failed';
    }

    // Mixed results (some ok, some error/blocked)
    return 'partial';
  }
}
