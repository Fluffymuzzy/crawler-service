import { Router } from 'express';
import { CrawlController } from '../controllers';
import { validateBody } from '../middleware/validation';
import { crawlRequestSchema } from '../validation';

const router = Router();
const controller = new CrawlController();

router.post('/crawl', validateBody(crawlRequestSchema), (req, res, next) => {
  void controller.createCrawlJob(req, res, next);
});

export default router;
