export interface FetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  error?: string;
}

export interface FetchOptions {
  timeout?: number;
  retries?: number;
  waitForSelector?: string;
  userAgent?: string;
}

export interface IFetcher {
  supports(url: string): boolean;
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
  readonly name: string;
  readonly priority: number;
}
