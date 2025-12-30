import type { Job, JobStatus, JobItem, Prisma } from '@prisma/client';
import type { IRepository } from './base.repository';

export interface JobWithItems extends Job {
  items: JobItem[];
}

export interface IJobRepository extends IRepository<Job> {
  findByIdWithItems(id: string): Promise<JobWithItems | null>;
  updateStatus(id: string, status: JobStatus): Promise<Job>;
  updateProgress(id: string, processed: number, failed: number): Promise<Job>;
  findManyWithFilters(
    filters: {
      status?: JobStatus;
      createdAt?: { gte?: Date; lte?: Date };
    },
    options?: {
      take?: number;
      skip?: number;
      orderBy?: Prisma.JobOrderByWithRelationInput;
    },
  ): Promise<Job[]>;
  countWithFilters(filters: {
    status?: JobStatus;
    createdAt?: { gte?: Date; lte?: Date };
  }): Promise<number>;
}
