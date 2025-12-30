import { configureContainer } from '../../src/container/container.config';
import { TYPES } from '../../src/container/types';
import { getCrawlQueue } from '../../src/queue/crawl.queue';
import { getRedisConnection } from '../../src/queue/connection';
import type { Container } from 'inversify';
import type { IQueueService } from '../../src/interfaces/services/queue.service.interface';
import type { IJobRepository } from '../../src/interfaces/repositories/job.repository.interface';
import type { IJobItemRepository } from '../../src/interfaces/repositories/job-item.repository.interface';
import { PrismaDatabase } from '../../src/db/prisma-database';
import type { JobStatus } from '@prisma/client';

describe('Integration: Job Flow', () => {
  let container: Container;
  let queueService: IQueueService;
  let jobRepo: IJobRepository;
  let jobItemRepo: IJobItemRepository;
  let database: PrismaDatabase;

  beforeAll(async () => {
    container = configureContainer();
    queueService = container.get<IQueueService>(TYPES.QueueService);
    jobRepo = container.get<IJobRepository>(TYPES.JobRepository);
    jobItemRepo = container.get<IJobItemRepository>(TYPES.JobItemRepository);
    database = container.get<PrismaDatabase>(TYPES.Database);
    
    // Connect to test database
    await database.connect();
  });

  afterAll(async () => {
    // Clean up test data and connections
    await database.job.deleteMany({});
    await database.disconnect();

    // Clear queue
    const queue = getCrawlQueue();
    await queue.obliterate({ force: true });

    // Close Redis connection
    const redis = getRedisConnection();
    redis.disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await database.jobItem.deleteMany({});
    await database.job.deleteMany({});

    // Clear queue completely
    const queue = getCrawlQueue();
    await queue.obliterate({ force: true });
  });

  test('should create and manage job lifecycle', async () => {
    // Create a job
    const job = await jobRepo.create({
      total: 3,
      processed: 0,
      failed: 0,
      priority: 'normal',
      status: 'queued',
    });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.status).toBe('queued');
    expect(job.total).toBe(3);
    expect(job.processed).toBe(0);
    expect(job.failed).toBe(0);

    // Create job items
    const urls = [
      'https://example.com/user1',
      'https://example.com/user2',
      'https://example.com/user3',
    ];

    await jobItemRepo.createMany(
      urls.map((url) => ({
        jobId: job.id,
        url,
        status: 'pending',
        error: null,
        attempts: 0,
        lastStatusCode: null,
      })),
    );

    // Verify job items were created
    const items = await jobItemRepo.findByJobId(job.id);
    expect(items).toHaveLength(3);
    expect(items.every((item) => item.status === 'pending')).toBe(true);

    // Enqueue the job
    const profileIds = items.map(item => item.id);
    await queueService.enqueueCrawlJob(job.id, profileIds);

    // Verify job was enqueued
    const queue = getCrawlQueue();
    const waitingCount = await queue.getWaitingCount();
    expect(waitingCount).toBeGreaterThanOrEqual(1);

    // Verify job still exists before updating
    const jobBeforeUpdate = await jobRepo.findById(job.id);
    expect(jobBeforeUpdate).toBeDefined();
    expect(jobBeforeUpdate?.id).toBe(job.id);

    // Update job status
    await jobRepo.updateStatus(job.id, 'running');
    const updatedJob = await jobRepo.findById(job.id);
    expect(updatedJob?.status).toBe('running');

    // Simulate processing items
    await jobItemRepo.update(items[0].id, {
      status: 'ok',
      attempts: 1,
    });

    await jobItemRepo.update(items[1].id, {
      status: 'error',
      error: 'Network error',
      attempts: 3,
    });

    await jobItemRepo.update(items[2].id, {
      status: 'blocked',
      error: 'Access denied',
      attempts: 1,
      lastStatusCode: 403,
    });

    // Update job progress
    await jobRepo.updateProgress(job.id, 2, 1);

    // Calculate final status
    const finalItems = await jobItemRepo.findByJobId(job.id);

    const successCount = finalItems.filter((item) => item.status === 'ok').length;
    const failedCount = finalItems.filter(
      (item) => item.status === 'error' || item.status === 'blocked',
    ).length;

    expect(successCount).toBe(1);
    expect(failedCount).toBe(2);

    // Update to final status
    const finalStatus = successCount === 0 ? 'failed' : failedCount === 0 ? 'done' : 'partial';
    await jobRepo.updateStatus(job.id, finalStatus);

    const completedJob = await jobRepo.findById(job.id);
    expect(completedJob?.status).toBe('partial');
    expect(completedJob?.processed).toBe(2);
    expect(completedJob?.failed).toBe(1);
  });

  test('should handle job status transitions', async () => {
    const job = await jobRepo.create({
      total: 1,
      processed: 0,
      failed: 0,
      priority: 'high',
      status: 'queued',
    });

    // Test status transitions
    const transitions: { from: JobStatus; to: JobStatus }[] = [
      { from: 'queued', to: 'running' },
      { from: 'running', to: 'done' },
    ];

    let currentStatus: JobStatus = 'queued';
    for (const transition of transitions) {
      expect(currentStatus).toBe(transition.from);
      await jobRepo.updateStatus(job.id, transition.to);
      const updated = await jobRepo.findById(job.id);
      currentStatus = updated!.status;
      expect(currentStatus).toBe(transition.to);
    }
  });

  test('should prevent duplicate URLs within same job', async () => {
    const job = await jobRepo.create({
      total: 2,
      processed: 0,
      failed: 0,
      priority: 'normal',
      status: 'queued',
    });

    // Create first item
    await jobItemRepo.create({
      jobId: job.id,
      url: 'https://example.com/duplicate',
      status: 'pending',
      error: null,
      attempts: 0,
      lastStatusCode: null,
    });

    // Try to create duplicate - should throw error
    await expect(
      jobItemRepo.create({
        jobId: job.id,
        url: 'https://example.com/duplicate',
        status: 'pending',
        error: null,
        attempts: 0,
        lastStatusCode: null,
      }),
    ).rejects.toThrow();
  });

  test('should handle queue operations', async () => {
    const queue = getCrawlQueue();

    // Create and enqueue multiple jobs
    const jobIds = [];
    for (let i = 0; i < 3; i++) {
      const job = await jobRepo.create({
        total: 1,
        processed: 0,
        failed: 0,
        priority: i === 0 ? 'high' : 'normal',
        status: 'queued',
      });
      jobIds.push(job.id);
      await queueService.enqueueCrawlJob(job.id, ['test-profile-id']);
    }

    // Check queue counts
    const waiting = await queue.getWaitingCount();
    expect(waiting).toBe(3);

    // Verify job data in queue
    const jobs = await queue.getWaiting(0, 2);
    expect(jobs).toHaveLength(3);
    expect(jobs[0].data.jobId).toBe(jobIds[0]); // High priority should be first
  });
});
