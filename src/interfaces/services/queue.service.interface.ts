export interface CrawlJobData {
  jobId: string;
  profileIds: string[];
  timestamp: number;
}

export interface IQueueService {
  enqueueCrawlJob(jobId: string, profileIds: string[]): Promise<void>;
}
