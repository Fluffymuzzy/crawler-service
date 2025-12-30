import { Router } from 'express';
import healthRoutes from './health';
import crawlRoutes from './crawl.routes';
import jobRoutes from './job.routes';
import profileRoutes from './profile.routes';

const router = Router();

router.use(healthRoutes);
router.use(crawlRoutes);
router.use(jobRoutes);
router.use(profileRoutes);

export default router;
