import express from 'express';
import pinoHttp from 'pino-http';
import type { Container } from 'inversify';
import type { ILogger } from './interfaces/external/logger.interface';
import { TYPES } from './container/types';
import { errorHandler } from './api/middleware/error-handler';
import { createRoutes } from './api/routes';
import type { PinoLogger } from './utils/pino-logger';

export const createApp = (container: Container): express.Application => {
  const app = express();
  const logger = container.get<ILogger>(TYPES.Logger);

  app.use(express.json());
  app.use(
    pinoHttp({
      logger: (logger as PinoLogger).getPinoInstance(),
      autoLogging: {
        ignore: (req) => req.url === '/api/health',
      },
    }),
  );

  // Pass container to routes
  app.use('/api', createRoutes(container));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
};
