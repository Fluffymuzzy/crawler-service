import { injectable, inject } from 'inversify';
import { JobItem, JobStatus } from '@prisma/client';
import { ILogger } from '../../interfaces/external/logger.interface';
import { TYPES } from '../../container/types';

export interface StatusCounts {
  total: number;
  pending: number;
  ok: number;
  error: number;
  blocked: number;
  [key: string]: unknown;
}

@injectable()
export class JobStatusCalculator {
  constructor(@inject(TYPES.Logger) private logger: ILogger) {}

  calculateStatus(items: JobItem[]): JobStatus {
    const counts = this.getStatusCounts(items);

    this.logger.debug('Calculating job status', counts);

    // Still processing
    if (counts.pending > 0) {
      return 'running';
    }

    // All successful
    if (counts.ok === counts.total) {
      return 'done';
    }

    // All failed
    if (counts.error + counts.blocked === counts.total) {
      return 'failed';
    }

    // Mixed results
    return 'partial';
  }

  getStatusCounts(items: JobItem[]): StatusCounts {
    const counts: StatusCounts = {
      total: items.length,
      pending: 0,
      ok: 0,
      error: 0,
      blocked: 0,
    };

    for (const item of items) {
      switch (item.status) {
        case 'pending':
          counts.pending++;
          break;
        case 'ok':
          counts.ok++;
          break;
        case 'error':
          counts.error++;
          break;
        case 'blocked':
          counts.blocked++;
          break;
      }
    }

    return counts;
  }

  getSuccessRate(items: JobItem[]): number {
    const counts = this.getStatusCounts(items);
    const processed = counts.total - counts.pending;

    if (processed === 0) {
      return 0;
    }

    return (counts.ok / processed) * 100;
  }
}
