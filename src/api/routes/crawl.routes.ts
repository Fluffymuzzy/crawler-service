import { Router } from 'express';
import type { Container } from 'inversify';
import { CrawlController } from '../controllers';
import { validateBody } from '../middleware/validation';
import { crawlRequestSchema } from '../validation';

export const createCrawlRoutes = (container: Container): Router => {
  const router = Router();
  const controller = container.get(CrawlController);

  router.post('/crawl', validateBody(crawlRequestSchema), (req, res, next) => {
    controller.createCrawlJob(req, res, next).catch(next);
  });

  return router;
};

export default createCrawlRoutes;
