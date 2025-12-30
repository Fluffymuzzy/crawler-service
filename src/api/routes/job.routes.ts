import { Router } from 'express';
import type { Container } from 'inversify';
import { JobController } from '../controllers';

export const createJobRoutes = (container: Container): Router => {
  const router = Router();
  const controller = container.get(JobController);

  router.get('/jobs/:jobId', (req, res, next) => {
    controller.getJobStatus(req, res, next).catch(next);
  });

  return router;
};

export default createJobRoutes;
