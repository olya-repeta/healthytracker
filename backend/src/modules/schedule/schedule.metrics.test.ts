import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FeedbackStore } from './feedback.store';
import { createFeedbackSchema } from './schedule.dto';
import { scheduleService } from './schedule.service';
import { prisma } from '../../config/prisma';

describe('FeedbackStore Unit Tests', () => {
  let store: FeedbackStore;

  beforeEach(() => {
    // Create an in-memory test store by pointing to a test file path
    store = new FeedbackStore();
    store.clear();
  });

  test('successfully adds a feedback entry with rating and comment', () => {
    const item = store.add({
      type: 'feedback',
      rating: 5,
      comment: 'Дуже зручний трекер!',
      userId: 'user-1',
    });

    assert.ok(item.id);
    assert.strictEqual(item.type, 'feedback');
    assert.strictEqual(item.rating, 5);
    assert.strictEqual(item.comment, 'Дуже зручний трекер!');
    assert.strictEqual(item.userId, 'user-1');
    assert.ok(item.createdAt);

    const stats = store.getStats();
    assert.strictEqual(stats.feedbackCount, 1);
    assert.strictEqual(stats.donateClicks, 0);
  });

  test('successfully records donate_click without rating or comment', () => {
    const item = store.add({
      type: 'donate_click',
    });

    assert.strictEqual(item.type, 'donate_click');
    assert.strictEqual(item.rating, null);
    assert.strictEqual(item.comment, null);

    const stats = store.getStats();
    assert.strictEqual(stats.feedbackCount, 0);
    assert.strictEqual(stats.donateClicks, 1);
  });

  test('correctly calculates stats for mixed feedback and donate clicks', () => {
    store.add({ type: 'feedback', rating: 4, comment: 'Добре' });
    store.add({ type: 'feedback', rating: 5, comment: 'Супер' });
    store.add({ type: 'donate_click' });
    store.add({ type: 'donate_click' });
    store.add({ type: 'donate_click' });

    const stats = store.getStats();
    assert.strictEqual(stats.feedbackCount, 2);
    assert.strictEqual(stats.donateClicks, 3);
    assert.strictEqual(stats.totalEntries, 5);
  });
});

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

describe('Product Metrics & Retention Unit Tests', () => {
  test('returns 0% retention and 0% conversion safely when there are 0 users', async () => {
    (prisma.user as any).count = async () => 0;
    (prisma.medication as any).count = async () => 0;
    (prisma.doseSchedule as any).count = async () => 0;
    (prisma.user as any).findMany = async () => [];

    const metrics = await scheduleService.getProductMetrics();

    assert.strictEqual(metrics.totalUsers, 0);
    assert.strictEqual(metrics.activeCourses, 0);
    assert.strictEqual(metrics.takenDoses, 0);
    assert.strictEqual(metrics.retentionPercent, 0);
    assert.strictEqual(metrics.conversionPercent, 0);
  });

  test('correctly calculates Day-7 retention when users have actions >= 7 days', async () => {
    const now = new Date();
    const day0 = new Date(now.getTime() - 10 * 86400000); // 10 days ago
    const day8Action = new Date(day0.getTime() + 8 * 86400000); // 8 days after user creation
    const day2Action = new Date(day0.getTime() + 2 * 86400000); // 2 days after user creation

    (prisma.user as any).count = async () => 2;
    (prisma.medication as any).count = async () => 4;
    (prisma.doseSchedule as any).count = async () => 15;
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
  });
});
