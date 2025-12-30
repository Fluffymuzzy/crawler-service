import type { Profile, Prisma } from '@prisma/client';
import type { IRepository } from './base.repository';

export interface ProfileCreateData {
  sourceUrl: string;
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  publicStats?: Prisma.JsonValue | null;
  links?: Prisma.JsonValue | null;
  scrapedAt: Date;
  rawHtmlChecksum: string;
}

export interface IProfileRepository extends IRepository<Profile> {
  findBySourceUrl(sourceUrl: string): Promise<Profile | null>;

  upsert(data: ProfileCreateData): Promise<Profile>;

  search(query: string, limit: number): Promise<Profile[]>;

  findManyWithPagination(options: {
    skip: number;
    take: number;
    orderBy?: Prisma.ProfileOrderByWithRelationInput;
  }): Promise<Profile[]>;

  count(where?: Prisma.ProfileWhereInput): Promise<number>;
}
