import type { Job, JobStatus, JobItem } from '@prisma/client';

export interface CreateJobOptions {
  priority?: 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

export interface JobWithItems extends Job {
  items: JobItem[];
}

export interface IJobService {
  createJob(profileIds: string[], options?: CreateJobOptions): Promise<Job>;
  updateJobStatus(jobId: string, status: JobStatus): Promise<void>;
  calculateFinalJobStatus(jobId: string): Promise<JobStatus>;
  getJobWithItems(jobId: string): Promise<JobWithItems>;
  getJobs(filters?: {
    status?: JobStatus;
    page?: number;
    limit?: number;
  }): Promise<{ jobs: Job[]; total: number }>;
}
