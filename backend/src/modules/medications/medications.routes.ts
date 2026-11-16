import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { medicationsController } from './medications.controller';

const router = Router();

router.use(authMiddleware);

router.post('/preview-image', (req, res, next) =>
  medicationsController.previewImage(req, res, next)
);
router.get('/preview-image', (req, res, next) =>
  medicationsController.previewImage(req, res, next)
);
router.post('/', (req, res, next) =>
  medicationsController.create(req, res, next)
);
router.get('/', (req, res, next) =>
  medicationsController.list(req, res, next)
);
router.delete('/:id', (req, res, next) =>
  medicationsController.remove(req, res, next)
);

export default router;
