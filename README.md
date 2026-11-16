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
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`
