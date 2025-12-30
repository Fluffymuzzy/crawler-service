// API response types for tests and internal use
export interface JobItemResult {
  url: string;
  status: 'pending' | 'ok' | 'error' | 'blocked';
  error: string | null;
  attempts: number;
}

export interface JobResponse {
  jobId: string;
  status: 'queued' | 'running' | 'done' | 'partial' | 'failed';
  total: number;
  processed: number;
  failed: number;
  results: JobItemResult[];
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface ProfileItem {
  sourceUrl: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ProfilesResponse {
  page: number;
  limit: number;
  total: number;
  items: ProfileItem[];
}

export interface CrawlResponse {
  jobId: string;
  queued: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment?: string;
}
