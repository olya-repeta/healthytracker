import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createFeedbackSchema } from './schedule.dto';
import { scheduleService } from './schedule.service';
import { prisma } from '../../config/prisma';

describe('Feedback DTO Validation Tests', () => {
  test('validates valid feedback payload', () => {
    const parsed = createFeedbackSchema.parse({
      type: 'feedback',
      rating: 5,
      comment: 'Все супер!',
    });
    assert.strictEqual(parsed.type, 'feedback');
    assert.strictEqual(parsed.rating, 5);
    assert.strictEqual(parsed.comment, 'Все супер!');
  });

  test('coerces string rating to number', () => {
    const parsed = createFeedbackSchema.parse({
      type: 'feedback',
      rating: '4',
      comment: 'Добре',
    });
    assert.strictEqual(parsed.rating, 4);
  });

  test('rejects rating outside 1..5 range', () => {
    assert.throws(() => {
      createFeedbackSchema.parse({
        type: 'feedback',
        rating: 6,
      });
    });

    assert.throws(() => {
      createFeedbackSchema.parse({
        type: 'feedback',
        rating: 0,
      });
    });
  });

  test('validates donate_click payload without rating or comment', () => {
    const parsed = createFeedbackSchema.parse({
      type: 'donate_click',
    });
    assert.strictEqual(parsed.type, 'donate_click');
  });

  test('rejects unknown type', () => {
    assert.throws(() => {
      createFeedbackSchema.parse({
        type: 'unknown_type',
      });
    });
  });
});

describe('ProductFeedback Prisma Storage & Metrics Unit Tests', () => {
  test('returns 0% retention and 0% conversion safely when there are 0 users', async () => {
    (prisma.user as any).count = async () => 0;
    (prisma.medication as any).count = async () => 0;
    (prisma.doseSchedule as any).count = async () => 0;
    (prisma.productFeedback as any).count = async () => 0;
    (prisma.user as any).findMany = async () => [];

    const metrics = await scheduleService.getProductMetrics();

    assert.strictEqual(metrics.totalUsers, 0);
    assert.strictEqual(metrics.activeCourses, 0);
    assert.strictEqual(metrics.takenDoses, 0);
    assert.strictEqual(metrics.retentionPercent, 0);
    assert.strictEqual(metrics.feedbackCount, 0);
    assert.strictEqual(metrics.donateClicks, 0);
    assert.strictEqual(metrics.conversionPercent, 0);
  });

  test('correctly calculates Day-7 retention and conversion from DB counts', async () => {
    const now = new Date();
    const day0 = new Date(now.getTime() - 10 * 86400000);
    const day8Action = new Date(day0.getTime() + 8 * 86400000);
    const day2Action = new Date(day0.getTime() + 2 * 86400000);

    (prisma.user as any).count = async () => 2;
    (prisma.medication as any).count = async () => 4;
    (prisma.doseSchedule as any).count = async () => 15;
    (prisma.productFeedback as any).count = async (args?: any) => {
      if (args?.where?.type === 'feedback') return 3;
      if (args?.where?.type === 'donate_click') return 1;
      return 4;
    };
    (prisma.user as any).findMany = async () => [
      {
        id: 'user-retained',
        createdAt: day0,
        schedules: [{ actionAt: day8Action }],
      },
      {
        id: 'user-not-retained',
        createdAt: day0,
        schedules: [{ actionAt: day2Action }],
      },
    ];

    const metrics = await scheduleService.getProductMetrics();

    assert.strictEqual(metrics.totalUsers, 2);
    assert.strictEqual(metrics.activeCourses, 4);
    assert.strictEqual(metrics.takenDoses, 15);
    // 1 user retained out of 2 users = 50%
    assert.strictEqual(metrics.retentionPercent, 50);
    assert.strictEqual(metrics.feedbackCount, 3);
    assert.strictEqual(metrics.donateClicks, 1);
    // 1 donate click / 2 users = 50%
    assert.strictEqual(metrics.conversionPercent, 50);
  });

  test('saves feedback record to prisma productFeedback table', async () => {
    let capturedData: any = null;
    (prisma.productFeedback as any).create = async (args: any) => {
      capturedData = args.data;
      return { id: 'test-feedback-uuid', ...args.data, createdAt: new Date() };
    };

    const res = await scheduleService.saveFeedback(
      {
        type: 'feedback',
        rating: 5,
        comment: 'Чудовий трекер!',
      },
      'test-user-id'
    );

    assert.strictEqual(res.id, 'test-feedback-uuid');
    assert.strictEqual(capturedData.type, 'feedback');
    assert.strictEqual(capturedData.rating, 5);
    assert.strictEqual(capturedData.comment, 'Чудовий трекер!');
    assert.strictEqual(capturedData.userId, 'test-user-id');
  });

  test('saves donate_click record to prisma productFeedback table without rating or comment', async () => {
    let capturedData: any = null;
    (prisma.productFeedback as any).create = async (args: any) => {
      capturedData = args.data;
      return { id: 'test-click-uuid', ...args.data, createdAt: new Date() };
    };

    const res = await scheduleService.saveFeedback(
      {
        type: 'donate_click',
      },
      null
    );

    assert.strictEqual(res.id, 'test-click-uuid');
    assert.strictEqual(capturedData.type, 'donate_click');
    assert.strictEqual(capturedData.rating, null);
    assert.strictEqual(capturedData.comment, null);
    assert.strictEqual(capturedData.userId, null);
  });
});
