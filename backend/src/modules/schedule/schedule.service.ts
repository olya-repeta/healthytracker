import { AppError } from '../../middlewares/error.middleware';
import { prisma } from '../../config/prisma';
import { feedbackStore } from './feedback.store';
import { CreateFeedbackDto } from './schedule.dto';
import {
  CreateDoseScheduleInput,
  scheduleRepository,
} from './schedule.repository';

export interface GenerateScheduleParams {
  medicationId: string;
  userId: string;
  frequencyType: 'DAILY' | 'WEEKLY';
  timesOfDay: string[];
  daysOfWeek: number[]; // 0 (Нд) .. 6 (Сб)
  startDate: string; // YYYY-MM-DD
  durationDays: number;
}

export class ScheduleService {
  /**
   * Додає N днів до рядка дати формату YYYY-MM-DD без похибок часових поясів
   */
  public addDaysToDateString(dateStr: string, daysToAdd: number): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day + daysToAdd));
    const y = utcDate.getUTCFullYear();
    const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(utcDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Повертає день тижня (0 = Неділя .. 6 = Субота) для рядка YYYY-MM-DD
   */
  public getDayOfWeek(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    return utcDate.getUTCDay();
  }

  /**
   * Формує масив записів прийому на весь курс і зберігає їх у БД
   */
  async generateScheduleForMedication(
    params: GenerateScheduleParams
  ): Promise<number> {
    const entries: CreateDoseScheduleInput[] = [];
    const sortedTimes = [...params.timesOfDay].sort();

    for (let dayOffset = 0; dayOffset < params.durationDays; dayOffset++) {
      const currentDate = this.addDaysToDateString(params.startDate, dayOffset);
      const dayOfWeek = this.getDayOfWeek(currentDate);

      const shouldScheduleToday =
        params.frequencyType === 'DAILY' ||
        params.daysOfWeek.includes(dayOfWeek);

      if (shouldScheduleToday) {
        for (const timeStr of sortedTimes) {
          entries.push({
            medicationId: params.medicationId,
            userId: params.userId,
            scheduledDate: currentDate,
            scheduledTime: timeStr,
            status: 'PENDING',
          });
        }
      }
    }

    return scheduleRepository.createMany(entries);
  }

  async getDosesByDate(userId: string, date: string) {
    const items = await scheduleRepository.findByDate(userId, date);
    return items.map((item) => this.formatDoseItem(item));
  }

  async getDosesByRange(userId: string, from: string, to: string) {
    const items = await scheduleRepository.findByDateRange(userId, from, to);
    const formatted = items.map((item) => this.formatDoseItem(item));

    // Групування за датами для зручності календаря та бічної панелі
    const groupedByDate: Record<
      string,
      {
        date: string;
        total: number;
        taken: number;
        skipped: number;
        pending: number;
        allCompleted: boolean;
        hasSkipped: boolean;
        doses: ReturnType<typeof ScheduleService.prototype.formatDoseItem>[];
      }
    > = {};

    for (const dose of formatted) {
      if (!groupedByDate[dose.scheduledDate]) {
        groupedByDate[dose.scheduledDate] = {
          date: dose.scheduledDate,
          total: 0,
          taken: 0,
          skipped: 0,
          pending: 0,
          allCompleted: false,
          hasSkipped: false,
          doses: [],
        };
      }
      const group = groupedByDate[dose.scheduledDate];
      group.total += 1;
      if (dose.status === 'TAKEN') group.taken += 1;
      else if (dose.status === 'SKIPPED') group.skipped += 1;
      else group.pending += 1;
      group.doses.push(dose);
    }

    for (const key of Object.keys(groupedByDate)) {
      const g = groupedByDate[key];
      g.allCompleted = g.total > 0 && g.taken === g.total;
      g.hasSkipped = g.skipped > 0;
    }

    return {
      from,
      to,
      doses: formatted,
      days: groupedByDate,
    };
  }

  async updateDoseStatus(
    userId: string,
    scheduleId: string,
    status: 'PENDING' | 'TAKEN' | 'SKIPPED'
  ) {
    const existing = await scheduleRepository.findByIdAndUser(
      scheduleId,
      userId
    );
    if (!existing) {
      throw new AppError('Запис розкладу не знайдено', 404);
    }

    const updated = await scheduleRepository.updateStatus(scheduleId, status);
    return this.formatDoseItem(updated);
  }

  async getAdherenceStats(userId: string, referenceDate?: string) {
    const todayStr =
      referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
        ? referenceDate
        : new Date().toISOString().slice(0, 10);

    const weekStart = this.addDaysToDateString(todayStr, -6);
    const monthStart = this.addDaysToDateString(todayStr, -29);
    const weekEnd = this.addDaysToDateString(todayStr, 7);

    const weekItems = await scheduleRepository.findByDateRange(
      userId,
      weekStart,
      weekEnd
    );
    const monthItems = await scheduleRepository.findByDateRange(
      userId,
      monthStart,
      todayStr
    );

    const calcRate = (
      list: Awaited<ReturnType<typeof scheduleRepository.findByDateRange>>,
      upToDate: string
    ) => {
      // Враховуємо всі дози до сьогодні включно або вже відмічені
      const relevant = list.filter(
        (d) => d.scheduledDate <= upToDate || d.status !== 'PENDING'
      );
      const total = relevant.length;
      const taken = relevant.filter((d) => d.status === 'TAKEN').length;
      const skipped = relevant.filter((d) => d.status === 'SKIPPED').length;
      const pending = relevant.filter((d) => d.status === 'PENDING').length;
      const adherencePercent =
        total > 0 ? Math.round((taken / total) * 100) : 100;
      return { total, taken, skipped, pending, adherencePercent };
    };

    return {
      today: todayStr,
      weekly: calcRate(weekItems, todayStr),
      monthly: calcRate(monthItems, todayStr),
    };
  }

  async getProductMetrics() {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [totalUsers, activeCourses, takenDoses, usersWithActions] =
      await Promise.all([
        prisma.user.count(),
        prisma.medication.count({
          where: {
            endDate: { gte: todayStr },
          },
        }),
        prisma.doseSchedule.count({
          where: {
            status: 'TAKEN',
          },
        }),
        prisma.user.findMany({
          select: {
            id: true,
            createdAt: true,
            schedules: {
              where: {
                actionAt: { not: null },
              },
              select: {
                actionAt: true,
              },
            },
          },
        }),
      ]);

    // Day-7 Retention % (частка користувачів, які мають зафіксовані дії DoseSchedule.actionAt на 7-й день або пізніше від User.createdAt)
    let retainedUsersCount = 0;
    for (const user of usersWithActions) {
      const userCreatedDate = new Date(user.createdAt);
      userCreatedDate.setHours(0, 0, 0, 0);

      const hasDay7Action = user.schedules.some((s) => {
        if (!s.actionAt) return false;
        const actionDate = new Date(s.actionAt);
        actionDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (actionDate.getTime() - userCreatedDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return diffDays >= 7;
      });

      if (hasDay7Action) {
        retainedUsersCount++;
      }
    }

    const retentionPercent =
      totalUsers > 0
        ? Math.round((retainedUsersCount / totalUsers) * 1000) / 10
        : 0;

    const { feedbackCount, donateClicks } = feedbackStore.getStats();

    const conversionPercent =
      totalUsers > 0
        ? Math.round((donateClicks / totalUsers) * 1000) / 10
        : 0;

    return {
      totalUsers,
      activeCourses,
      takenDoses,
      retentionPercent,
      feedbackCount,
      donateClicks,
      conversionPercent,
    };
  }

  async saveFeedback(data: CreateFeedbackDto, userId?: string | null) {
    return feedbackStore.add({
      type: data.type,
      rating: data.rating,
      comment: data.comment,
      userId: userId || null,
    });
  }

  private formatDoseItem(
    item: Awaited<ReturnType<typeof scheduleRepository.findByDate>>[number]
  ) {
    return {
      id: item.id,
      medicationId: item.medicationId,
      userId: item.userId,
      scheduledDate: item.scheduledDate,
      scheduledTime: item.scheduledTime,
      status: item.status as 'PENDING' | 'TAKEN' | 'SKIPPED',
      actionAt: item.actionAt,
      medication: {
        id: item.medication.id,
        name: item.medication.name,
        dosage: item.medication.dosage,
        imageUrl: item.medication.imageUrl,
        sourceUrl: item.medication.sourceUrl,
        frequencyType: item.medication.frequencyType,
      },
    };
  }
}

export const scheduleService = new ScheduleService();
