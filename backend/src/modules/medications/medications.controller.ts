import { Request, Response, NextFunction } from 'express';
import {
  createMedicationSchema,
  previewImageSchema,
} from './medications.dto';
import { medicationsService } from './medications.service';

export class MedicationsController {
  async previewImage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const rawUrl =
        typeof req.body?.url === 'string'
          ? req.body.url
          : typeof req.query?.url === 'string'
          ? req.query.url
          : '';
      const { url } = previewImageSchema.parse({ url: rawUrl });
      const result = await medicationsService.previewImage(url);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const dto = createMedicationSchema.parse(req.body);
      const result = await medicationsService.createMedication(userId, dto);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const medications = await medicationsService.listUserMedications(userId);
      res.status(200).json({ medications });
    } catch (error) {
      next(error);
    }
  }

  async remove(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const medicationId = String(req.params.id);
      await medicationsService.deleteMedication(userId, medicationId);
      res.status(200).json({ message: 'Препарат успішно видалено' });
    } catch (error) {
      next(error);
    }
  }
}

export const medicationsController = new MedicationsController();
