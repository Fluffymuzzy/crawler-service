import { injectable, inject } from 'inversify';
import { chromium, Browser, Page } from 'playwright';
import { IFetcher, FetchResult, FetchOptions } from '../../interfaces/fetcher.interface';
import { ILogger } from '../../interfaces/external/logger.interface';
import { TYPES } from '../../container/types';

@injectable()
export class PlaywrightFetcher implements IFetcher {
  readonly name = 'playwright';
  readonly priority = 5;

  private browser: Browser | null = null;

  constructor(@inject(TYPES.Logger) private logger: ILogger) {}

  supports(url: string): boolean {
    // Use for specific domains known to require JS rendering
    const jsRequiredDomains = ['linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com'];

    return jsRequiredDomains.some((domain) => url.includes(domain));
  }

  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    let page: Page | null = null;

    try {
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
      }

      page = await this.browser.newPage();

      // Set user agent
      if (options?.userAgent) {
        await page.setExtraHTTPHeaders({
          'User-Agent': options.userAgent,
        });
      }

      // Navigate with timeout
      const timeout = options?.timeout ?? 30000;
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      if (!response) {
        throw new Error('No response received');
      }

      // Wait for specific selector if provided
      if (options?.waitForSelector) {
        try {
          await page.waitForSelector(options.waitForSelector, { timeout: 5000 });
        } catch (error) {
          this.logger.warn('Selector not found', {
            selector: options.waitForSelector,
            url,
          });
        }
      }

      // Get the page content
      const html = await page.content();
      const finalUrl = page.url();

      const headers: Record<string, string> = {};
      const responseHeaders = response.headers();
      for (const [key, value] of Object.entries(responseHeaders)) {
        headers[key] = value;
      }

      this.logger.debug('Fetched URL with Playwright', { url, finalUrl });

      return {
        html,
        finalUrl,
        statusCode: response.status(),
        headers,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Playwright fetch failed', { url, error: message });

      return {
        html: '',
        finalUrl: url,
        statusCode: 0,
        headers: {},
        error: message,
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
