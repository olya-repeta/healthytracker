# VitaTrack — Трекер прийому ліків та вітамінів

Сучасний вебзастосунок у стилі **Sage Wellness** для відстежування курсу прийому ліків, вітамінів і БАДів, побудований за архітектурою **Modular Monolith** із підтримкою **PWA** (офлайн-режим) та нагадуваннями в **Telegram**.

**Live Demo (HTTPS):** https://13.60.250.145.nip.io

## Архітектура проєкту

- **`/backend`** — Node.js + TypeScript + Express + Prisma ORM + `node-cron` + Cheerio (`og:image` парсер) + `serverless-http` (готовність до AWS Lambda).
  - Модулі в `backend/src/modules/`:
    - `auth` — реєстрація, вхід, Google OAuth, перевірка профілю, видача stateless JWT-токенів.
    - `medications` — управління препаратами користувача, прев'ю зображень за посиланням (`/api/medications/preview-image`), автоматичний запуск генерації розкладу.
    - `schedule` — автоматична генерація розкладу на весь курс (`DoseSchedule`), отримання доз на вибрану дату чи діапазон, зміна статусів (`TAKEN`, `SKIPPED`, `PENDING`), розрахунок статистики за 7 та 30 днів.
    - `scraper` — сервіс витягування `og:image` / `twitter:image` / JSON-LD зображень товарів з інтернет-аптек із SVG-заглушкою.
    - `telegram` — прив'язка Telegram-акаунту через одноразовий deep-link токен, захищений webhook (`/api/telegram/webhook`) та щохвилинний cron-планувальник нагадувань з урахуванням часового поясу користувача.
- **`/frontend`** — React 18 + TypeScript + Vite + Tailwind CSS + Axios + `vite-plugin-pwa`.
  - Типізований API-клієнт у `frontend/src/api/` та спільні DTO у `frontend/src/types/api.ts`.
  - 3 основні вкладки: **«Головна / Мій трекер»**, **«Додати препарат»** та **«Налаштування»** (підключення сповіщень у Telegram та перегляд профілю), а також офлайн-черга синхронізації прийомів.
- **`/infra` та корінь репозиторію** — архітектурна документація та конфігурація інфраструктури (`docker-compose.yml`, `Caddyfile`, `Dockerfile`, `serverless.yml`). Детальну ER-діаграму бази даних PostgreSQL, опис таблиць, взаємодію через Caddy/Nginx та API-контракти дивіться у файлі [`infra/ARCHITECTURE.md`](./infra/ARCHITECTURE.md).

## Швидкий локальний запуск

### 1. Запуск Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```
Сервер запуститься на `http://localhost:4000`.

### 2. Запуск Frontend
```bash
cd frontend
npm install
npm run dev
```
Вебінтерфейс відкриється на `http://localhost:5173`.

## Запуск через Docker Compose
```bash
docker compose up --build
```
- Frontend: `http://localhost` (порт 80 через Caddy)
- Backend API: `http://localhost:4000/api` (або через проксі `http://localhost/api`)

## Налаштування Telegram-бота (Webhook)

Після деплою на продакшн-сервер необхідно одноразово зареєструвати HTTPS-вебхук у Telegram Bot API:
```bash
curl -X POST "[https://api.telegram.org/bot](https://api.telegram.org/bot)<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "[https://13.60.250.145.nip.io/api/telegram/webhook](https://13.60.250.145.nip.io/api/telegram/webhook)",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

## Деплой (Deployment)

Проєкт автоматично розгортається на **AWS EC2** при кожному push або merge у гілку `main` через GitHub Actions SSH workflow (`.github/workflows/deploy-demo.yml`):
1. Піднімаються 4 Docker-контейнери (`db` PostgreSQL 16, `backend` Node.js + Prisma, `frontend` Nginx та `caddy` для автоматичного HTTPS-сертифіката).
2. Конфігурація змінних середовища задається через `.env` (шаблон у `.env.example`, включно з `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` та `TELEGRAM_WEBHOOK_SECRET`).
3. Для альтернативного serverless-розгортання бекенду в AWS Lambda підготовлено конфіг [`serverless.yml`](./serverless.yml).
