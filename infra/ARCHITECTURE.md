# VitaTrack — Архітектура системи та схема бази даних

## 1. Загальний огляд архітектури

**VitaTrack** побудований за патерном **Stateless Modular Monolith** (модульний моноліт без збереження стану на сервері). Система складається з трьох основних рівнів:

1. **Client Layer (`frontend/`)** — Single Page Application (SPA) на базі React 18, TypeScript, Vite та Tailwind CSS. У продакшн-збірці статичні файли обслуговуються вебсервером **Nginx**, який також виступає reverse-proxy для API-запитів.
2. **Application Layer (`backend/`)** — REST API на базі Node.js 20/22, Express та TypeScript. Поділений на ізольовані бізнес-модулі (`auth`, `medications`, `schedule`, `scraper`). Підтримує запуск як у Docker-контейнері, так і в середовищі AWS Lambda через обгортку `serverless-http`.
3. **Data Layer (PostgreSQL + Prisma ORM)** — реляційна база даних PostgreSQL 16. Взаємодія з БД відбувається виключно через типізований клієнт **Prisma ORM**.

### Діаграма взаємодії компонентів

```text
+-------------------------------------------------------------------+
|                        Користувач (Browser)                       |
+---------------------------------+---------------------------------+
                                  | HTTPS / HTTP
                                  v
+-------------------------------------------------------------------+
|                   Frontend Container (Nginx :80)                  |
|  - Віддає React SPA (/usr/share/nginx/html)                       |
|  - Проксує /api/*  --->  http://backend:4000/api/*                |
+---------------------------------+---------------------------------+
                                  | REST JSON + Bearer JWT
                                  v
+-------------------------------------------------------------------+
|               Backend Container / AWS Lambda (:4000)              |
|  +-------------+  +---------------+  +------------+  +---------+  |
|  | Auth Module |  | Medications   |  | Schedule   |  | Scraper |  |
|  | (JWT/OAuth) |  | Module (CRUD) |  | Engine     |  | Cheerio |  |
|  +------+------+  +-------+-------+  +-----+------+  +----+----+  |
+---------|-----------------|----------------|--------------|-------+
          |                 |                |              |
          +--------+--------+----------------+              | HTTP GET
                   | Prisma ORM                             v
                   v                            [Зовнішні сайти аптек]
+------------------------------------+             (og:image парсинг)
|     PostgreSQL 16 (vitadatabase)   |
|  - User                            |
|  - Medication                      |
|  - DoseSchedule                    |
+------------------------------------+
```

---

## 2. Взаємодія між Frontend та Backend

### 2.1. Мережева маршрутизація та Proxy
* **У Docker-середовищі:** Клієнтський додаток звертається до відносних шляхів `/api/...` (`VITE_API_URL=/api`). Вебсервер **Nginx** (`frontend/nginx.conf`) перехоплює всі запити, що починаються з `/api/`, і проксує їх на внутрішній хост контейнера `http://backend:4000/api/`, передаючи заголовки реального IP клієнта (`X-Real-IP`, `X-Forwarded-For`). Усі інші маршрути перенаправляються на `/index.html` для коректної роботи клієнтського роутингу React.
* **У Serverless-середовищі (AWS Lambda):** Запити надходять через AWS HTTP API Gateway (`httpApi: '*'`) безпосередньо в хендлер `backend/dist/lambda.handler`.
* **CORS та формат даних:** Backend приймає та повертає дані у форматі `application/json` (ліміт тіла запиту — `2mb`).

### 2.2. Потік автентифікації (Stateless JWT & Google OAuth)
Автентифікація не використовує серверні сесії (`stateless`):
1. Користувач реєструється (`POST /api/auth/register`), входить за паролем (`POST /api/auth/login`) або передає `idToken` від Google (`POST /api/auth/google`).
2. Модуль `auth` валідує дані, створює/знаходить запис у таблиці `User` та генерує **JWT-токен** (термін дії — `7d`, підписаний `JWT_SECRET`).
3. `frontend` зберігає отриманий токен і додає його до кожного наступного запиту через Axios interceptor у вигляді HTTP-заголовка:
   `Authorization: Bearer <token>`
4. При завантаженні сторінки фронтенд викликає `GET /api/auth/me` для перевірки валідності токена та отримання профілю користувача (`UserDto`).

### 2.3. Модулі Backend та API-контракти
* **`/api/health` (`GET`)** — перевірка працездатності сервісу для Docker healthchecks та балансувальників навантаження.
* **`/api/auth/*`** — реєстрація, логін, OAuth через Google, отримання поточного користувача.
* **`/api/medications/*`** — CRUD-операції над препаратами користувача. Під час створення препарату модуль автоматично:
  1. Викликає модуль **`scraper`** (або ендпоінт `POST /api/medications/preview-image`), який за допомогою **Cheerio** парсить метатеги `og:image`, `twitter:image` або JSON-LD зі сторінки аптеки (якщо зображення відсутнє — підставляється SVG-заглушка).
  2. Ініціює генерацію всіх запланованих прийомів у таблиці `DoseSchedule` на весь курс (`durationDays`).
* **`/api/schedule/*`** — вибірка запланованих доз за конкретну дату (`YYYY-MM-DD`) або діапазон дат, оновлення статусу прийому (`PENDING` → `TAKEN` або `SKIPPED`) з фіксацією часу (`actionAt`), а також агрегація статистики комплаєнсу (дисципліни прийому) за останні 7 та 30 днів.

---

## 3. Детальний опис бази даних (PostgreSQL + Prisma)

База даних складається з 3 нормалізованих таблиць, зв'язаних зовнішніми ключами з каскадним видаленням (`onDelete: Cascade`).

### 3.1. ER-діаграма зв'язків

```text
+------------------+       1 : N       +----------------------+
|       User       |------------------>|      Medication      |
+------------------+                   +----------------------+
| PK id (UUID)     |                   | PK id (UUID)         |
|    email (UNIQUE)|                   | FK userId            |
|    name          |                   |    name              |
|    passwordHash  |                   |    dosage            |
|    googleId      |                   |    frequencyType     |
|    avatarUrl     |                   |    timesOfDay (JSON) |
+--------+---------+                   |    daysOfWeek (JSON) |
         |                             |    startDate         |
         | 1 : N                       |    endDate           |
         |                             +----------+-----------+
         |                                        |
         |             +----------------------+   | 1 : N
         +------------>|     DoseSchedule     |<--+
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
Зберігає облікові записи користувачів, які можуть входити як через класичну реєстрацію, так і через Google OAuth.

| Поле | Тип (Prisma / SQL) | Обмеження | Опис |
| :--- | :--- | :--- | :--- |
| `id` | `String` (`UUID`) | Primary Key | Унікальний ідентифікатор користувача (генерується автоматично) |
| `email` | `String` | `Unique`, Not Null | Електронна пошта користувача (основний логін) |
| `name` | `String` | Not Null | Відображуване ім'я користувача |
| `passwordHash` | `String?` | Nullable | Хеш пароля (може бути `null`, якщо реєстрація через Google) |
| `googleId` | `String?` | `Unique`, Nullable | Унікальний ідентифікатор акаунту Google OAuth |
| `avatarUrl` | `String?` | Nullable | Посилання на аватар профілю |
| `createdAt` | `DateTime` | Default: `now()` | Дата та час створення акаунту |
| `updatedAt` | `DateTime` | `@updatedAt` | Дата та час останнього оновлення профілю |

* **Зв'язки:** Один користувач має багато препаратів (`medications: Medication[]`) та багато записів у розкладі (`schedules: DoseSchedule[]`).

#### 2. Таблиця `Medication` (Курси препаратів та вітамінів)
Зберігає параметри конкретного курсу прийому ліків або БАДів, на основі яких генерується календарний розклад.

| Поле | Тип (Prisma / SQL) | Обмеження | Опис |
| :--- | :--- | :--- | :--- |
| `id` | `String` (`UUID`) | Primary Key | Унікальний ідентифікатор препарату |
| `userId` | `String` (`UUID`) | Foreign Key -> `User.id` | Власник курсу прийому |
| `name` | `String` | Not Null | Назва препарату чи вітаміну |
| `dosage` | `String` | Not Null | Опис дозування (напр., *"1 капсула під час їжі"*) |
| `sourceUrl` | `String?` | Nullable | Посилання на сторінку товару в аптеці/магазині |
| `imageUrl` | `String` | Not Null | URL зображення (спарсене `og:image` або дефолтна SVG-іконка) |
| `frequencyType` | `String` | Not Null | Тип періодичності: `"DAILY"` (щодня) або `"WEEKLY"` (у вибрані дні) |
| `timesPerDay` | `Int` | Default: `1` | Кількість прийомів на день |
| `timesOfDay` | `String` | Not Null | JSON-масив часу прийому у форматі `HH:mm` (напр., `'["09:00","20:00"]'`) |
| `daysOfWeek` | `String` | Not Null | JSON-масив індексів днів тижня `0..6` (`0`=Нд, напр. `'[1,3,5]'`) |
| `startDate` | `String` | Not Null | Дата початку курсу у форматі `YYYY-MM-DD` |
| `durationDays` | `Int` | Not Null | Тривалість курсу в днях |
| `endDate` | `String` | Not Null | Дата завершення курсу у форматі `YYYY-MM-DD` (розраховується автоматично) |
| `createdAt` | `DateTime` | Default: `now()` | Час додавання препарату |
| `updatedAt` | `DateTime` | `@updatedAt` | Час останньої зміни |

* **Індекси:** `@@index([userId])` — для швидкого отримання списку всіх препаратів конкретного користувача.
* **Зв'язки:** Належить одному `User` (`onDelete: Cascade`). При видаленні препарату автоматично видаляються всі пов'язані записи `DoseSchedule`.

#### 3. Таблиця `DoseSchedule` (Розклад окремих прийомів)
Денормалізована таблиця конкретних подій прийому препаратів на кожен день курсу. Забезпечує миттєву вибірку трекера на день і підрахунок статистики.

| Поле | Тип (Prisma / SQL) | Обмеження | Опис |
| :--- | :--- | :--- | :--- |
| `id` | `String` (`UUID`) | Primary Key | Унікальний ідентифікатор запланованого прийому |
| `medicationId` | `String` (`UUID`) | Foreign Key -> `Medication.id` | Посилання на препарат, до якого належить доза |
| `userId` | `String` (`UUID`) | Foreign Key -> `User.id` | Пряме посилання на користувача (для швидких запитів без JOIN) |
| `scheduledDate` | `String` | Not Null | Дата прийому у форматі `YYYY-MM-DD` (зберігається рядком для уникнення проблем із часовими поясами) |
| `scheduledTime` | `String` | Not Null | Запланований час у форматі `HH:mm` (напр., `"09:00"`) |
| `status` | `String` | Default: `"PENDING"` | Статус прийому: `"PENDING"` (очікує), `"TAKEN"` (прийнято), `"SKIPPED"` (пропущено) |
| `actionAt` | `DateTime?` | Nullable | Фактична мітка часу, коли користувач відмітив прийом |
| `createdAt` | `DateTime` | Default: `now()` | Час створення запису в розкладі |
| `updatedAt` | `DateTime` | `@updatedAt` | Час зміни статусу |

* **Індекси:**
  * `@@index([userId, scheduledDate])` — складений індекс для миттєвого рендеру головного екрана трекера за обрану дату та розрахунку статистики за 7/30 днів.
  * `@@index([medicationId])` — для швидкого пошуку або перегенерації розкладу конкретного препарату.

---

## 4. Інфраструктура та CI/CD (`infra/` та `.github/workflows/`)

* **Локальна оркестрація (`infra/docker-compose.yml`):** Піднімає 3 ізольовані контейнери: `vitatrack-db` (PostgreSQL 16 із healthcheck `pg_isready` та постійним томом `postgres_data`), `vitatrack-backend` (порт `4000`) та `vitatrack-frontend` (порт `5173:80`).
* **Serverless-готовність (`infra/serverless.yml`):** Конфігурація для розгортання бекенду в **AWS Lambda** (регіон `eu-central-1`, runtime `nodejs20.x`, 512 MB RAM) із можливістю виділення важкого модуля `scraper` у незалежну Lambda-функцію.
* **Continuous Integration (`.github/workflows/ci.yml`):** При кожному `push` або `pull_request` у гілки `main` та `develop` автоматично запускаються паралельні джоби `backend-ci` та `frontend-ci` (Node.js 22), які перевіряють генерацію Prisma Client, сувору типізацію TypeScript (`npm run typecheck`) та успішність продакшн-збірки (`npm run build`).
