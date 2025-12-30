import { injectable, inject } from 'inversify';
import type { JobItem, JobItemStatus } from '@prisma/client';
import {
  IJobItemRepository,
  JobItemCreateData,
} from '../../interfaces/repositories/job-item.repository.interface';
import { IDatabase } from '../../interfaces/external/database.interface';
import { TYPES } from '../../container/types';
import { PrismaDatabase } from '../prisma-database';

@injectable()
export class JobItemRepository implements IJobItemRepository {
  private prisma: PrismaDatabase;

  constructor(@inject(TYPES.Database) database: IDatabase) {
    this.prisma = database as PrismaDatabase;
  }

  async create(data: Omit<JobItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobItem> {
    return this.prisma.jobItem.create({
      data: {
        jobId: data.jobId,
        url: data.url,
        status: data.status ?? 'pending',
        error: data.error ?? null,
        attempts: data.attempts ?? 0,
        lastStatusCode: data.lastStatusCode ?? null,
      },
    });
  }

  async bulkCreate(items: JobItemCreateData[]): Promise<{ count: number }> {
    const result = await this.prisma.jobItem.createMany({
      data: items.map((item) => ({
        jobId: item.jobId,
        url: item.url,
        status: item.status ?? 'pending',
      })),
      skipDuplicates: true,
    });
    return { count: result.count };
  }

  async createMany(items: JobItemCreateData[]): Promise<{ count: number }> {
    return this.bulkCreate(items);
  }

  async findById(id: string): Promise<JobItem | null> {
    return this.prisma.jobItem.findUnique({
      where: { id },
    });
  }

  async findByJobId(jobId: string): Promise<JobItem[]> {
    return this.prisma.jobItem.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findPendingByJobId(jobId: string): Promise<JobItem[]> {
    return this.prisma.jobItem.findMany({
      where: {
        jobId,
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMany(filter?: Partial<JobItem>): Promise<JobItem[]> {
    return this.prisma.jobItem.findMany({
      where: filter,
    });
  }

  async update(id: string, data: Partial<JobItem>): Promise<JobItem> {
    return this.prisma.jobItem.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: JobItemStatus, error?: string | null): Promise<JobItem> {
    return this.prisma.jobItem.update({
      where: { id },
      data: { status, error },
    });
  }

  async updateAttempts(
    id: string,
    attempts: number,
    lastStatusCode?: number | null,
  ): Promise<JobItem> {
    return this.prisma.jobItem.update({
      where: { id },
      data: { attempts, lastStatusCode },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.jobItem.delete({
      where: { id },
    });
  }

  async countByJobIdAndStatus(jobId: string, status: JobItemStatus): Promise<number> {
    return this.prisma.jobItem.count({
      where: { jobId, status },
    });
  }
}
