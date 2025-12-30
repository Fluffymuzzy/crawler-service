import { injectable, inject } from 'inversify';
import * as cheerio from 'cheerio';
import { IParser, ParsedProfile } from '../../interfaces/parser.interface';
import { ILogger } from '../../interfaces/external/logger.interface';
import { TYPES } from '../../container/types';

@injectable()
export class SocialMediaParser implements IParser {
  readonly priority = 10;
  readonly name = 'social-media';

  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
  ) {}

  supports(url: string): boolean {
    // Supports social media platforms including OnlyFans
    const supportedDomains = [
      'onlyfans.com',
      'linkedin.com',
      'twitter.com',
      'facebook.com',
      'github.com',
    ];

    return supportedDomains.some((domain) => url.includes(domain));
  }

  parse(html: string, url: string): ParsedProfile | null {
    try {
      const $ = cheerio.load(html);

      if (url.includes('onlyfans.com')) {
        return this.parseOnlyFans($, url);
      } else if (url.includes('linkedin.com')) {
        return this.parseLinkedIn($, url);
      } else if (url.includes('github.com')) {
        return this.parseGitHub($, url);
      }

      // Fallback to generic parsing
      return this.parseGeneric($, url);
    } catch (error) {
      return null;
    }
  }

  private parseOnlyFans($: cheerio.CheerioAPI, url: string): ParsedProfile | null {
    const urlUsername = url.split('/').pop();
    this.logger.info('OnlyFans parsing started', { url, urlUsername });
    
    const profile: ParsedProfile = {
      username:
        $('h1[data-testid="profile-name"]').text().trim() ||
        $('.b-username').text().trim() ||
        $('h1').first().text().trim() ||
        urlUsername,
      displayName:
        $('[data-testid="profile-status"]').text().trim() ||
        $('.g-user-status').text().trim() ||
        $('.profile-description').text().trim() ||
        undefined,
      bio:
        $('[data-testid="profile-about"]').text().trim() ||
        $('.b-profile__text').text().trim() ||
        $('.profile-bio').text().trim() ||
        undefined,
      avatarUrl:
        $('img[data-testid="profile-avatar"]').attr('src') ||
        $('.b-avatar img').attr('src') ||
        $('.profile-avatar img').attr('src') ||
        undefined,
      coverUrl:
        $('img[data-testid="profile-cover"]').attr('src') ||
        $('.cover-image img').attr('src') ||
        undefined,
      sourceUrl: url,
      publicStats: undefined,
      links: undefined,
    };

    // Extract subscriber statistics if available
    const statsElements = $('.b-profile__stats, .profile-stats');
    if (statsElements.length > 0) {
      const stats: Record<string, number> = {};
      statsElements.find('.stat').each((_, el) => {
        const text = $(el).text().trim();
        const match = text.match(/(\d+)\s*(\w+)/);
        if (match) {
          const count = parseInt(match[1], 10);
          const type = match[2].toLowerCase();
          stats[type] = count;
        }
      });
      profile.publicStats = Object.keys(stats).length > 0 ? stats : undefined;
    }

    // Extract links if available
    const linkElements = $('.profile-links a, .social-links a');
    if (linkElements.length > 0) {
      const links: string[] = [];
      linkElements.each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) {
          links.push(href);
        }
      });
      profile.links = links.length > 0 ? links : undefined;
    }

    this.logger.info('OnlyFans parsing completed', { 
      url, 
      username: profile.username,
      displayName: profile.displayName,
      hasAvatar: !!profile.avatarUrl 
    });
    
    // Return profile (even if all fields are null - as required)
    return profile;
  }

  private parseLinkedIn($: cheerio.CheerioAPI, url: string): ParsedProfile | null {
    const profile: ParsedProfile = {
      username: $('.profile-handle, .public-identifier').text().trim() || undefined,
      displayName:
        $('h1.top-card-layout__title').text().trim() ||
        $('h1.text-heading-xlarge').text().trim() ||
        undefined,
      bio:
        $('.top-card-layout__headline').text().trim() ||
        $('div.text-body-medium').first().text().trim() ||
        $('section.summary').text().trim() ||
        $('section.about').text().trim() ||
        undefined,
      avatarUrl:
        $('img.top-card__profile-image').attr('src') ||
        $('img.profile-photo').attr('src') ||
        undefined,
      coverUrl: $('.cover-photo img, .artdeco-entity-cover-image img').attr('src') || undefined,
      sourceUrl: url,
      publicStats: undefined,
      links: undefined,
    };

    // Extract connections count as public stats
    const connectionsText = $('.top-card__subline-item').text();
    const connectionsMatch = connectionsText.match(/(\d+)\s*connections?/i);
    if (connectionsMatch) {
      profile.publicStats = { connections: parseInt(connectionsMatch[1], 10) };
    }

    // Extract social links
    const linkElements = $('.contact-links a, .social-links a');
    if (linkElements.length > 0) {
      const links: string[] = [];
      linkElements.each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) {
          links.push(href);
        }
      });
      profile.links = links.length > 0 ? links : undefined;
    }

    return profile;
  }

  private parseGitHub($: cheerio.CheerioAPI, url: string): ParsedProfile | null {
    const profile: ParsedProfile = {
      username: $('.p-nickname').text().trim() || url.split('/').pop() || undefined,
      displayName:
        $('h1.vcard-names').text().trim() || $('[itemprop="name"]').text().trim() || undefined,
      bio:
        $('.user-profile-bio').text().trim() ||
        $('[itemprop="description"]').text().trim() ||
        undefined,
      avatarUrl: $('img.avatar').attr('src') || undefined,
      coverUrl: undefined,
      sourceUrl: url,
      publicStats: undefined,
      links: undefined,
    };

    // Extract public stats (followers, following, repositories)
    const stats: Record<string, number> = {};
    $('.Counter').each((_, elem) => {
      const $counter = $(elem);
      const text = $counter.closest('a').text().trim();
      const count = parseInt($counter.text().trim(), 10);

      if (text.includes('followers')) {
        stats.followers = count;
      } else if (text.includes('following')) {
        stats.following = count;
      } else if (text.includes('repositories')) {
        stats.repositories = count;
      }
    });

    if (Object.keys(stats).length > 0) {
      profile.publicStats = stats;
    }

    // Extract social links
    const linkElements = $('.vcard-details a[href^="http"]');
    if (linkElements.length > 0) {
      const links: string[] = [];
      linkElements.each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          links.push(href);
        }
      });
      profile.links = links.length > 0 ? links : undefined;
    }

    return profile;
  }

  private parseGeneric($: cheerio.CheerioAPI, url: string): ParsedProfile | null {
    // Fallback generic parsing
    return {
      username: undefined,
      displayName: $('h1').first().text().trim() || undefined,
      bio: $('h2').first().text().trim() || $('.description').text().trim() || undefined,
      avatarUrl: $('img.avatar, img.profile-image').attr('src') || undefined,
      coverUrl: undefined,
      sourceUrl: url,
      publicStats: undefined,
      links: undefined,
    };
  }
}
