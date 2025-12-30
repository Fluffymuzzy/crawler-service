import { chromium, type Browser, type Page } from 'playwright';
import { logger } from '../utils/logger';
import { Semaphore } from '../utils/semaphore';
import { DomainRateLimiter } from '../utils/rate-limiter';
import { withRetry } from '../utils/retry';
import type { HttpError, TimeoutError, BlockedError } from '../types/errors';
import { getErrorStatus, isBlockedError } from '../types/errors';

// Limit concurrent Playwright instances
const playwrightSemaphore = new Semaphore(2);

export interface PlaywrightResult {
  statusCode: number;
  html: string | null;
}

async function performSinglePlaywrightFetch(url: string): Promise<PlaywrightResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Navigate to the page
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    if (!response) {
      const error = new Error('No response from navigation') as TimeoutError;
      error.code = 'TIMEOUT';
      throw error;
    }

    const statusCode = response.status();

    // Check for blocks or challenges first
    const pageContent = await page.content();
    const pageTitle = await page.title();

    // Simple block detection
    if (
      pageTitle.toLowerCase().includes('access denied') ||
      pageTitle.toLowerCase().includes('blocked') ||
      pageContent.toLowerCase().includes('cf-browser-verification') ||
      pageContent.toLowerCase().includes('challenge') ||
      statusCode === 403
    ) {
      const error = new Error('Blocked by website protection') as BlockedError;
      error.status = 403;
      error.code = 'BLOCKED';
      throw error;
    }

    if (statusCode !== 200) {
      const error = new Error(`Playwright HTTP ${statusCode}`) as HttpError;
      error.status = statusCode;
      throw error;
    }

    return { statusCode, html: pageContent };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        const timeoutError = new Error('Playwright timeout') as TimeoutError;
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
    }
    throw error;
  } finally {
    if (page) {
      await page.close().catch((err) => {
        logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Error closing page',
        );
      });
    }
    if (browser) {
      await browser.close().catch((err) => {
        logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Error closing browser',
        );
      });
    }
  }
}

export async function fetchWithPlaywright(url: string): Promise<PlaywrightResult> {
  return playwrightSemaphore.withLock(async () => {
    logger.info({ url }, 'Starting Playwright fetch with retry and rate limiting');

    // Apply rate limiting
    const rateLimiter = DomainRateLimiter.getInstance();
    await rateLimiter.waitForDomain(url);

    // Apply retry logic
    const retryResult = await withRetry(() => performSinglePlaywrightFetch(url), {
      shouldRetry: (error, attempt: number) => {
        // Don't retry 403 (blocked)
        if (isBlockedError(error)) {
          return false;
        }

        const status = getErrorStatus(error);

        // Retry for 429, 5xx, and timeouts
        if (status === 429 || status >= 500) {
          return attempt < 3;
        }

        // Retry for network errors and timeouts
        if (
          'code' in error &&
          ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'TIMEOUT'].includes(String(error.code))
        ) {
          return attempt < 3;
        }

        return false;
      },
    });

    if (retryResult.success && retryResult.result) {
      logger.info(
        {
          url,
          statusCode: retryResult.result.statusCode,
          htmlSize: retryResult.result.html?.length || 0,
          attempts: retryResult.attempts,
        },
        'Playwright fetch completed successfully',
      );
      return retryResult.result;
    }

    // Handle failure case
    const error = retryResult.error!;
    const statusCode = getErrorStatus(error);

    logger.error(
      {
        url,
        error: error.message,
        statusCode,
        attempts: retryResult.attempts,
      },
      'Playwright fetch failed after retries',
    );

    return {
      statusCode,
      html: null,
    };
  });
}
