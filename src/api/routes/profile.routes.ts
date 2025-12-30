import { Router } from 'express';
import type { Container } from 'inversify';
import { ProfileController } from '../controllers';
import { validateQuery } from '../middleware/validation';
import { profileSearchSchema } from '../validation';

export const createProfileRoutes = (container: Container): Router => {
  const router = Router();
  const controller = container.get(ProfileController);

  router.get('/profiles', validateQuery(profileSearchSchema), (req, res, next) => {
    controller.searchProfiles(req, res, next).catch(next);
  });

  return router;
};

export default createProfileRoutes;
