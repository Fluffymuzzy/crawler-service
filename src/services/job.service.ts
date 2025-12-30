import { injectable, inject } from 'inversify';
import type { Job, JobStatus } from '@prisma/client';
import {
  IJobService,
  CreateJobOptions,
  JobWithItems,
} from '../interfaces/services/job.service.interface';
import { IJobRepository } from '../interfaces/repositories/job.repository.interface';
import {
  IJobItemRepository,
  JobItemCreateData,
} from '../interfaces/repositories/job-item.repository.interface';
import { IProfileRepository } from '../interfaces/repositories/profile.repository.interface';
import { ILogger } from '../interfaces/external/logger.interface';
import { TYPES } from '../container/types';

@injectable()
export class JobService implements IJobService {
  constructor(
    @inject(TYPES.JobRepository) private jobRepo: IJobRepository,
    @inject(TYPES.JobItemRepository) private jobItemRepo: IJobItemRepository,
    @inject(TYPES.ProfileRepository) private profileRepo: IProfileRepository,
    @inject(TYPES.Logger) private logger: ILogger,
  ) {}

  async createJob(profileIds: string[], options?: CreateJobOptions): Promise<Job> {
    // Create job
    const job = await this.jobRepo.create({
      total: profileIds.length,
      processed: 0,
      failed: 0,
      priority: options?.priority ?? 'normal',
      status: 'queued',
    });

    // Create job items
    const profiles = await Promise.all(profileIds.map((id) => this.profileRepo.findById(id)));

    const jobItems: JobItemCreateData[] = profiles
      .filter((profile) => profile !== null)
      .map((profile) => ({
        jobId: job.id,
        url: profile.sourceUrl,
        status: 'pending' as const,
      }));

    await this.jobItemRepo.bulkCreate(jobItems);

    this.logger.info('Job created', { jobId: job.id, itemCount: jobItems.length });
    return job;
  }

  async getJobWithItems(jobId: string): Promise<JobWithItems> {
    this.logger.info('Finding job by ID with items', { jobId });
    const job = await this.jobRepo.findByIdWithItems(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    this.logger.info('Found job with items', { jobId, hasItems: !!job.items });
    return job;
  }

  async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    this.logger.info('Updating job status', { jobId, status });
    await this.jobRepo.updateStatus(jobId, status);
  }

  async calculateFinalJobStatus(jobId: string): Promise<JobStatus> {
    const items = await this.jobItemRepo.findByJobId(jobId);

    const okCount = items.filter((item) => item.status === 'ok').length;
    const blockedCount = items.filter((item) => item.status === 'blocked').length;
    const errorCount = items.filter((item) => item.status === 'error').length;
    const pendingCount = items.filter((item) => item.status === 'pending').length;

    this.logger.info('Calculating final job status', {
      jobId,
      total: items.length,
      ok: okCount,
      blocked: blockedCount,
      error: errorCount,
      pending: pendingCount,
    });

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

  async getJobs(filters?: {
    status?: JobStatus;
    page?: number;
    limit?: number;
  }): Promise<{ jobs: Job[]; total: number }> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause = filters?.status ? { status: filters.status } : {};

    const [jobs, total] = await Promise.all([
      this.jobRepo.findManyWithFilters(whereClause, {
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.jobRepo.countWithFilters(whereClause),
    ]);

    return { jobs, total };
  }
}
