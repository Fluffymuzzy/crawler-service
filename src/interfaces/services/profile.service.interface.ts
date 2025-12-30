import type { Profile, Prisma } from '@prisma/client';

export interface ProfileSearchResult {
  profiles: Profile[];
  total: number;
  page: number;
  limit: number;
}

export interface ProfileUpdateData {
  sourceUrl: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  publicStats: Prisma.JsonValue | null;
  links: Prisma.JsonValue | null;
  scrapedAt: Date;
  rawHtmlChecksum: string;
}

export interface IProfileService {
  getProfiles(page: number, limit: number): Promise<ProfileSearchResult>;
  searchProfiles(query: string, page: number, limit: number): Promise<ProfileSearchResult>;
  getProfileById(id: string): Promise<Profile | null>;
  saveOrUpdateProfile(parsed: ProfileUpdateData): Promise<Profile>;
}
