import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JwtUserPayload } from '../../middlewares/auth.middleware';
import {
  createFeedbackSchema,
  dateRangeQuerySchema,
  singleDateQuerySchema,
  updateDoseStatusSchema,
} from './schedule.dto';
import { scheduleService } from './schedule.service';

export class ScheduleController {
  async getProductMetrics(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const metrics = await scheduleService.getProductMetrics();
      res.status(200).json(metrics);
    } catch (error) {
      next(error);
    }
  }

  async submitFeedback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dto = createFeedbackSchema.parse(req.body);

      let userId = req.user?.userId || null;
      if (!userId && req.headers.authorization?.startsWith('Bearer ')) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, env.JWT_SECRET) as JwtUserPayload;
          userId = decoded.userId;
        } catch {
          // Ігноруємо помилки перевірки токена для публічного відгуку
        }
      }

      const item = await scheduleService.saveFeedback(dto, userId);
      res.status(201).json({
        success: true,
        message:
          dto.type === 'donate_click'
            ? 'Клік на підтримку зафіксовано'
            : 'Дякуємо за ваш відгук!',
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFeedback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const feedbackId = String(req.params.id);
      await scheduleService.deleteFeedback(feedbackId, userId);
      res.status(200).json({ success: true, message: "Відгук видалено" });
    } catch (error) {
      next(error);
    }
  }

  async getByDate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { date } = singleDateQuerySchema.parse(req.query);
      const doses = await scheduleService.getDosesByDate(userId, date);
      res.status(200).json({ date, doses });
    } catch (error) {
      next(error);
    }
  }

  async getByRange(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { from, to } = dateRangeQuerySchema.parse(req.query);
      const result = await scheduleService.getDosesByRange(userId, from, to);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const refDate =
        typeof req.query.date === 'string' ? req.query.date : undefined;
      const stats = await scheduleService.getAdherenceStats(userId, refDate);
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const scheduleId = String(req.params.id);
      const { status } = updateDoseStatusSchema.parse(req.body);
      const updated = await scheduleService.updateDoseStatus(
        userId,
        scheduleId,
        status
      );
      res.status(200).json({ dose: updated });
    } catch (error) {
      next(error);
    }
  }
}

export const scheduleController = new ScheduleController();
