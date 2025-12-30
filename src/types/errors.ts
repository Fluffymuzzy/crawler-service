// Error types for type-safe error handling
export interface HttpError extends Error {
  status?: number;
  code?: string;
  statusCode?: number;
}

export interface NetworkError extends Error {
  code: 'ENOTFOUND' | 'ECONNREFUSED' | 'ETIMEDOUT' | 'ECONNRESET';
}

export interface GenericNetworkError extends Error {
  code: string;
}

export interface TimeoutError extends Error {
  code: 'TIMEOUT';
}

export interface BlockedError extends Error {
  status: 403;
  code: 'BLOCKED';
}

// Union type for all possible retry errors
export type RetryableError =
  | HttpError
  | NetworkError
  | GenericNetworkError
  | TimeoutError
  | BlockedError;

export function isNetworkError(error: unknown): error is NetworkError | GenericNetworkError {
  return error instanceof Error && 'code' in error;
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && ('status' in error || 'statusCode' in error);
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof Error && 'code' in error && (error as TimeoutError).code === 'TIMEOUT';
}

export function isBlockedError(error: unknown): error is BlockedError {
  return isHttpError(error) && (error.status === 403 || error.statusCode === 403);
}

export function getErrorStatus(error: unknown): number {
  if (isHttpError(error)) {
    return error.status || error.statusCode || 0;
  }
  return 0;
}
