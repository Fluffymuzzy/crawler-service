import request from 'supertest';
import { createApp } from '../../src/app';
import type { Application } from 'express';
import { prismaService } from '../../src/db/prisma';
import { getCrawlQueue } from '../../src/queue/crawl.queue';
import { getRedisConnection } from '../../src/queue/connection';
import type {
  JobResponse,
  ProfilesResponse,
  CrawlResponse,
  HealthResponse,
} from '../../src/types/api';

describe('E2E: HTTP API', () => {
  let app: Application;

  beforeAll(async () => {
    app = createApp();
    // Connect to test database
    await prismaService.connect();

    // Clean all data before tests
    await prismaService.client.jobItem.deleteMany({});
    await prismaService.client.job.deleteMany({});
    await prismaService.client.profile.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    await prismaService.client.jobItem.deleteMany({});
    await prismaService.client.job.deleteMany({});
    await prismaService.client.profile.deleteMany({});
    await prismaService.disconnect();

    // Clear queue
    const queue = getCrawlQueue();
    await queue.obliterate({ force: true });

    // Close Redis connection
    const redis = getRedisConnection();
    redis.disconnect();
  });

  afterEach(async () => {
    // Clean up after each test to avoid interference
    await prismaService.client.jobItem.deleteMany({});
    await prismaService.client.job.deleteMany({});

    // Clear queue
    const queue = getCrawlQueue();
    await queue.obliterate({ force: true });
  });

  test('should respond to health check', async () => {
    const response = await request(app).get('/api/health').expect(200);

    const health = response.body as HealthResponse;
    expect(health.status).toBe('ok');
    expect(typeof health.timestamp).toBe('string');
    expect(typeof health.uptime).toBe('number');
  });

  test('should validate crawl request structure', async () => {
    // Test empty URLs array
    const response1 = await request(app)
      .post('/api/crawl')
      .send({
        urls: [],
        priority: 'normal',
      })
      .expect(400);

    expect(response1.body).toHaveProperty('error');

    // Test invalid priority
    const response2 = await request(app)
      .post('/api/crawl')
      .send({
        urls: ['https://example.com'],
        priority: 'invalid',
      })
      .expect(400);

    expect(response2.body).toHaveProperty('error');

    // Test missing URLs field
    const response3 = await request(app)
      .post('/api/crawl')
      .send({
        priority: 'normal',
      })
      .expect(400);

    expect(response3.body).toHaveProperty('error');
  });

  test('should complete full crawl workflow (POST /crawl -> GET /jobs/:id)', async () => {
    // Step 1: Create a crawl job
    const crawlResponse = await request(app)
      .post('/api/crawl')
      .send({
        urls: [
          'https://example.com/test-user-1',
          'https://example.com/test-user-2',
          'https://example.com/test-user-1', // Duplicate should be removed
        ],
        priority: 'high',
      })
      .expect(201);

    // Verify crawl response format
    const crawlData = crawlResponse.body as CrawlResponse;
    expect(crawlData.queued).toBe(2); // Only 2 unique URLs
    expect(typeof crawlData.jobId).toBe('string');

    const jobId = crawlData.jobId;

    // Step 2: Check job status
    const jobResponse = await request(app).get(`/api/jobs/${jobId}`).expect(200);

    // Verify job response format
    const jobData = jobResponse.body as JobResponse;
    expect(jobData.jobId).toBe(jobId);
    expect(['queued', 'running', 'done', 'partial', 'failed']).toContain(jobData.status);
    expect(jobData.total).toBe(2);
    expect(typeof jobData.processed).toBe('number');
    expect(typeof jobData.failed).toBe('number');
    expect(Array.isArray(jobData.results)).toBe(true);
    expect(jobData.results).toHaveLength(2);

    // Verify each result
    jobData.results.forEach((result) => {
      expect(['pending', 'ok', 'error', 'blocked']).toContain(result.status);
      expect(typeof result.url).toBe('string');
      expect(result.error === null || typeof result.error === 'string').toBe(true);
    });

    // Verify specific URLs
    expect(jobData.results[0].url).toBe('https://example.com/test-user-1');
    expect(jobData.results[1].url).toBe('https://example.com/test-user-2');

    // Step 3: Check job was queued
    const queue = getCrawlQueue();
    const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed']);
    const queuedJob = jobs.find((j) => j.data.jobId === jobId);
    expect(queuedJob).toBeDefined();
    if (queuedJob) {
      expect(queuedJob.data.jobId).toBe(jobId);
    }
  });

  test('should handle invalid job ID correctly', async () => {
    const response = await request(app)
      .get('/api/jobs/00000000-0000-0000-0000-000000000000')
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Job not found');
  });

  test('should search profiles with pagination', async () => {
    // Clean profiles first
    await prismaService.client.profile.deleteMany({});

    // Create test profiles
    await prismaService.client.profile.createMany({
      data: [
        {
          sourceUrl: 'https://example.com/alice',
          username: 'alice',
          displayName: 'Alice Smith',
          bio: 'Test user 1',
          scrapedAt: new Date(),
          rawHtmlChecksum: 'checksum1',
        },
        {
          sourceUrl: 'https://example.com/bob',
          username: 'bob',
          displayName: 'Bob Johnson',
          bio: 'Test user 2',
          scrapedAt: new Date(),
          rawHtmlChecksum: 'checksum2',
        },
        {
          sourceUrl: 'https://example.com/charlie',
          username: 'charlie',
          displayName: 'Charlie Brown',
          bio: 'Another test user',
          scrapedAt: new Date(),
          rawHtmlChecksum: 'checksum3',
        },
      ],
    });

    // Test search without query
    const response1 = await request(app).get('/api/profiles?page=1&limit=2').expect(200);

    const profiles1 = response1.body as ProfilesResponse;
    expect(profiles1.page).toBe(1);
    expect(profiles1.limit).toBe(2);
    expect(profiles1.items).toHaveLength(2);
    expect(profiles1.total).toBeGreaterThanOrEqual(3);

    // Test search with query
    const response2 = await request(app)
      .get('/api/profiles?query=alice&page=1&limit=10')
      .expect(200);

    const profiles2 = response2.body as ProfilesResponse;
    expect(profiles2.items).toHaveLength(1);
    expect(profiles2.items[0].sourceUrl).toBe('https://example.com/alice');
    expect(profiles2.items[0].username).toBe('alice');
    expect(profiles2.items[0].displayName).toBe('Alice Smith');
    expect(profiles2.items[0].avatarUrl).toBeNull();

    // Test pagination
    const response3 = await request(app).get('/api/profiles?page=2&limit=2').expect(200);

    const profiles3 = response3.body as ProfilesResponse;
    expect(profiles3.page).toBe(2);
    expect(profiles3.limit).toBe(2);
    expect(profiles3.items.length).toBeLessThanOrEqual(2);
  });

  test('should handle multiple concurrent crawl jobs', async () => {
    // Create multiple jobs concurrently
    const crawlPromises = [
      request(app)
        .post('/api/crawl')
        .send({
          urls: ['https://example.com/concurrent-1'],
          priority: 'normal',
        }),
      request(app)
        .post('/api/crawl')
        .send({
          urls: ['https://example.com/concurrent-2'],
          priority: 'high',
        }),
      request(app)
        .post('/api/crawl')
        .send({
          urls: ['https://example.com/concurrent-3'],
          priority: 'normal',
        }),
    ];

    const responses = await Promise.all(crawlPromises);

    // All should succeed
    responses.forEach((response) => {
      expect(response.status).toBe(201);
      const crawlData = response.body as CrawlResponse;
      expect(typeof crawlData.jobId).toBe('string');
      expect(crawlData.queued).toBe(1);
    });

    // Check all jobs exist
    const jobIds = responses.map((r) => (r.body as CrawlResponse).jobId);

    // Small delay to ensure all jobs are saved
    await new Promise((resolve) => setTimeout(resolve, 100));

    for (const jobId of jobIds) {
      const jobResponse = await request(app).get(`/api/jobs/${jobId}`).expect(200);

      const jobData = jobResponse.body as JobResponse;
      expect(jobData.jobId).toBe(jobId);
      expect(jobData.total).toBe(1);
    }
  });
});
