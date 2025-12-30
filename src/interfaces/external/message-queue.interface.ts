import type { Job } from 'bullmq';

export interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface IMessageQueue {
  publish<T>(queueName: string, data: T): Promise<Job<T>>;
  subscribe<T>(queueName: string, handler: (job: Job<T>) => Promise<void>): void;
  getQueueInfo(queueName: string): Promise<QueueInfo>;
  close(): Promise<void>;
}
