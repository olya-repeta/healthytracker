import { prisma } from '../../config/prisma';
import { Medication } from '@prisma/client';

export interface CreateMedicationRecordInput {
  userId: string;
  name: string;
  dosage: string;
  sourceUrl: string | null;
  imageUrl: string;
  frequencyType: 'DAILY' | 'WEEKLY';
  timesPerDay: number;
  timesOfDay: string;
  daysOfWeek: string;
  startDate: string;
  durationDays: number;
  endDate: string;
}

export class MedicationsRepository {
  async create(data: CreateMedicationRecordInput): Promise<Medication> {
    return prisma.medication.create({
      data,
    });
  }

  async findAllByUser(userId: string): Promise<Medication[]> {
    return prisma.medication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdAndUser(
    id: string,
    userId: string
  ): Promise<Medication | null> {
    return prisma.medication.findFirst({
      where: { id, userId },
    });
  }

  async deleteById(id: string): Promise<void> {
    await prisma.medication.delete({
      where: { id },
    });
  }
}

export const medicationsRepository = new MedicationsRepository();
