// Types for worker processing
export interface JobItemData {
  id: string;
  jobId: string;
  url: string;
  status: 'pending' | 'ok' | 'error' | 'blocked';
  attempts: number;
  error?: string | null;
  lastStatusCode?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export interface ItemProcessingResult {
  finalStatus: 'ok' | 'error' | 'blocked';
  statusCode?: number;
  error?: string;
  totalAttempts: number;
}
