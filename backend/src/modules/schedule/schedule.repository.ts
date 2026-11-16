import { prisma } from '../../config/prisma';

export interface CreateDoseScheduleInput {
  medicationId: string;
  userId: string;
  scheduledDate: string;
  scheduledTime: string;
  status?: string;
}

export class ScheduleRepository {
  async createMany(entries: CreateDoseScheduleInput[]): Promise<number> {
    if (entries.length === 0) return 0;
    const result = await prisma.doseSchedule.createMany({
      data: entries.map((e) => ({
        medicationId: e.medicationId,
        userId: e.userId,
        scheduledDate: e.scheduledDate,
        scheduledTime: e.scheduledTime,
        status: e.status || 'PENDING',
      })),
    });
    return result.count;
  }

  async findByDate(userId: string, date: string) {
    return prisma.doseSchedule.findMany({
      where: {
        userId,
        scheduledDate: date,
      },
      include: {
        medication: true,
      },
      orderBy: [{ scheduledTime: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findByDateRange(userId: string, from: string, to: string) {
    return prisma.doseSchedule.findMany({
      where: {
        userId,
        scheduledDate: {
          gte: from,
          lte: to,
        },
      },
      include: {
        medication: true,
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { scheduledTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async findByIdAndUser(id: string, userId: string) {
    return prisma.doseSchedule.findFirst({
      where: { id, userId },
      include: {
        medication: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: 'PENDING' | 'TAKEN' | 'SKIPPED'
  ) {
    return prisma.doseSchedule.update({
      where: { id },
      data: {
        status,
        actionAt: status === 'PENDING' ? null : new Date(),
      },
      include: {
        medication: true,
      },
    });
  }
}

export const scheduleRepository = new ScheduleRepository();
