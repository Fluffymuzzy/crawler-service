import type { Profile, Prisma } from '@prisma/client';
import { ProfileRepository } from '../db/repositories';
import type { ParsedProfile } from '../parser/types';
import { logger } from '../utils/logger';

export class ProfileService {
  private profileRepo: ProfileRepository;

  constructor() {
    this.profileRepo = new ProfileRepository();
  }

  async saveOrUpdateProfile(parsed: ParsedProfile): Promise<Profile> {
    const existing = await this.profileRepo.findBySourceUrl(parsed.sourceUrl);

    if (!existing) {
      logger.info({ sourceUrl: parsed.sourceUrl }, 'Creating new profile');
      return this.profileRepo.create({
        sourceUrl: parsed.sourceUrl,
        username: parsed.username,
        displayName: parsed.displayName,
        bio: parsed.bio,
        avatarUrl: parsed.avatarUrl,
        coverUrl: parsed.coverUrl,
        publicStats: parsed.publicStats ? (parsed.publicStats as Prisma.InputJsonValue) : null,
        links: parsed.links,
        scrapedAt: parsed.scrapedAt,
        rawHtmlChecksum: parsed.rawHtmlChecksum,
      });
    }

    if (existing.rawHtmlChecksum === parsed.rawHtmlChecksum) {
      logger.info(
        { sourceUrl: parsed.sourceUrl, checksum: parsed.rawHtmlChecksum },
        'Profile unchanged, updating scrapedAt only',
      );
      return this.profileRepo.update(existing.id, {
        scrapedAt: parsed.scrapedAt,
      });
    }

    logger.info(
      {
        sourceUrl: parsed.sourceUrl,
        oldChecksum: existing.rawHtmlChecksum,
        newChecksum: parsed.rawHtmlChecksum,
      },
      'Profile changed, updating all fields',
    );

    return this.profileRepo.update(existing.id, {
      username: parsed.username,
      displayName: parsed.displayName,
      bio: parsed.bio,
      avatarUrl: parsed.avatarUrl,
      coverUrl: parsed.coverUrl,
      publicStats: parsed.publicStats ? (parsed.publicStats as Prisma.InputJsonValue) : null,
      links: parsed.links,
      scrapedAt: parsed.scrapedAt,
      rawHtmlChecksum: parsed.rawHtmlChecksum,
    });
  }
}
