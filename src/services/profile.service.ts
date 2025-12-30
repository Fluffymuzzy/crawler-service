import { injectable, inject } from 'inversify';
import type { Profile } from '@prisma/client';
import {
  IProfileService,
  ProfileSearchResult,
  ProfileUpdateData,
} from '../interfaces/services/profile.service.interface';
import { IProfileRepository } from '../interfaces/repositories/profile.repository.interface';
import { ILogger } from '../interfaces/external/logger.interface';
import { TYPES } from '../container/types';

@injectable()
export class ProfileService implements IProfileService {
  constructor(
    @inject(TYPES.ProfileRepository) private profileRepo: IProfileRepository,
    @inject(TYPES.Logger) private logger: ILogger,
  ) {}

  async getProfiles(page: number, limit: number): Promise<ProfileSearchResult> {
    const skip = (page - 1) * limit;

    const [profiles, total] = await Promise.all([
      this.profileRepo.findManyWithPagination({
        skip,
        take: limit,
        orderBy: { scrapedAt: 'desc' },
      }),
      this.profileRepo.count(),
    ]);

    return {
      profiles,
      total,
      page,
      limit,
    };
  }

  async searchProfiles(query: string, page: number, limit: number): Promise<ProfileSearchResult> {
    // For search, we use a simpler approach without skip
    const profiles = await this.profileRepo.search(query, limit);

    // For total count in search, we need to get all matching results
    // This is not ideal but matches the current implementation
    const allResults = await this.profileRepo.search(query, 1000);
    const total = allResults.length;

    // Apply pagination manually for search results
    const startIndex = (page - 1) * limit;
    const paginatedProfiles = profiles.slice(startIndex, startIndex + limit);

    return {
      profiles: paginatedProfiles,
      total,
      page,
      limit,
    };
  }

  async getProfileById(id: string): Promise<Profile | null> {
    return this.profileRepo.findById(id);
  }

  async saveOrUpdateProfile(parsed: ProfileUpdateData): Promise<Profile> {
    const existing = await this.profileRepo.findBySourceUrl(parsed.sourceUrl);

    if (!existing) {
      this.logger.info('Creating new profile', { 
        sourceUrl: parsed.sourceUrl,
        checksum: parsed.rawHtmlChecksum?.substring(0, 8)
      });
      return this.profileRepo.create({
        sourceUrl: parsed.sourceUrl,
        username: parsed.username,
        displayName: parsed.displayName,
        bio: parsed.bio,
        avatarUrl: parsed.avatarUrl,
        coverUrl: parsed.coverUrl,
        publicStats: parsed.publicStats,
        links: parsed.links,
        scrapedAt: parsed.scrapedAt,
        rawHtmlChecksum: parsed.rawHtmlChecksum,
      });
    }

    if (existing.rawHtmlChecksum === parsed.rawHtmlChecksum) {
      this.logger.info('Profile checksum matches, skipping update', {
        sourceUrl: parsed.sourceUrl,
        checksum: parsed.rawHtmlChecksum,
      });
      return this.profileRepo.update(existing.id, {
        scrapedAt: parsed.scrapedAt,
      });
    }

    this.logger.info('Profile changed, updating all fields', {
      sourceUrl: parsed.sourceUrl,
      oldChecksum: existing.rawHtmlChecksum,
      newChecksum: parsed.rawHtmlChecksum,
    });

    return this.profileRepo.update(existing.id, {
      username: parsed.username,
      displayName: parsed.displayName,
      bio: parsed.bio,
      avatarUrl: parsed.avatarUrl,
      coverUrl: parsed.coverUrl,
      publicStats: parsed.publicStats,
      links: parsed.links,
      scrapedAt: parsed.scrapedAt,
      rawHtmlChecksum: parsed.rawHtmlChecksum,
    });
  }
}
