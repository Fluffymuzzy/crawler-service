import * as cheerio from 'cheerio';
import type { ParsedProfile } from './types';
import { calculateChecksum } from '../utils/checksum';
import { logger } from '../utils/logger';

export function parsePublicProfile(html: string, sourceUrl: string): ParsedProfile {
  logger.info({ sourceUrl }, 'Starting HTML parsing');

  const $ = cheerio.load(html);
  const checksum = calculateChecksum(html);

  const ogTitle = $('meta[property="og:title"]').attr('content') || null;
  const ogDescription = $('meta[property="og:description"]').attr('content') || null;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const pageTitle = $('title').text().trim() || null;

  const username = extractUsername($, ogTitle, pageTitle, sourceUrl);
  const displayName = extractDisplayName($, ogTitle, pageTitle);
  const bio = ogDescription;
  const avatarUrl = ogImage;
  const coverUrl = extractCoverImage($);

  const publicStats = extractPublicStats($);
  const links = extractExternalLinks($, sourceUrl);

  const profile: ParsedProfile = {
    sourceUrl,
    username,
    displayName,
    bio,
    avatarUrl,
    coverUrl,
    publicStats: publicStats.length > 0 ? Object.fromEntries(publicStats) : null,
    links: links.length > 0 ? links : null,
    rawHtmlChecksum: checksum,
    scrapedAt: new Date(),
  };

  logger.info({ sourceUrl, username, displayName, checksum }, 'HTML parsing completed');

  return profile;
}

function extractUsername(
  $: cheerio.CheerioAPI,
  ogTitle: string | null,
  _pageTitle: string | null,
  sourceUrl: string,
): string | null {
  const urlMatch = sourceUrl.match(/\/([^/]+)\/?$/);
  if (urlMatch) {
    return urlMatch[1];
  }

  if (ogTitle && ogTitle.includes('@')) {
    const match = ogTitle.match(/@(\w+)/);
    if (match) return match[1];
  }

  const profileLink = $('a[href*="/@"]').first().attr('href');
  if (profileLink) {
    const match = profileLink.match(/@(\w+)/);
    if (match) return match[1];
  }

  return null;
}

function extractDisplayName(
  $: cheerio.CheerioAPI,
  ogTitle: string | null,
  pageTitle: string | null,
): string | null {
  if (ogTitle) {
    const cleaned = ogTitle
      .replace(/@\w+/g, '')
      .replace(/[|-].*$/, '')
      .replace(/\s*\(\s*\)\s*/, '') // Remove empty parentheses
      .trim();
    if (cleaned) return cleaned;
  }

  const h1Text = $('h1').first().text().trim();
  if (h1Text) return h1Text;

  if (pageTitle) {
    const cleaned = pageTitle
      .replace(/[|-].*$/, '')
      .replace(/\s*\(\s*\)\s*/, '') // Remove empty parentheses
      .trim();
    if (cleaned) return cleaned;
  }

  return null;
}

function extractCoverImage($: cheerio.CheerioAPI): string | null {
  const coverSelectors = [
    'meta[property="og:image:secure_url"]',
    'meta[property="twitter:image"]',
    'img[alt*="cover"]',
    'img[alt*="banner"]',
    '.cover-image img',
    '.profile-banner img',
  ];

  for (const selector of coverSelectors) {
    const coverUrl = $(selector).attr('content') || $(selector).attr('src');
    if (coverUrl && coverUrl !== $('meta[property="og:image"]').attr('content')) {
      return coverUrl;
    }
  }

  return null;
}

function extractPublicStats($: cheerio.CheerioAPI): Array<[string, number]> {
  const stats: Array<[string, number]> = [];

  $('[class*="stat"], [class*="count"], [data-count]').each((_, element) => {
    const text = $(element).text();
    const match = text.match(/(\d+(?:[.,]\d+)*[KMB]?)\s*(\w+)/i);
    if (match) {
      const value = parseStatValue(match[1]);
      const label = match[2].toLowerCase();
      // Skip single letter labels (like K, M, B) which are multipliers
      if (value > 0 && label.length > 1) {
        stats.push([label, value]);
      }
    }
  });

  return stats;
}

function parseStatValue(value: string): number {
  const normalized = value.replace(/,/g, '');
  const multipliers: Record<string, number> = {
    K: 1000,
    M: 1000000,
    B: 1000000000,
  };

  const match = normalized.match(/^([\d.]+)([KMB])?$/i);
  if (match) {
    const num = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();
    return suffix ? num * multipliers[suffix] : num;
  }

  return 0;
}

function extractExternalLinks($: cheerio.CheerioAPI, sourceUrl: string): string[] {
  const links = new Set<string>();
  const sourceDomain = new URL(sourceUrl).hostname;

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (href) {
      try {
        const url = new URL(href, sourceUrl);
        if (url.hostname !== sourceDomain && url.protocol.startsWith('http')) {
          links.add(url.href);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return Array.from(links);
}
