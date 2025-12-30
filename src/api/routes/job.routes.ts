import { Router } from 'express';
import { JobController } from '../controllers';

const router = Router();
const controller = new JobController();

router.get('/jobs/:jobId', (req, res, next) => {
  void controller.getJobStatus(req, res, next);
});

export default router;
