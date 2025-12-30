import { logger } from './logger';

export class DomainRateLimiter {
  private static instance: DomainRateLimiter;
  private domainTimestamps: Map<string, number> = new Map();
  private readonly intervalMs: number = 1000; // 1 second

  private constructor() {}

  static getInstance(): DomainRateLimiter {
    if (!DomainRateLimiter.instance) {
      DomainRateLimiter.instance = new DomainRateLimiter();
    }
    return DomainRateLimiter.instance;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url; // fallback for invalid URLs
    }
  }

  async waitForDomain(url: string): Promise<void> {
    const domain = this.extractDomain(url);
    const now = Date.now();
    const lastRequest = this.domainTimestamps.get(domain) || 0;
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest < this.intervalMs) {
      const waitTime = this.intervalMs - timeSinceLastRequest;

      logger.info(
        {
          domain,
          waitTimeMs: waitTime,
          lastRequestMs: lastRequest,
        },
        'Rate limiting: waiting for domain',
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.domainTimestamps.set(domain, Date.now());
  }

  // Clean up old entries to prevent memory leaks
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.intervalMs * 10; // Keep last 10 intervals

    for (const [domain, timestamp] of this.domainTimestamps.entries()) {
      if (timestamp < cutoff) {
        this.domainTimestamps.delete(domain);
      }
    }
  }
}
