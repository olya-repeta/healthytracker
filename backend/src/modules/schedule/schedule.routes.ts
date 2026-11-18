import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { scheduleController } from './schedule.controller';

const router = Router();

// Публічні ендпоінти метрик валідації (KPI) продукту та відгуку / донату
router.get('/product-metrics', (req, res, next) =>
  scheduleController.getProductMetrics(req, res, next)
);
router.post('/feedback', (req, res, next) =>
  scheduleController.submitFeedback(req, res, next)
);

// Захищені ендпоінти розкладу користувача
router.use(authMiddleware);

router.delete("/feedback/:id", (req, res, next) =>
  scheduleController.deleteFeedback(req, res, next)
);

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
