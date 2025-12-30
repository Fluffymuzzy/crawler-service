export interface ParsedProfile {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  publicStats?: Record<string, number>;
  links?: string[];
  sourceUrl?: string;
}

export interface IParser {
  supports(url: string): boolean;
  parse(html: string, url: string): ParsedProfile | null;
  readonly priority: number;
  readonly name: string;
}
