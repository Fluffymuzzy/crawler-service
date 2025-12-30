import type { Request, Response, NextFunction } from 'express';
import { JobRepository, JobItemRepository } from '../../db/repositories';

export class JobController {
  private jobRepo: JobRepository;
  private jobItemRepo: JobItemRepository;

  constructor() {
    this.jobRepo = new JobRepository();
    this.jobItemRepo = new JobItemRepository();
  }

  getJobStatus = async (
    req: Request<{ jobId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { jobId } = req.params;

      const job = await this.jobRepo.findById(jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      const items = await this.jobItemRepo.findByJobId(jobId);

      const results = items.map((item) => ({
        url: item.url,
        status: item.status,
        error: item.error,
      }));

      res.json({
        jobId: job.id,
        status: job.status,
        total: job.total,
        processed: job.processed,
        failed: job.failed,
        results,
      });
    } catch (error) {
      next(error);
    }
  };
}
