import { logger } from './logger';
import type { RetryableError } from '../types/errors';
import { isNetworkError, getErrorStatus } from '../types/errors';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry: (error: RetryableError, attempt: number) => boolean;
}

export interface RetryResult<T> {
  result?: T;
  error?: Error;
  attempts: number;
  success: boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 500,
  shouldRetry: (error: RetryableError, attempt: number) => {
    // Don't retry if we've exhausted attempts
    if (attempt >= 3) return false;

    // Retry for network errors
    if (isNetworkError(error)) {
      const networkCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
      return networkCodes.includes(error.code);
    }

    // Retry for 5xx and 429 status codes
    const status = getErrorStatus(error);
    if (status >= 500 || status === 429) {
      return true;
    }

    return false;
  },
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();
      return {
        result,
        attempts: attempt,
        success: true,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const shouldRetry = config.shouldRetry(lastError as RetryableError, attempt);

      if (!shouldRetry || attempt === config.maxAttempts) {
        logger.error(
          {
            attempt,
            maxAttempts: config.maxAttempts,
            error: lastError.message,
            shouldRetry,
          },
          'Operation failed after retries',
        );

        return {
          error: lastError,
          attempts: attempt,
          success: false,
        };
      }

      const delay = config.baseDelayMs * Math.pow(2, attempt - 1);

      logger.warn(
        {
          attempt,
          maxAttempts: config.maxAttempts,
          delayMs: delay,
          error: lastError.message,
        },
        'Operation failed, retrying with backoff',
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    error: lastError!,
    attempts: config.maxAttempts,
    success: false,
  };
}
