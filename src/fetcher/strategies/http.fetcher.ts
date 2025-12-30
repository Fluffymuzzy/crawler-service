import { injectable, inject } from 'inversify';
import { IFetcher, FetchResult, FetchOptions } from '../../interfaces/fetcher.interface';
import { ILogger } from '../../interfaces/external/logger.interface';
import { TYPES } from '../../container/types';

@injectable()
export class HttpFetcher implements IFetcher {
  readonly name = 'http';
  readonly priority = 1;

  constructor(@inject(TYPES.Logger) private logger: ILogger) {}

  supports(url: string): boolean {
    // Default fetcher - supports all HTTP(S) URLs
    return url.startsWith('http://') || url.startsWith('https://');
  }

  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const timeout = options?.timeout ?? 30000;
    const userAgent = options?.userAgent ?? 'Mozilla/5.0 (compatible; Crawler/1.0)';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const headers: Record<string, string> = {};

      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      this.logger.debug('Fetched URL successfully', { url, status: response.status });

      return {
        html,
        finalUrl: response.url, // May differ due to redirects
        statusCode: response.status,
        headers,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to fetch URL', { url, error: message });

      return {
        html: '',
        finalUrl: url,
        statusCode: 0,
        headers: {},
        error: message,
      };
    }
  }
}
