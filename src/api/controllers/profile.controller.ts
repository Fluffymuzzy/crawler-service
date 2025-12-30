import type { Request, Response, NextFunction } from 'express';
import { ProfileRepository } from '../../db/repositories';

export class ProfileController {
  private profileRepo: ProfileRepository;

  constructor() {
    this.profileRepo = new ProfileRepository();
  }

  searchProfiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, page = 1, limit = 20 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      let profiles;
      let total;

      if (query && typeof query === 'string') {
        // Use the search method for text search
        profiles = await this.profileRepo.search(query, Number(limit));
        // For simplicity, we'll use the same search for count
        // In production, you might want a separate count method
        const allResults = await this.profileRepo.search(query, 1000);
        total = allResults.length;

        // Apply pagination to search results
        profiles = profiles.slice(skip, skip + Number(limit));
      } else {
        // Get all profiles with pagination
        profiles = await this.profileRepo.findMany({
          orderBy: { scrapedAt: 'desc' },
          skip,
          take: Number(limit),
        });
        total = await this.profileRepo.count();
      }

      const items = profiles.map((profile) => ({
        sourceUrl: profile.sourceUrl,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      }));

      res.json({
        page: Number(page),
        limit: Number(limit),
        total,
        items,
      });
    } catch (error) {
      next(error);
    }
  };
}
