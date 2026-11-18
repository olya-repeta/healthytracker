import { z } from 'zod';

export const previewImageSchema = z.object({
  url: z.string().min(1, 'Вкажіть URL-посилання'),
});

export const createMedicationSchema = z.object({
  name: z
    .string()
    .min(2, 'Введіть назву препарату (щонайменше 2 символи)')
    .max(120, 'Назва препарату занадто довга'),
  dosage: z
    .string()
    .min(1, 'Вкажіть дозування та інструкцію прийому')
    .max(250, 'Опис дозування занадто довгий'),
  sourceUrl: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  frequencyType: z.enum(['DAILY', 'WEEKLY']),
  timesPerDay: z.number().int().min(1).max(10).default(1),
  timesOfDay: z
    .array(
      z
        .string()
        .regex(/^\d{2}:\d{2}$/, 'Час прийому має бути у форматі HH:mm')
    )
    .min(1, 'Оберіть хоча б один час прийому')
    .default(['06:00']),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .default([0, 1, 2, 3, 4, 5, 6]),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата початку має бути у форматі YYYY-MM-DD'),
  durationDays: z
    .number()
    .int()
    .min(1, 'Тривалість курсу має бути щонайменше 1 день')
    .max(365, 'Тривалість курсу не може перевищувати 365 днів'),
});

export type CreateMedicationDto = z.infer<typeof createMedicationSchema>;
export type PreviewImageDto = z.infer<typeof previewImageSchema>;
