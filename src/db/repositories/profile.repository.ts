import { injectable, inject } from 'inversify';
import type { Profile, Prisma } from '@prisma/client';
import {
  IProfileRepository,
  ProfileCreateData,
} from '../../interfaces/repositories/profile.repository.interface';
import { IDatabase } from '../../interfaces/external/database.interface';
import { TYPES } from '../../container/types';
import { PrismaDatabase } from '../prisma-database';

@injectable()
export class ProfileRepository implements IProfileRepository {
  private prisma: PrismaDatabase;

  constructor(@inject(TYPES.Database) database: IDatabase) {
    this.prisma = database as PrismaDatabase;
  }

  async create(data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>): Promise<Profile> {
    console.log('ProfileRepository.create called with:', JSON.stringify(data, null, 2));
    
    // Filter out null values to avoid Prisma type issues
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null),
    ) as Prisma.ProfileCreateInput;

    console.log('Cleaned data for Prisma:', JSON.stringify(cleanData, null, 2));

    return this.prisma.profile.create({
      data: cleanData,
    });
  }

  async findById(id: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({
      where: { id },
    });
  }

  async findBySourceUrl(sourceUrl: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({
      where: { sourceUrl },
    });
  }

  async findMany(filter?: Prisma.ProfileWhereInput): Promise<Profile[]> {
    return this.prisma.profile.findMany({
      where: filter,
    });
  }

  async findManyWithPagination(options: {
    skip: number;
    take: number;
    orderBy?: Prisma.ProfileOrderByWithRelationInput;
  }): Promise<Profile[]> {
    return this.prisma.profile.findMany(options);
  }

  async search(query: string, limit = 20): Promise<Profile[]> {
    return this.prisma.profile.findMany({
      where: {
        OR: [
          {
            username: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            displayName: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            bio: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: { scrapedAt: 'desc' },
      take: limit,
    });
  }

  async update(id: string, data: Partial<Profile>): Promise<Profile> {
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null),
    ) as Prisma.ProfileUpdateInput;

    return this.prisma.profile.update({
      where: { id },
      data: cleanData,
    });
  }

  async upsert(data: ProfileCreateData): Promise<Profile> {
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null),
    ) as Prisma.ProfileCreateInput;

    return this.prisma.profile.upsert({
      where: { sourceUrl: data.sourceUrl },
      update: cleanData,
      create: cleanData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.profile.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.ProfileWhereInput): Promise<number> {
    return this.prisma.profile.count({ where });
  }
}
