import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePublicProfile } from '../../src/parser/cheerio-parser';
import { calculateChecksum } from '../../src/utils/checksum';

describe('parsePublicProfile', () => {
  const fixtureHtml = readFileSync(join(__dirname, '../fixtures/profile-page.html'), 'utf-8');
  const sourceUrl = 'https://example.com/janedoe';

  describe('successful parsing', () => {
    it('should extract all required profile fields correctly', () => {
      const result = parsePublicProfile(fixtureHtml, sourceUrl);

      // Required fields from task
      expect(result.sourceUrl).toBe(sourceUrl);
      expect(result.username).toBe('janedoe');
      expect(result.displayName).toBe('Jane Doe');
      expect(result.bio).toBe('Digital artist and content creator. Follow my journey!');
      expect(result.avatarUrl).toBe('https://example.com/avatars/janedoe.jpg');
      expect(result.coverUrl).toBe('https://example.com/covers/janedoe-banner.jpg');
      expect(result.rawHtmlChecksum).toBeDefined();
      expect(result.scrapedAt).toBeInstanceOf(Date);
    });

    it('should extract public stats when available', () => {
      const result = parsePublicProfile(fixtureHtml, sourceUrl);

      expect(result.publicStats).toEqual({
        posts: 2500,
        followers: 10800,
        likes: 1200000,
      });
    });

    it('should extract external links correctly', () => {
      const result = parsePublicProfile(fixtureHtml, sourceUrl);

      expect(result.links).toContain('https://twitter.com/janedoe');
      expect(result.links).toContain('https://instagram.com/janedoe');
      expect(result.links).toContain('https://janedoe.com/');
      expect(result.links).toHaveLength(3);
    });

    it('should calculate consistent checksum for unchanged content', () => {
      const result1 = parsePublicProfile(fixtureHtml, sourceUrl);
      const result2 = parsePublicProfile(fixtureHtml, sourceUrl);

      expect(result1.rawHtmlChecksum).toBe(result2.rawHtmlChecksum);
      expect(result1.rawHtmlChecksum).toBe(calculateChecksum(fixtureHtml));
    });

    it('should extract username from URL when not found in HTML', () => {
      const minimalHtml = `<!DOCTYPE html><html><head><title>Profile</title></head><body></body></html>`;
      const result = parsePublicProfile(minimalHtml, 'https://example.com/testuser123');

      expect(result.username).toBe('testuser123');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle completely empty HTML gracefully', () => {
      const emptyHtml = '';
      const result = parsePublicProfile(emptyHtml, sourceUrl);

      expect(result.username).toBe('janedoe'); // from URL
      expect(result.displayName).toBeNull();
      expect(result.bio).toBeNull();
      expect(result.avatarUrl).toBeNull();
      expect(result.coverUrl).toBeNull();
      expect(result.publicStats).toBeNull();
      expect(result.links).toBeNull();
      expect(result.rawHtmlChecksum).toBeDefined();
      expect(result.scrapedAt).toBeInstanceOf(Date);
    });

    it('should handle missing optional fields without failing', () => {
      const minimalHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Profile</title></head>
        <body><h1>Unknown User</h1></body>
        </html>
      `;

      const result = parsePublicProfile(minimalHtml, sourceUrl);

      expect(result.username).toBe('janedoe'); // from URL
      expect(result.displayName).toBe('Unknown User');
      expect(result.bio).toBeNull();
      expect(result.avatarUrl).toBeNull();
      expect(result.coverUrl).toBeNull();
      expect(result.publicStats).toBeNull();
      expect(result.links).toBeNull();
    });

    it('should handle HTML with no external links', () => {
      const htmlNoLinks = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta property="og:title" content="User Profile">
        </head>
        <body>
          <a href="/internal/page">Internal Link</a>
          <a href="#anchor">Anchor Link</a>
        </body>
        </html>
      `;

      const result = parsePublicProfile(htmlNoLinks, sourceUrl);
      expect(result.links).toBeNull();
    });

    it('should handle various stat formats', () => {
      const htmlWithStats = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="stat-count">1,234 posts</div>
          <div class="stat-count">5.6K followers</div>
          <div class="stat-count">2.3M likes</div>
          <div class="stat-count">1B views</div>
          <div class="stat-count">0 shares</div>
        </body>
        </html>
      `;

      const result = parsePublicProfile(htmlWithStats, sourceUrl);
      expect(result.publicStats).toEqual({
        posts: 1234,
        followers: 5600,
        likes: 2300000,
        views: 1000000000,
      });
    });

    it('should handle malformed URLs in links gracefully', () => {
      const htmlWithBadLinks = `
        <!DOCTYPE html>
        <html>
        <body>
          <a href="https://valid-link.com">Valid</a>
          <a href="not-a-url">Invalid</a>
          <a href="">Empty</a>
          <a>No href</a>
        </body>
        </html>
      `;

      const result = parsePublicProfile(htmlWithBadLinks, sourceUrl);
      expect(result.links).toEqual(['https://valid-link.com/']);
    });

    it('should extract username from various URL patterns', () => {
      const html = `<!DOCTYPE html><html><body></body></html>`;

      const patterns = [
        { url: 'https://site.com/user123', expected: 'user123' },
        { url: 'https://site.com/u/user456', expected: 'user456' },
        { url: 'https://site.com/profiles/user789/', expected: 'user789' },
        { url: 'https://site.com/@user000', expected: '@user000' },
      ];

      patterns.forEach(({ url, expected }) => {
        const result = parsePublicProfile(html, url);
        expect(result.username).toBe(expected);
      });
    });

    it('should handle different checksum for different content', () => {
      const html1 = `<!DOCTYPE html><html><body>Content 1</body></html>`;
      const html2 = `<!DOCTYPE html><html><body>Content 2</body></html>`;

      const result1 = parsePublicProfile(html1, sourceUrl);
      const result2 = parsePublicProfile(html2, sourceUrl);

      expect(result1.rawHtmlChecksum).not.toBe(result2.rawHtmlChecksum);
    });
  });

  describe('timestamp validation', () => {
    it('should set scrapedAt to current timestamp', () => {
      const before = new Date();
      const result = parsePublicProfile(fixtureHtml, sourceUrl);
      const after = new Date();

      expect(result.scrapedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.scrapedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should create new timestamp for each parse', () => {
      const result1 = parsePublicProfile(fixtureHtml, sourceUrl);

      // Small delay to ensure different timestamps
      const delay = new Promise((resolve) => setTimeout(resolve, 10));
      return delay.then(() => {
        const result2 = parsePublicProfile(fixtureHtml, sourceUrl);
        expect(result2.scrapedAt.getTime()).toBeGreaterThan(result1.scrapedAt.getTime());
      });
    });
  });
});
