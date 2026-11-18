# VitaTrack — Архітектура системи та схема бази даних

## 1. Загальний огляд архітектури

**VitaTrack** побудований за патерном **Modular Monolith** (модульний моноліт) із підтримкою **Progressive Web App (PWA)**, офлайн-роботи та фонового планувальника нагадувань у Telegram. Система складається з чотирьох рівнів:

1. **Edge / SSL Reverse Proxy (`Caddy`)** — термінує TLS/HTTPS-трафік (автоматичні сертифікати Let's Encrypt / ZeroSSL для домену `13.60.250.145.nip.io`), стискає відповіді (`gzip`) та проксує запити на контейнер фронтенду.
2. **Client Layer (`frontend/`)** — React 18 + TypeScript + Vite + Tailwind CSS + `vite-plugin-pwa` (Workbox Service Worker). У продакшн-збірці статику роздає **Nginx**, який також проксує `/api/*` на бекенд. Підтримує офлайн-вхід (SHA-256 верифікація кешованої сесії) та локальну чергу відміток прийому доз при втраті мережі.
3. **Application Layer (`backend/`)** — REST API та фоновий воркер на базі Node.js 20/22, Express та TypeScript. Поділений на ізольовані бізнес-модулі (`auth`, `medications`, `schedule`, `scraper`, `telegram`) із вбудованим cron-планувальником сповіщень (`node-cron`).
4. **Data Layer (`PostgreSQL 16` + `Prisma ORM`)** — реляційна база даних із суворо типізованим доступом через Prisma Client та автоматичним застосуванням міграцій при старті контейнера.

### Діаграма взаємодії компонентів

```text
+-------------------------------------------------------------------+
|                   Користувач (Browser / PWA)                      |
|         (Service Worker + Offline Auth & Dose Sync Queue)         |
+---------------------------------+---------------------------------+
                                  | HTTPS (443) / HTTP (80)
                                  v
+-------------------------------------------------------------------+
|                   Caddy Container (:80, :443)                     |
|  - Автоматичний SSL/TLS (13.60.250.145.nip.io) + Gzip             |
|  - Проксування всього трафіку ---> http://frontend:80             |
+---------------------------------+---------------------------------+
                                  | HTTP
                                  v
+-------------------------------------------------------------------+
|                   Frontend Container (Nginx :80)                  |
|  - Віддає React SPA (/usr/share/nginx/html)                       |
|  - Проксує /api/*  --->  http://backend:4000/api/*                |
+---------------------------------+---------------------------------+
                                  | REST JSON + Bearer JWT
                                  v
+-------------------------------------------------------------------+
|                  Backend Container (Node.js :4000)                |
|  +---------+ +-------------+ +----------+ +---------+ +---------+ |
|  |  Auth   | | Medications | | Schedule | | Scraper | |Telegram | |
|  |  Module | |   Module    | |  Engine  | | Cheerio | |Bot+Cron | |
|  +----+----+ +------+------+ +----+-----+ +----+----+ +----+----+ |
+-------|-------------|-------------|------------|-----------|------+
        |             |             |            |           |
        +------+------+-------------+            | HTTP GET  | HTTPS API
               | Prisma ORM                      v           v
               v                        [Зовнішні сайти] [Telegram Bot API]
+------------------------------------+    (og:image)     (Webhook + Push)
|       PostgreSQL 16 (vitatrack)    |
|  - User (+ Telegram & Timezone)    |
|  - Medication                      |
|  - DoseSchedule                    |
+------------------------------------+
```

---

## 2. Взаємодія між Frontend та Backend

### 2.1. Мережева маршрутизація, Proxy та PWA
- **Ланцюжок запитів у продакшені:** Запит користувача на `https://13.60.250.145.nip.io` потрапляє на **Caddy** (`Caddyfile`), який розшифровує HTTPS і передає запит на контейнер `frontend:80` (**Nginx**). Через цей же HTTPS-канал сервери Telegram надсилають оновлення на `/api/telegram/webhook`.
- **Маршрутизація в Nginx (`frontend/nginx.conf`):** Запити з префіксом `/api/` проксуються всередині Docker-мережі на `http://backend:4000/api/` із передачею заголовків клієнта (`X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`). Усі інші шляхи спрямовуються на `/index.html` для роботи клієнтського роутингу React.
- **Service Worker та кешування (`vite.config.ts`):** Workbox кешує статичні ресурси застосунку для миттєвого завантаження та роботи без інтернету, але явно виключає маршрути `/api` та `/auth` (`navigateFallbackDenylist: [/^\/api/, /^\/auth/]`), щоб запити до API завжди йшли в мережу або оброблялися клієнтською офлайн-чергою.
- **CORS:** Backend обмежує доступ дозволеними доменами через змінну `CORS_ORIGIN` (`https://13.60.250.145.nip.io`, `http://13.60.250.145`, `localhost`).

### 2.2. Потік автентифікації (Stateless JWT, Google OAuth та Offline Auth)
1. **Онлайн-вхід:** Користувач реєструється (`POST /api/auth/register`), входить за паролем (`POST /api/auth/login`) або передає `idToken` Google (`POST /api/auth/google`). Модуль `auth` повертає **JWT-токен** (`7d`).
2. **Авторизовані запити:** Axios interceptor додає заголовок `Authorization: Bearer <token>` до кожного запиту. При старті додатка `GET /api/auth/me` валідує токен і оновлює дані профілю (`UserDto`), включно зі статусом підключення Telegram та часовим поясом.
3. **Офлайн-режим:** Якщо інтернет відсутній, фронтенд зберігає активну сесію користувача та підтримує локальний вхід за допомогою SHA-256 верифікації облікових даних, а відмітки прийому доз (`TAKEN` / `SKIPPED`) ставляться в чергу та синхронізуються з бекендом при відновленні з'єднання.

### 2.3. Інтеграція Telegram-бота та планувальник нагадувань
1. **Прив'язка акаунту (Deep Linking):** У вкладці **«Налаштування»** фронтенд запитує одноразовий токен прив'язки, формує посилання `https://t.me/<bot>?start=<token>` та автоматично зберігає часовий пояс браузера користувача (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
2. **Обробка Webhook (`POST /api/telegram/webhook`):** Сервер перевіряє заголовок безпеки `X-Telegram-Bot-Api-Secret-Token` (`TELEGRAM_WEBHOOK_SECRET`), знаходить користувача за переданим токеном після `/start`, прив'язує його `telegramChatId`, очищає одноразовий токен і надсилає підтвердження в чат через Telegram Bot API.
3. **Cron-планувальник (`node-cron`):** Щохвилини (`* * * * *`) фоновий воркер перевіряє заплановані прийоми зі статусом `PENDING`, враховує індивідуальний часовий пояс (`timezone`) кожного підключеного користувача та надсилає персоналізоване нагадування з назвою препарату й дозуванням у Telegram.

### 2.4. Модулі Backend та API-контракти
- **`/api/health` (`GET`)** — перевірка стану сервера для моніторингу та Docker healthchecks.
- **`/api/auth/*`** — реєстрація, логін, Google OAuth, перевірка поточного користувача (`/me`), оновлення налаштувань профілю та часового поясу.
- **`/api/medications/*`** — CRUD-операції над препаратами користувача:
  1. Викликає модуль **`scraper`** (`POST /api/medications/preview-image`), який за допомогою **Cheerio** витягує `og:image`, `twitter:image` або JSON-LD зображення зі сторінки аптеки (за відсутності підставляє SVG-заглушку).
  2. Автоматично генерує записи в таблиці `DoseSchedule` на весь курс (`durationDays`).
- **`/api/schedule/*`** — отримання розкладу доз на обрану дату (`YYYY-MM-DD`) або період, зміна статусу прийому (`PENDING` → `TAKEN` / `SKIPPED`) з фіксацією `actionAt`, підрахунок статистики комплаєнсу за 7 і 30 днів.
- **`/api/telegram/*`** — генерація токена та посилання для підключення бота, відв'язування Telegram-акаунту, а також прийом вхідних оновлень від Telegram через `/api/telegram/webhook`.

---

## 3. Детальний опис бази даних (PostgreSQL + Prisma)

База даних складається з 3 нормалізованих таблиць, зв'язаних зовнішніми ключами з каскадним видаленням (`onDelete: Cascade`).

### 3.1. ER-діаграма зв'язків

```text
+-----------------------+       1 : N       +----------------------+
|         User          |------------------>|      Medication      |
+-----------------------+                   +----------------------+
| PK id (UUID)          |                   | PK id (UUID)         |
|    email (UNIQUE)     |                   | FK userId            |
|    name               |                   |    name              |
|    passwordHash       |                   |    dosage            |
|    googleId           |                   |    frequencyType     |
|    avatarUrl          |                   |    timesOfDay (JSON) |
|    telegramChatId     |                   |    daysOfWeek (JSON) |
|    telegramLinkToken  |                   |    startDate         |
|    timezone           |                   |    endDate           |
+-----------+-----------+                   +----------+-----------+
            |                                          |
            | 1 : N                                    |
            |             +----------------------+     | 1 : N
            +------------>|     DoseSchedule     |<----+
                          +----------------------+
                          | PK id (UUID)         |
                          | FK medicationId      |
                          | FK userId            |
                          |    scheduledDate     |
                          |    scheduledTime     |
                          |    status            |
                          |    actionAt          |
                          +----------------------+
```

### 3.2. Опис таблиць та полів

#### 1. Таблиця `User` (Користувачі)
Зберігає облікові записи користувачів (класична реєстрація та Google OAuth), а також параметри інтеграції з Telegram.

| Поле | Тип (Prisma / SQL) | Обмеження | Опис |
| :--- | :--- | :--- | :--- |
| `id` | `String` (`UUID`) | Primary Key | Унікальний ідентифікатор користувача |
| `email` | `String` | `Unique`, Not Null | Електронна пошта користувача (основний логін) |
| `name` | `String` | Not Null | Відображуване ім'я користувача |
| `passwordHash` | `String?` | Nullable | Хеш пароля (`null` при вході виключно через Google) |
| `googleId` | `String?` | `Unique`, Nullable | Унікальний ідентифікатор акаунту Google OAuth |
| `avatarUrl` | `String?` | Nullable | Посилання на аватар профілю |
| `telegramChatId` | `String?` | `Unique`, Nullable | Ідентифікатор приватного чату користувача в Telegram |
| `telegramLinkToken` | `String?` | `Unique`, Nullable | Одноразовий токен для безпечної прив'язки акаунту через `/start` |
| `timezone` | `String` | Default: `"Europe/Kyiv"` | Часовий пояс користувача (IANA) для точного відправлення нагадувань |
| `createdAt` | `DateTime` | Default: `now()` | Дата та час створення акаунту |
| `updatedAt` | `DateTime` | `@updatedAt` | Дата та час останнього оновлення профілю |

- **Зв'язки:** Один користувач має багато препаратів (`medications: Medication[]`) та багато записів у розкладі (`schedules: DoseSchedule[]`).

#### 2. Таблиця `Medication` (Курси препаратів та вітамінів)
Зберігає параметри курсу прийому ліків або БАДів, на основі яких формується розклад.

| Поле | Тип (Prisma / SQL) | Обмеження | Опис |
| :--- | :--- | :--- | :--- |
| `id` | `String` (`UUID`) | Primary Key | Унікальний ідентифікатор препарату |
| `userId` | `String` (`UUID`) | Foreign Key -> `User.id` | Власник курсу прийому |
| `name` | `String` | Not Null | Назва препарату чи вітаміну |
| `dosage` | `String` | Not Null | Опис дозування (напр., *"1 капсула під час їжі"*) |
| `sourceUrl` | `String?` | Nullable | Посилання на сторінку товару в аптеці/магазині |
| `imageUrl` | `String` | Not Null | URL зображення (спарсене `og:image` або SVG-іконка) |
| `frequencyType` | `String` | Not Null | Тип періодичності: `"DAILY"` (щодня) або `"WEEKLY"` (у вибрані дні) |
| `timesPerDay` | `Int` | Default: `1` | Кількість прийомів на день |
| `timesOfDay` | `String` | Not Null | JSON-масив часу прийому `HH:mm` (напр., `'["09:00","20:00"]'`) |
| `daysOfWeek` | `String` | Not Null | JSON-масив індексів днів тижня `0..6` (`0`=Нд, напр. `'[1,3,5]'`) |
| `startDate` | `String` | Not Null | Дата початку курсу (`YYYY-MM-DD`) |
| `durationDays` | `Int` | Not Null | Тривалість курсу в днях |
| `endDate` | `String` | Not Null | Дата завершення курсу (`YYYY-MM-DD`, розраховується автоматично) |
| `createdAt` | `DateTime` | Default: `now()` | Час додавання препарату |
| `updatedAt` | `DateTime` | `@updatedAt` | Час останньої зміни |

- **Індекси:** `@@index([userId])` — для швидкої вибірки препаратів користувача.
- **Зв'язки:** Належить `User` (`onDelete: Cascade`). Видалення препарату каскадно видаляє пов'язані записи `DoseSchedule`.

#### 3. Таблиця `DoseSchedule` (Розклад окремих прийомів)
Денормалізована таблиця конкретних подій прийому препаратів на кожен день курсу.

| Поле | Тип (Prisma / SQL) | Обмеження | Опис |
| :--- | :--- | :--- | :--- |
| `id` | `String` (`UUID`) | Primary Key | Унікальний ідентифікатор запланованого прийому |
| `medicationId` | `String` (`UUID`) | Foreign Key -> `Medication.id` | Посилання на препарат |
| `userId` | `String` (`UUID`) | Foreign Key -> `User.id` | Пряме посилання на користувача (для швидких вибірок без JOIN) |
| `scheduledDate` | `String` | Not Null | Дата прийому у форматі `YYYY-MM-DD` (без зміщень часових поясів) |
| `scheduledTime` | `String` | Not Null | Запланований час у форматі `HH:mm` (напр., `"09:00"`) |
| `status` | `String` | Default: `"PENDING"` | Статус прийому: `"PENDING"`, `"TAKEN"` або `"SKIPPED"` |
| `actionAt` | `DateTime?` | Nullable | Фактичний час відмітки прийому користувачем |
| `createdAt` | `DateTime` | Default: `now()` | Час створення запису |
| `updatedAt` | `DateTime` | `@updatedAt` | Час зміни статусу |

- **Індекси:**
  - `@@index([userId, scheduledDate])` — складений індекс для миттєвого рендеру трекера за обраний день, роботи cron-планувальника і розрахунку статистики за 7/30 днів.
  - `@@index([medicationId])` — для швидкого пошуку або видалення розкладу препарату.

---

## 4. Інфраструктура, деплой та CI/CD

- **Контейнерна оркестрація (`docker-compose.yml` та `Caddyfile`):** Піднімає 4 контейнери (`vitatrack-db`, `vitatrack-backend`, `vitatrack-frontend`, `vitatrack-caddy`) зі збереженням даних БД і сертифікатів у Docker volumes (`postgres_data`, `caddy_data`, `caddy_config`). При старті `vitatrack-backend` автоматично застосовує Prisma-міграції (`prisma migrate deploy` із безпечним фолбеком).
- **Continuous Integration (`.github/workflows/ci.yml`):** При кожному `push` у `main`/`develop` або відкритті `pull_request` перевіряє генерацію Prisma Client, сувору типізацію TypeScript (`npm run typecheck`) та продакшн-збірку (`npm run build`) для бекенду і фронтенду.
- **Continuous Deployment (`.github/workflows/deploy-demo.yml`):** При кожному злитті в `main` підключається по SSH до сервера **AWS EC2** (`13.60.250.145`), оновлює код, передає змінні середовища (включно з `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`), перезбирає контейнери (`docker compose up --build -d`) та очищує старі Docker-образи.
- **Serverless-резерв (`serverless.yml`):** Конфігурація для альтернативного розгортання бекенду в AWS Lambda (`eu-central-1`, `nodejs20.x`).
