import { injectable, inject } from 'inversify';
import { Queue, Worker, Job } from 'bullmq';
import { IMessageQueue, QueueInfo } from '../interfaces/external/message-queue.interface';
import { ILogger } from '../interfaces/external/logger.interface';
import { TYPES } from '../container/types';
import { getRedisConnection } from './connection';

@injectable()
export class BullMQAdapter implements IMessageQueue {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  constructor(@inject(TYPES.Logger) private logger: ILogger) {}

  async publish<T>(queueName: string, data: T): Promise<Job<T>> {
    const queue = this.getOrCreateQueue(queueName);
    return await queue.add(queueName, data);
  }

  subscribe<T>(queueName: string, handler: (job: Job<T>) => Promise<void>): void {
    if (this.workers.has(queueName)) {
      throw new Error(`Worker already exists for queue: ${queueName}`);
    }

    const worker = new Worker<T>(
      queueName,
      async (job) => {
        try {
          await handler(job);
        } catch (error) {
          this.logger.error(`Error processing job ${job.id} in queue ${queueName}`, error as Error);
          throw error;
        }
      },
      {
        connection: getRedisConnection(),
        concurrency: 5,
      },
    );

    this.workers.set(queueName, worker);
  }

  async getQueueInfo(queueName: string): Promise<QueueInfo> {
    const queue = this.getOrCreateQueue(queueName);
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
    };
  }

  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.queues.values()).map((queue) => queue.close()),
      ...Array.from(this.workers.values()).map((worker) => worker.close()),
    ]);
    this.queues.clear();
    this.workers.clear();
  }

  private getOrCreateQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: getRedisConnection(),
      });
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName)!;
  }
}
