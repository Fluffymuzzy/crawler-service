import { Router } from 'express';
import { ProfileController } from '../controllers';
import { validateQuery } from '../middleware/validation';
import { profileSearchSchema } from '../validation';

const router = Router();
const controller = new ProfileController();

router.get('/profiles', validateQuery(profileSearchSchema), (req, res, next) => {
  void controller.searchProfiles(req, res, next);
});

export default router;
