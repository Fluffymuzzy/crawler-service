import { Router } from 'express';
import type { Container } from 'inversify';
import healthRoutes from './health';
import { createCrawlRoutes } from './crawl.routes';
import { createJobRoutes } from './job.routes';
import { createProfileRoutes } from './profile.routes';

export const createRoutes = (container: Container): Router => {
  const router = Router();

  router.use(healthRoutes);
  router.use(createCrawlRoutes(container));
  router.use(createJobRoutes(container));
  router.use(createProfileRoutes(container));

  return router;
};

export default createRoutes;
