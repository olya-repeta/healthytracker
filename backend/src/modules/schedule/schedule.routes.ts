import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { scheduleController } from './schedule.controller';

const router = Router();

router.use(authMiddleware);

router.get('/by-date', (req, res, next) =>
  scheduleController.getByDate(req, res, next)
);
router.get('/range', (req, res, next) =>
  scheduleController.getByRange(req, res, next)
);
router.get('/stats', (req, res, next) =>
  scheduleController.getStats(req, res, next)
);
router.patch('/:id/status', (req, res, next) =>
  scheduleController.updateStatus(req, res, next)
);

export default router;
