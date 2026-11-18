import { createApp } from './app';
import { env } from './config/env';
import { initTelegramCron } from './modules/telegram/telegram.cron';

const app = createApp();

// Запуск щохвилинного планувальника нагадувань у Telegram
initTelegramCron();

app.listen(env.PORT, () => {
  console.log(
    `[MedTracker Backend] Сервер успішно запущено на http://localhost:${env.PORT}`
  );
});
