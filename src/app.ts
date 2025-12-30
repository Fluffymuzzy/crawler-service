import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import routes from './api/routes';
import { errorHandler } from './api/middleware/error-handler';

export const createApp = (): express.Application => {
  const app = express();

  app.use(express.json());
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health',
      },
    }),
  );

  app.use('/api', routes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
};
