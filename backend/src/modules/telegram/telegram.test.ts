import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { getUserLocalDateTime } from './telegram.cron';
import { telegramService } from './telegram.service';
import { prisma } from '../../config/prisma';

describe('Telegram Cron & Timezone Calculation', () => {
  test('correctly converts UTC timestamp to Europe/Kyiv date and time', () => {
    // 2026-11-18 10:15 UTC -> Europe/Kyiv is UTC+2 in winter -> 12:15
    const utcDate = new Date('2026-11-18T10:15:00Z');
    const { dateStr, timeStr } = getUserLocalDateTime(utcDate, 'Europe/Kyiv');
    assert.strictEqual(dateStr, '2026-11-18');
    assert.strictEqual(timeStr, '12:15');
  });

  test('correctly converts UTC timestamp across midnight boundary', () => {
    // 2026-11-18 23:45 UTC -> Europe/Kyiv is UTC+2 -> 2026-11-19 01:45
    const utcDate = new Date('2026-11-18T23:45:00Z');
    const { dateStr, timeStr } = getUserLocalDateTime(utcDate, 'Europe/Kyiv');
    assert.strictEqual(dateStr, '2026-11-19');
    assert.strictEqual(timeStr, '01:45');
  });

  test('correctly handles different timezones (e.g. America/New_York)', () => {
    // 2026-11-18 15:30 UTC -> New York is UTC-5 in winter -> 10:30
    const utcDate = new Date('2026-11-18T15:30:00Z');
    const { dateStr, timeStr } = getUserLocalDateTime(utcDate, 'America/New_York');
    assert.strictEqual(dateStr, '2026-11-18');
    assert.strictEqual(timeStr, '10:30');
  });

  test('falls back gracefully to Europe/Kyiv on invalid timezone', () => {
    const utcDate = new Date('2026-11-18T10:00:00Z');
    const { dateStr, timeStr } = getUserLocalDateTime(utcDate, 'Invalid/Timezone');
    assert.strictEqual(dateStr, '2026-11-18');
    assert.strictEqual(timeStr, '12:00');
  });
});

describe('Telegram Service Unit Tests', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('sendMessage handles successful Telegram Bot API response', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';

    let capturedUrl = '';
    let capturedBody: any = null;

    globalThis.fetch = async (input: any, init?: any) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const success = await telegramService.sendMessage('12345678', '<b>Привіт</b>');
    assert.strictEqual(success, true);
    assert.strictEqual(capturedUrl, 'https://api.telegram.org/bottest-bot-token/sendMessage');
    assert.strictEqual(capturedBody.chat_id, '12345678');
    assert.strictEqual(capturedBody.text, '<b>Привіт</b>');
    assert.strictEqual(capturedBody.parse_mode, 'HTML');
  });

  test('sendMessage returns false when bot token is missing or API errors', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const resNoToken = await telegramService.sendMessage('123456', 'test');
    assert.strictEqual(resNoToken, false);

    process.env.TELEGRAM_BOT_TOKEN = 'token';
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ ok: false, description: 'Forbidden' }), {
        status: 403,
      });
    };

    const resError = await telegramService.sendMessage('123456', 'test');
    assert.strictEqual(resError, false);
  });

  test('generateLinkUrl generates valid URL and updates user', async () => {
    process.env.TELEGRAM_BOT_USERNAME = '@vitatrack_reminder_bot';

    let capturedArgs: any = null;
    (prisma.user as any).update = async (args: any) => {
      capturedArgs = args;
      return { id: args.where.id };
    };

    const url = await telegramService.generateLinkUrl('user-123', 'Europe/Kyiv');
    assert.match(url, /^https:\/\/t\.me\/vitatrack_reminder_bot\?start=[a-f0-9]{48}$/);
    assert.ok(capturedArgs);
    assert.strictEqual(capturedArgs.where.id, 'user-123');
    assert.strictEqual(capturedArgs.data.timezone, 'Europe/Kyiv');
    assert.ok(capturedArgs.data.telegramLinkToken);
  });

  test('unlink clears telegramChatId and telegramLinkToken', async () => {
    let capturedArgs: any = null;
    (prisma.user as any).update = async (args: any) => {
      capturedArgs = args;
      return { id: args.where.id };
    };

    await telegramService.unlink('user-456');
    assert.ok(capturedArgs);
    assert.strictEqual(capturedArgs.where.id, 'user-456');
    assert.strictEqual(capturedArgs.data.telegramChatId, null);
    assert.strictEqual(capturedArgs.data.telegramLinkToken, null);
  });

  test('handleWebhookUpdate successfully links user upon receiving valid token in /start', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }));

    (prisma.user as any).findUnique = async () => {
      return {
        id: 'user-789',
        name: 'Олена',
        telegramLinkToken: 'valid-token-123',
      };
    };

    let capturedUpdateArgs: any = null;
    (prisma.user as any).update = async (args: any) => {
      capturedUpdateArgs = args;
      return { id: args.where.id };
    };

    await telegramService.handleWebhookUpdate({
      message: {
        chat: { id: 998877 },
        text: '/start valid-token-123',
      },
    });

    assert.ok(capturedUpdateArgs);
    assert.strictEqual(capturedUpdateArgs.where.id, 'user-789');
    assert.strictEqual(capturedUpdateArgs.data.telegramChatId, '998877');
    assert.strictEqual(capturedUpdateArgs.data.telegramLinkToken, null);
  });
});
