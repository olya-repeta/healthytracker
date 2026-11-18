import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { telegramService } from './telegram.service';
import { env } from '../../config/env';

const router = Router();

/**
 * POST /api/telegram/link
 * Захищений JWT. Генерує посилання для прив'язки бота у Telegram
 */
router.post(
  '/link',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { timezone } = req.body || {};
      const url = await telegramService.generateLinkUrl(userId, timezone);
      res.status(200).json({ url });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/telegram/link
 * Захищений JWT. Відв'язує Telegram від акаунта
 */
router.delete(
  '/link',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await telegramService.unlink(userId);
      res.status(200).json({ success: true, message: 'Telegram успішно відключено' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/telegram/webhook
 * Публічний ендпоінт для отримання оновлень від Telegram Bot API.
 * Завжди відповідає HTTP 200, перевіряючи заголовок секретного токена.
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const secret =
    process.env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = req.headers['x-telegram-bot-api-secret-token'];

  if (secret && headerSecret !== secret) {
    console.warn('[Telegram Webhook] Недійсний X-Telegram-Bot-Api-Secret-Token');
    res.status(200).json({ ok: false, error: 'Unauthorized secret' });
    return;
  }

  try {
    await telegramService.handleWebhookUpdate(req.body);
  } catch (err) {
    console.error('[Telegram Webhook] Помилка обробки оновлення Telegram:', err);
  }

  res.status(200).json({ ok: true });
});

export default router;
