import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(
    `[MedTracker Backend] Сервер успішно запущено на http://localhost:${env.PORT}`
  );
});
