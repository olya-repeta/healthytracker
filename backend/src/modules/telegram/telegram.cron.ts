import cron from 'node-cron';
import { prisma } from '../../config/prisma';
import { telegramService } from './telegram.service';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Розраховує локальні YYYY-MM-DD та HH:mm для користувача за його часовим поясом
 */
export function getUserLocalDateTime(
  now: Date,
  timezone: string
): { dateStr: string; timeStr: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(now).map((p) => [p.type, p.value])
    );
    return {
      dateStr: `${parts.year}-${parts.month}-${parts.day}`,
      timeStr: `${parts.hour}:${parts.minute}`,
    };
  } catch {
    const fallbackFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(
      fallbackFormatter.formatToParts(now).map((p) => [p.type, p.value])
    );
    return {
      dateStr: `${parts.year}-${parts.month}-${parts.day}`,
      timeStr: `${parts.hour}:${parts.minute}`,
    };
  }
}

/**
 * Перевіряє заплановані прийоми та відправляє сповіщення в Telegram
 */
export async function checkAndSendReminders(): Promise<void> {
  const pendingDoses = await prisma.doseSchedule.findMany({
    where: {
      status: 'PENDING',
      notifiedAt: null,
      user: {
        telegramChatId: { not: null },
      },
    },
    include: {
      user: {
        select: {
          telegramChatId: true,
          timezone: true,
        },
      },
      medication: {
        select: {
          name: true,
          dosage: true,
        },
      },
    },
  });

  if (pendingDoses.length === 0) {
    return;
  }

  const now = new Date();

  for (const dose of pendingDoses) {
    const chatId = dose.user.telegramChatId;
    if (!chatId) continue;

    const { dateStr, timeStr } = getUserLocalDateTime(
      now,
      dose.user.timezone || 'Europe/Kyiv'
    );

    // Перевіряємо точний збіг дати та хвилини
    if (dose.scheduledDate === dateStr && dose.scheduledTime === timeStr) {
      const message =
        `⏰ <b>Нагадування про прийом ліків</b>\n\n` +
        `💊 <b>Препарат:</b> ${escapeHtml(dose.medication.name)}\n` +
        `📝 <b>Дозування:</b> ${escapeHtml(dose.medication.dosage)}\n` +
        `🕒 <b>Час прийому:</b> ${dose.scheduledTime}\n\n` +
        `Будь ласка, прийміть препарат та відмітьте його у VitaTrack!`;

      try {
        const sent = await telegramService.sendMessage(chatId, message);
        if (sent) {
          await prisma.doseSchedule.update({
            where: { id: dose.id },
            data: { notifiedAt: new Date() },
          });
          console.log(
            `[Telegram Cron] Надіслано нагадування для дози ${dose.id} (${dose.medication.name}) користувачу ${chatId}`
          );
        }
      } catch (sendErr) {
        console.error(
          `[Telegram Cron] Не вдалося надіслати сповіщення для дози ${dose.id}:`,
          sendErr
        );
      }
    }
  }
}

/**
 * Ініціалізує щохвилинний запуск cron планувальника
 */
export function initTelegramCron(): void {
  cron.schedule('0 * * * * *', async () => {
    try {
      await checkAndSendReminders();
    } catch (err) {
      console.error('[Telegram Cron] Помилка виконання перевірки нагадувань:', err);
    }
  });

  console.log(
    '[Telegram Cron] Планувальник сповіщень успішно ініціалізовано (0 * * * * *)'
  );
}
