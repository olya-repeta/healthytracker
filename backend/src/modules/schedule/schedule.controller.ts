import { Request, Response, NextFunction } from 'express';
import {
  dateRangeQuerySchema,
  singleDateQuerySchema,
  updateDoseStatusSchema,
} from './schedule.dto';
import { scheduleService } from './schedule.service';

export class ScheduleController {
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
