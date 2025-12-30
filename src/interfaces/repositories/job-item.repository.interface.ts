import type { JobItem, JobItemStatus } from '@prisma/client';
import type { IRepository } from './base.repository';

export interface JobItemCreateData {
  jobId: string;
  url: string;
  status?: JobItemStatus;
}

export interface IJobItemRepository extends IRepository<JobItem> {
  findByJobId(jobId: string): Promise<JobItem[]>;
  findPendingByJobId(jobId: string): Promise<JobItem[]>;
  updateStatus(id: string, status: JobItemStatus, error?: string | null): Promise<JobItem>;
  updateAttempts(id: string, attempts: number, lastStatusCode?: number | null): Promise<JobItem>;
  bulkCreate(items: JobItemCreateData[]): Promise<{ count: number }>;
  createMany(items: JobItemCreateData[]): Promise<{ count: number }>;
  countByJobIdAndStatus(jobId: string, status: JobItemStatus): Promise<number>;
}
