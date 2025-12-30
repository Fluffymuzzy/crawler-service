import type { JobItem, JobItemStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class JobItemRepository {
  async create(data: { jobId: string; url: string; status?: JobItemStatus }): Promise<JobItem> {
    return prisma.jobItem.create({
      data: {
        jobId: data.jobId,
        url: data.url,
        status: data.status ?? 'pending',
      },
    });
  }

  async createMany(
    items: Array<{
      jobId: string;
      url: string;
      status?: JobItemStatus;
    }>,
  ): Promise<Prisma.BatchPayload> {
    return prisma.jobItem.createMany({
      data: items.map((item) => ({
        jobId: item.jobId,
        url: item.url,
        status: item.status ?? 'pending',
      })),
      skipDuplicates: true,
    });
  }

  async findById(id: string): Promise<JobItem | null> {
    return prisma.jobItem.findUnique({
      where: { id },
    });
  }

  async findByJobId(jobId: string): Promise<JobItem[]> {
    return prisma.jobItem.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMany(params?: {
    where?: Prisma.JobItemWhereInput;
    orderBy?: Prisma.JobItemOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }): Promise<JobItem[]> {
    return prisma.jobItem.findMany(params);
  }

  async update(
    id: string,
    data: Partial<{
      status: JobItemStatus;
      error: string | null;
      attempts: number;
      lastStatusCode: number | null;
    }>,
  ): Promise<JobItem> {
    return prisma.jobItem.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<JobItem> {
    return prisma.jobItem.delete({
      where: { id },
    });
  }

  async deleteByJobId(jobId: string): Promise<Prisma.BatchPayload> {
    return prisma.jobItem.deleteMany({
      where: { jobId },
    });
  }

  async count(where?: Prisma.JobItemWhereInput): Promise<number> {
    return prisma.jobItem.count({ where });
  }
}
