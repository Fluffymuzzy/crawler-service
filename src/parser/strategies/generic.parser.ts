import { injectable } from 'inversify';
import * as cheerio from 'cheerio';
import { IParser, ParsedProfile } from '../../interfaces/parser.interface';

@injectable()
export class GenericProfileParser implements IParser {
  readonly priority = 1;
  readonly name = 'generic';

  supports(_url: string): boolean {
    // Default parser - supports all URLs
    return true;
  }

  parse(html: string, _url: string): ParsedProfile | null {
    try {
      const $ = cheerio.load(html);

      // Extract basic profile information using common patterns
      const profile: ParsedProfile = {
        username: this.extractUsername($) || undefined,
        displayName: this.extractName($) || undefined,
        bio: this.extractHeadline($) || this.extractAbout($) || undefined,
        avatarUrl: this.extractProfilePicture($, _url) || undefined,
        coverUrl: undefined,
        sourceUrl: _url,
        publicStats: undefined,
        links: undefined,
      };

      // Only return if we found at least some data
      if (profile.username || profile.displayName || profile.bio) {
        return profile;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private extractUsername($: cheerio.CheerioAPI): string | null {
    // Try common selectors for username/handle
    const selectors = [
      '[class*="username"]',
      '[class*="handle"]',
      '[data-testid*="username"]',
      '.profile-username',
      '.handle',
      '@[class*="username"]',
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text) return text;
    }

    return null;
  }

  private extractName($: cheerio.CheerioAPI): string | null {
    // Try common selectors for name
    const selectors = [
      'h1[class*="name"]',
      'h1[id*="name"]',
      'span[class*="name"]',
      'div[class*="profile-name"]',
      'h1.profile-name',
      '[data-testid*="name"]',
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text) return text;
    }

    return null;
  }

  private extractHeadline($: cheerio.CheerioAPI): string | null {
    const selectors = [
      'h2[class*="headline"]',
      'p[class*="headline"]',
      'div[class*="headline"]',
      '.profile-headline',
      '[data-testid*="headline"]',
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text) return text;
    }

    return null;
  }

  private extractAbout($: cheerio.CheerioAPI): string | null {
    const selectors = [
      'section[class*="about"]',
      'div[class*="about"]',
      'p[class*="bio"]',
      '.profile-about',
      '[data-testid*="about"]',
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 20) return text;
    }

    return null;
  }

  private extractProfilePicture($: cheerio.CheerioAPI, baseUrl: string): string | null {
    const selectors = [
      'img[class*="profile"]',
      'img[class*="avatar"]',
      'img[alt*="profile"]',
      '.profile-photo img',
      '[data-testid*="photo"] img',
    ];

    for (const selector of selectors) {
      const src = $(selector).first().attr('src');
      if (src) {
        // Convert relative URLs to absolute
        if (src.startsWith('/')) {
          const url = new URL(baseUrl);
          return `${url.protocol}//${url.host}${src}`;
        }
        return src;
      }
    }

    return null;
  }
}
