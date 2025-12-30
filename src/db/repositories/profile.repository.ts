import type { Profile, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class ProfileRepository {
  async create(data: {
    sourceUrl: string;
    username?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    publicStats?: Prisma.InputJsonValue | null;
    links?: Prisma.InputJsonValue | null;
    scrapedAt: Date;
    rawHtmlChecksum: string;
  }): Promise<Profile> {
    // Filter out null values to avoid Prisma type issues
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null),
    ) as Prisma.ProfileCreateInput;

    return prisma.profile.create({
      data: cleanData,
    });
  }

  async findById(id: string): Promise<Profile | null> {
    return prisma.profile.findUnique({
      where: { id },
    });
  }

  async findBySourceUrl(sourceUrl: string): Promise<Profile | null> {
    return prisma.profile.findUnique({
      where: { sourceUrl },
    });
  }

  async findMany(params?: {
    where?: Prisma.ProfileWhereInput;
    orderBy?: Prisma.ProfileOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }): Promise<Profile[]> {
    return prisma.profile.findMany(params);
  }

  async search(query: string, limit = 20): Promise<Profile[]> {
    return prisma.profile.findMany({
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

  async update(
    id: string,
    data: Partial<{
      username: string | null;
      displayName: string | null;
      bio: string | null;
      avatarUrl: string | null;
      coverUrl: string | null;
      publicStats: Prisma.InputJsonValue | null;
      links: Prisma.InputJsonValue | null;
      scrapedAt: Date;
      rawHtmlChecksum: string;
    }>,
  ): Promise<Profile> {
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null),
    ) as Prisma.ProfileUpdateInput;

    return prisma.profile.update({
      where: { id },
      data: cleanData,
    });
  }

  async upsert(data: {
    sourceUrl: string;
    username?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    publicStats?: Prisma.InputJsonValue | null;
    links?: Prisma.InputJsonValue | null;
    scrapedAt: Date;
    rawHtmlChecksum: string;
  }): Promise<Profile> {
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null),
    ) as Prisma.ProfileCreateInput;

    return prisma.profile.upsert({
      where: { sourceUrl: data.sourceUrl },
      update: cleanData,
      create: cleanData,
    });
  }

  async delete(id: string): Promise<Profile> {
    return prisma.profile.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.ProfileWhereInput): Promise<number> {
    return prisma.profile.count({ where });
  }
}
