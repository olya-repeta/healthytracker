import { z } from 'zod';

export const updateDoseStatusSchema = z.object({
  status: z.enum(['PENDING', 'TAKEN', 'SKIPPED'], {
    errorMap: () => ({
      message: 'Статус має бути одним із: PENDING, TAKEN, SKIPPED',
    }),
  }),
});

export const dateRangeQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат дати from має бути YYYY-MM-DD'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат дати to має бути YYYY-MM-DD'),
});

export const singleDateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат дати має бути YYYY-MM-DD'),
});

export const createFeedbackSchema = z.object({
  type: z.enum(['feedback', 'donate_click'], {
    errorMap: () => ({ message: "Тип має бути 'feedback' або 'donate_click'" }),
  }),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
});

export type UpdateDoseStatusDto = z.infer<typeof updateDoseStatusSchema>;
export type CreateFeedbackDto = z.infer<typeof createFeedbackSchema>;
