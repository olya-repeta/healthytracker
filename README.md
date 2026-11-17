# VitaTrack — Трекер прийому ліків та вітамінів

Сучасний вебзастосунок у стилі **Sage Wellness** для відстежування курсу прийому ліків, вітамінів і БАДів, побудований за архітектурою **Stateless Modular Monolith**.

## Архітектура проєкту

- **`/backend`** — Node.js + TypeScript + Express + Prisma ORM + Cheerio (`og:image` парсер) + `serverless-http` (готовність до AWS Lambda).
  - Модулі в `backend/src/modules/`:
    - `auth` — реєстрація, вхід, перевірка профілю, видача stateless JWT-токенів.
    - `medications` — управління препаратами користувача, прев'ю зображень за посиланням (`/api/medications/preview-image`), автоматичний запуск генерації розкладу.
    - `schedule` — автоматична генерація розкладу на весь курс (`DoseSchedule`), отримання доз на вибрану дату чи діапазон, зміна статусів (`TAKEN`, `SKIPPED`, `PENDING`), розрахунок статистики за 7 та 30 днів.
    - `scraper` — сервіс витягування `og:image` / `twitter:image` / JSON-LD зображень товарів з інтернет-аптек із SVG-заглушкою.
- **`/frontend`** — React 18 + TypeScript + Vite + Tailwind CSS + Axios.
  - Типізований API-клієнт у `frontend/src/api/` та спільні DTO у `frontend/src/types/api.ts`.
  - 2 основні вкладки: **«Головна / Мій трекер»** та **«Додати препарат»**.
- **`/infra`** — конфігурація Docker Compose (`docker-compose.yml`), multi-stage `Dockerfile`, serverless-конфігурація (`serverless.yml`) та детальний опис взаємодії компонентів і бази даних.

Детальну ER-діаграму бази даних PostgreSQL, опис усіх таблиць (`User`, `Medication`, `DoseSchedule`) та API-контрактів дивіться у файлі [`infra/ARCHITECTURE.md`](./infra/ARCHITECTURE.md).

## Швидкий локальний запуск

### 1. Запуск Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
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
docker compose -f infra/docker-compose.yml up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`

## Деплой (Deployment)

Проєкт підтримує два варіанти продакшн-розгортання:
- **Контейнерний деплой (Docker / PaaS):** збірка відбувається через multi-stage `Dockerfile` (`backend-production` на порту `4000` із автоматичним застосуванням схеми `npx prisma db push` та `frontend-production` на базі Nginx, що роздає SPA та проксує `/api/*` на бекенд). Для роботи потрібні змінні середовища `DATABASE_URL`, `JWT_SECRET` та `VITE_API_URL` (див. `.env.example`).
- **Serverless-деплой (AWS Lambda):** розгортання бекенду через Serverless Framework у регіон `eu-central-1`:
  ```bash
  npx serverless deploy --config infra/serverless.yml
  ```
