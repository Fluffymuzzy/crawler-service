export interface FetchResult {
  statusCode: number;
  html: string | null;
  finalUrl: string;
}

export interface ParsedProfile {
  sourceUrl: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  publicStats: Record<string, unknown> | null;
  links: string[] | null;
  rawHtmlChecksum: string;
  scrapedAt: Date;
}
