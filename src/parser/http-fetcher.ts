import type { FetchResult } from './types';
import { logger } from '../utils/logger';
import { DomainRateLimiter } from '../utils/rate-limiter';
import { withRetry } from '../utils/retry';
import type { HttpError, TimeoutError } from '../types/errors';
import { getErrorStatus, isBlockedError } from '../types/errors';

const FETCH_TIMEOUT = 10000; // 10 seconds
const USER_AGENT = 'Mozilla/5.0 (compatible; CrawlerBot/1.0)';

async function performSingleFetch(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const statusCode = response.status;
    const finalUrl = response.url;

    if (statusCode === 200) {
      const html = await response.text();
      return { statusCode, html, finalUrl };
    }

    // For non-200 status codes, throw an error that will be handled by retry logic
    const error = new Error(`HTTP ${statusCode}`) as HttpError;
    error.status = statusCode;
    throw error;
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout') as TimeoutError;
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
    }

    throw error;
  }
}

export async function fetchPage(url: string): Promise<FetchResult> {
  logger.info({ url }, 'Starting HTTP fetch with retry and rate limiting');

  // Apply rate limiting
  const rateLimiter = DomainRateLimiter.getInstance();
  await rateLimiter.waitForDomain(url);

  // Apply retry logic
  const retryResult = await withRetry(() => performSingleFetch(url), {
    shouldRetry: (error, attempt: number) => {
      // Don't retry 403 (blocked)
      if (isBlockedError(error)) {
        return false;
      }

      const status = getErrorStatus(error);

      // Retry for 429, 5xx, and network errors
      if (status === 429 || status >= 500) {
        return attempt < 3;
      }

      // Retry for network errors
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
        finalUrl: retryResult.result.finalUrl,
        attempts: retryResult.attempts,
      },
      'HTTP fetch completed successfully',
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
    'HTTP fetch failed after retries',
  );

  return {
    statusCode,
    html: null,
    finalUrl: url,
  };
}
