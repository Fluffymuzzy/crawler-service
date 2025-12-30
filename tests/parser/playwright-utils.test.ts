import { shouldUsePlaywright } from '../../src/parser/playwright-utils';
import type { FetchResult, ParsedProfile } from '../../src/parser/types';

describe('shouldUsePlaywright', () => {
  const baseProfile: ParsedProfile = {
    sourceUrl: 'https://example.com',
    username: 'testuser',
    displayName: 'Test User',
    bio: 'Test bio',
    avatarUrl: 'https://example.com/avatar.jpg',
    coverUrl: null,
    publicStats: null,
    links: null,
    rawHtmlChecksum: 'abc123',
    scrapedAt: new Date(),
  };

  describe('should return false', () => {
    it('when HTTP request failed', () => {
      const fetchResult: FetchResult = {
        statusCode: 404,
        html: null,
        finalUrl: 'https://example.com',
      };

      expect(shouldUsePlaywright(fetchResult, null)).toBe(false);
    });

    it('when blocked by website', () => {
      const fetchResult: FetchResult = {
        statusCode: 403,
        html: null,
        finalUrl: 'https://example.com',
      };

      expect(shouldUsePlaywright(fetchResult, null)).toBe(false);
    });

    it('when parsing was successful with complete data', () => {
      const fetchResult: FetchResult = {
        statusCode: 200,
        html: '<html>'.padEnd(2000, ' ') + '</html>',
        finalUrl: 'https://example.com',
      };

      expect(shouldUsePlaywright(fetchResult, baseProfile)).toBe(false);
    });
  });

  describe('should return true', () => {
    it('when HTML contains JavaScript indicators', () => {
      const fetchResult: FetchResult = {
        statusCode: 200,
        html: '<html><body>Please enable JavaScript to view this page</body></html>',
        finalUrl: 'https://example.com',
      };

      expect(shouldUsePlaywright(fetchResult, baseProfile)).toBe(true);
    });

    it('when HTML is too small', () => {
      const fetchResult: FetchResult = {
        statusCode: 200,
        html: '<html><body></body></html>',
        finalUrl: 'https://example.com',
      };

      expect(shouldUsePlaywright(fetchResult, baseProfile)).toBe(true);
    });

    it('when parsed profile has minimal data', () => {
      const fetchResult: FetchResult = {
        statusCode: 200,
        html: '<html>'.padEnd(2000, ' ') + '</html>',
        finalUrl: 'https://example.com',
      };

      const minimalProfile: ParsedProfile = {
        ...baseProfile,
        displayName: null,
        bio: null,
        avatarUrl: null,
      };

      expect(shouldUsePlaywright(fetchResult, minimalProfile)).toBe(true);
    });

    it('when parsed profile is null', () => {
      const fetchResult: FetchResult = {
        statusCode: 200,
        html: '<html>'.padEnd(2000, ' ') + '</html>',
        finalUrl: 'https://example.com',
      };

      expect(shouldUsePlaywright(fetchResult, null)).toBe(true);
    });

    it('when HTML contains React app placeholder', () => {
      const fetchResult: FetchResult = {
        statusCode: 200,
        html: '<html><body><div id="root"></div></body></html>'.padEnd(2000, ' '),
        finalUrl: 'https://example.com',
      };

      expect(shouldUsePlaywright(fetchResult, baseProfile)).toBe(true);
    });

    it('when HTML contains "checking your browser"', () => {
      const fetchResult: FetchResult = {
        statusCode: 200,
        html: '<html><body>Checking your browser before accessing the website</body></html>',
        finalUrl: 'https://example.com',
      };

      expect(shouldUsePlaywright(fetchResult, baseProfile)).toBe(true);
    });
  });
});
