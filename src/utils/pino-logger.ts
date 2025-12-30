import { injectable } from 'inversify';
import pino from 'pino';
import { ILogger, LogData } from '../interfaces/external/logger.interface';
import { config } from '../config';

@injectable()
export class PinoLogger implements ILogger {
  private logger: pino.Logger;

  constructor() {
    const options: pino.LoggerOptions = {
      level: config.logLevel || 'info',
      transport:
        config.nodeEnv !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: true,
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    };
    this.logger = pino(options);
  }

  info(message: string, data?: LogData): void {
    this.logger.info(data, message);
  }

  error(message: string, error?: Error | LogData): void {
    if (error instanceof Error) {
      this.logger.error({ err: error }, message);
    } else {
      this.logger.error(error, message);
    }
  }

  warn(message: string, data?: LogData): void {
    this.logger.warn(data, message);
  }

  debug(message: string, data?: LogData): void {
    this.logger.debug(data, message);
  }

  child(bindings: LogData): ILogger {
    const childLogger = Object.create(this) as PinoLogger;
    childLogger.logger = this.logger.child(bindings);
    return childLogger as ILogger;
  }

  getPinoInstance(): pino.Logger {
    return this.logger;
  }
}
