import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';
import { IProfileService } from '../../interfaces/services/profile.service.interface';
import { TYPES } from '../../container/types';

@injectable()
export class ProfileController {
  constructor(@inject(TYPES.ProfileService) private profileService: IProfileService) {}

  searchProfiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, page = 1, limit = 20 } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);

      let result;

      if (query && typeof query === 'string') {
        result = await this.profileService.searchProfiles(query, pageNum, limitNum);
      } else {
        result = await this.profileService.getProfiles(pageNum, limitNum);
      }

      const items = result.profiles.map((profile) => ({
        sourceUrl: profile.sourceUrl,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
        coverUrl: profile.coverUrl,
        publicStats: profile.publicStats,
        links: profile.links,
        rawHtmlChecksum: profile.rawHtmlChecksum,
        scrapedAt: profile.scrapedAt,
      }));

      res.json({
        page: result.page,
        limit: result.limit,
        total: result.total,
        items,
      });
    } catch (error) {
      next(error);
    }
  };
}
