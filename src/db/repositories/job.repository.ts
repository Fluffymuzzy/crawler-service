import { injectable, inject } from 'inversify';
import type { Job, JobStatus, Prisma } from '@prisma/client';
import {
  IJobRepository,
  JobWithItems,
} from '../../interfaces/repositories/job.repository.interface';
import { IDatabase } from '../../interfaces/external/database.interface';
import { TYPES } from '../../container/types';
import { PrismaDatabase } from '../prisma-database';

@injectable()
export class JobRepository implements IJobRepository {
  private prisma: PrismaDatabase;

  constructor(@inject(TYPES.Database) database: IDatabase) {
    this.prisma = database as PrismaDatabase;
  }

  async create(data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
    return this.prisma.job.create({
      data: {
        total: data.total,
        processed: data.processed ?? 0,
        failed: data.failed ?? 0,
        priority: data.priority ?? 'normal',
        status: data.status ?? 'queued',
      },
    });
  }

  async findById(id: string): Promise<Job | null> {
    return this.prisma.job.findUnique({
      where: { id },
    });
  }

  async findByIdWithItems(id: string): Promise<JobWithItems | null> {
    return this.prisma.job.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  async findMany(filter?: Partial<Job>): Promise<Job[]> {
    return this.prisma.job.findMany({
      where: filter,
    });
  }

  async findManyWithFilters(
    filters: {
      status?: JobStatus;
      createdAt?: { gte?: Date; lte?: Date };
    },
    options?: {
      take?: number;
      skip?: number;
      orderBy?: Prisma.JobOrderByWithRelationInput;
    },
  ): Promise<Job[]> {
    return this.prisma.job.findMany({
      where: filters,
      ...options,
    });
  }

  async update(id: string, data: Partial<Job>): Promise<Job> {
    return this.prisma.job.update({
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

  async delete(id: string): Promise<void> {
    await this.prisma.job.delete({
      where: { id },
    });
  }

  async countWithFilters(filters: {
    status?: JobStatus;
    createdAt?: { gte?: Date; lte?: Date };
  }): Promise<number> {
    return this.prisma.job.count({ where: filters });
  }
}
