import { Medication } from '@prisma/client';
import { AppError } from '../../middlewares/error.middleware';
import {
  DEFAULT_MEDICATION_IMAGE,
  scraperService,
} from '../scraper/scraper.service';
import { scheduleService } from '../schedule/schedule.service';
import { CreateMedicationDto } from './medications.dto';
import { medicationsRepository } from './medications.repository';

export class MedicationsService {
  async previewImage(url: string) {
    return scraperService.extractPreviewFromUrl(url);
  }

  async createMedication(userId: string, dto: CreateMedicationDto) {
    if (
      dto.frequencyType === 'WEEKLY' &&
      (!dto.daysOfWeek || dto.daysOfWeek.length === 0)
    ) {
      throw new AppError(
        'Для тижневого графіка необхідно обрати хоча б один день тижня',
        400
      );
    }

    // Якщо користувач вказав посилання, але прев'ю ще не було передане — парсимо автоматично
    let finalImageUrl = dto.imageUrl?.trim() || '';
    if (!finalImageUrl && dto.sourceUrl?.trim()) {
      const preview = await scraperService.extractPreviewFromUrl(dto.sourceUrl);
      finalImageUrl = preview.imageUrl;
    }
    if (!finalImageUrl) {
      finalImageUrl = DEFAULT_MEDICATION_IMAGE;
    }

    const effectiveDays =
      dto.frequencyType === 'DAILY'
        ? [0, 1, 2, 3, 4, 5, 6]
        : Array.from(new Set(dto.daysOfWeek)).sort();

    const endDate = scheduleService.addDaysToDateString(
      dto.startDate,
      dto.durationDays - 1
    );

    const created = await medicationsRepository.create({
      userId,
      name: dto.name.trim(),
      dosage: dto.dosage.trim(),
      sourceUrl: dto.sourceUrl?.trim() || null,
      imageUrl: finalImageUrl,
      frequencyType: dto.frequencyType,
      timesPerDay: dto.timesOfDay.length,
      timesOfDay: JSON.stringify(dto.timesOfDay),
      daysOfWeek: JSON.stringify(effectiveDays),
      startDate: dto.startDate,
      durationDays: dto.durationDays,
      endDate,
    });

    const generatedDosesCount =
      await scheduleService.generateScheduleForMedication({
        medicationId: created.id,
        userId,
        frequencyType: dto.frequencyType,
        timesOfDay: dto.timesOfDay,
        daysOfWeek: effectiveDays,
        startDate: dto.startDate,
        durationDays: dto.durationDays,
      });

    return {
      medication: this.formatMedication(created),
      generatedDosesCount,
    };
  }

  async listUserMedications(userId: string) {
    const list = await medicationsRepository.findAllByUser(userId);
    return list.map((item) => this.formatMedication(item));
  }

  async deleteMedication(userId: string, medicationId: string) {
    const existing = await medicationsRepository.findByIdAndUser(
      medicationId,
      userId
    );
    if (!existing) {
      throw new AppError('Препарат не знайдено', 404);
    }
    await medicationsRepository.deleteById(medicationId);
  }

  private formatMedication(med: Medication) {
    return {
      id: med.id,
      userId: med.userId,
      name: med.name,
      dosage: med.dosage,
      sourceUrl: med.sourceUrl,
      imageUrl: med.imageUrl,
      frequencyType: med.frequencyType as 'DAILY' | 'WEEKLY',
      timesPerDay: med.timesPerDay,
      timesOfDay: JSON.parse(med.timesOfDay) as string[],
      daysOfWeek: JSON.parse(med.daysOfWeek) as number[],
      startDate: med.startDate,
      durationDays: med.durationDays,
      endDate: med.endDate,
      createdAt: med.createdAt,
    };
  }
}

export const medicationsService = new MedicationsService();
