import { injectable, inject } from 'inversify';
import { ILogger } from '../../interfaces/external/logger.interface';
import { TYPES } from '../../container/types';

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

@injectable()
export class RetryManager {
  constructor(@inject(TYPES.Logger) private logger: ILogger) {}

  async executeWithRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
    const {
      maxAttempts,
      delayMs,
      backoffMultiplier = 2,
      shouldRetry = (): boolean => true,
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(`Attempting operation (attempt ${attempt}/${maxAttempts})`);
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          this.logger.error('Max retry attempts reached', {
            attempts: maxAttempts,
            error: lastError.message,
          });
          break;
        }

        if (!shouldRetry(lastError)) {
          this.logger.warn('Error is not retryable', { error: lastError.message });
          break;
        }

        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        this.logger.debug(`Retrying after ${delay}ms`, {
          attempt,
          nextDelay: delay,
        });

        await this.delay(delay);
      }
    }

    throw lastError || new Error('Operation failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
