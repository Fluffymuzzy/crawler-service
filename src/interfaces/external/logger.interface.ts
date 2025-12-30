export interface LogData {
  [key: string]: unknown;
}

export interface ILogger {
  info(message: string, data?: LogData): void;
  error(message: string, error?: Error | LogData): void;
  warn(message: string, data?: LogData): void;
  debug(message: string, data?: LogData): void;
  child(bindings: LogData): ILogger;
}
