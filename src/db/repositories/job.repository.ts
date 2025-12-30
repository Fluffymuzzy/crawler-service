import type { Job, JobStatus, JobPriority, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class JobRepository {
  async create(data: { total: number; priority?: JobPriority; status?: JobStatus }): Promise<Job> {
    return prisma.job.create({
      data: {
        total: data.total,
        priority: data.priority ?? 'normal',
        status: data.status ?? 'queued',
      },
    });
  }

  async findById(id: string): Promise<Job | null> {
    return prisma.job.findUnique({
      where: { id },
    });
  }

  async findMany(params?: {
    where?: Prisma.JobWhereInput;
    orderBy?: Prisma.JobOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }): Promise<Job[]> {
    return prisma.job.findMany(params);
  }

  async update(
    id: string,
    data: Partial<{
      status: JobStatus;
      processed: number;
      failed: number;
    }>,
  ): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: JobStatus): Promise<Job> {
    return this.update(id, { status });
  }

  async updateProgress(id: string, processed: number, failed: number): Promise<Job> {
    return this.update(id, { processed, failed });
  }

  async delete(id: string): Promise<Job> {
    return prisma.job.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.JobWhereInput): Promise<number> {
    return prisma.job.count({ where });
  }
}
