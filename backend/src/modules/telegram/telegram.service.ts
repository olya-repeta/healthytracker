import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class TelegramService {
  /**
   * Генерує безпечний одноразовий токен прив'язки, зберігає часовий пояс та повертає посилання на бота
   */
  async generateLinkUrl(userId: string, timezone?: string): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    const validTimezone = timezone?.trim() || 'Europe/Kyiv';

    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramLinkToken: token,
        timezone: validTimezone,
      },
    });

    const botUsername = (
      process.env.TELEGRAM_BOT_USERNAME ||
      env.TELEGRAM_BOT_USERNAME ||
      ''
    ).replace(/^@/, '');

    return `https://t.me/${botUsername}?start=${token}`;
  }

  /**
   * Відв'язує Telegram від акаунта користувача
   */
  async unlink(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null,
        telegramLinkToken: null,
      },
    });
  }

  /**
   * Безпечно відправляє текстове повідомлення у Telegram з підтримкою HTML-розмітки
   */
  async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn('[Telegram Service] TELEGRAM_BOT_TOKEN не налаштовано');
      return false;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
          }),
        }
      );

      if (!response.ok) {
        const errDetails = await response.text();
        console.error(
          `[Telegram Service] Помилка відправки (${response.status}): ${errDetails}`
        );
        return false;
      }

      return true;
    } catch (err) {
      console.error('[Telegram Service] Мережева помилка відправки у Telegram:', err);
      return false;
    }
  }

  /**
   * Обробляє вхідні оновлення від Telegram Webhook (/start <token>)
   */
  async handleWebhookUpdate(update: any): Promise<void> {
    const message = update?.message;
    if (!message || !message.text) {
      return;
    }

    const text = message.text.trim();
    const chatId = String(message.chat.id);

    if (!text.startsWith('/start')) {
      return;
    }

    const parts = text.split(/\s+/);
    const token = parts[1]?.trim();

    if (!token) {
      await this.sendMessage(
        chatId,
        '👋 <b>Вітаємо у VitaTrack!</b>\n\n' +
          'Для підключення нагадувань перейдіть у свій профіль у додатку VitaTrack та натисніть кнопку <b>«Підключити Telegram»</b>.'
      );
      return;
    }

    const user = await prisma.user.findUnique({
      where: { telegramLinkToken: token },
    });

    if (!user) {
      await this.sendMessage(
        chatId,
        '⚠️ <b>Посилання недійсне або застаріло</b>\n\n' +
          'Будь ласка, відкрийте додаток VitaTrack та згенеруйте нове посилання для прив\'язки Telegram.'
      );
      return;
    }

    // Прив'язуємо telegramChatId та очищаємо використаний токен
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: chatId,
        telegramLinkToken: null,
      },
    });

    await this.sendMessage(
      chatId,
      `✅ <b>Telegram успішно підключено!</b>\n\n` +
        `Вітаємо, <b>${escapeHtml(user.name)}</b>! Тепер ви отримуватимете своєчасні нагадування про прийом ліків та вітамінів у цей чат.`
    );
  }
}

export const telegramService = new TelegramService();
