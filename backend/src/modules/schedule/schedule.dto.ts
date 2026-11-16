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

export type UpdateDoseStatusDto = z.infer<typeof updateDoseStatusSchema>;
