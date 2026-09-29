# 🏠 SmartHome — «Умный дом» 
```@t171_hakaton_max_bot```

Чат-бот и мини-приложение MAX, которые помогают жителям многоквартирного дома решать 
проблемы с управляющей компанией (УК): создать заявку, собрать подписи соседей, передать
заявку в УК и отслеживать её статус до результата.

## Роли
### 👔 Сотрудник УК
Одобряет "заселение" жителей в дом (одобряет запрос), назначает председателя ТСЖ, 
принимает заявки о поломках/передает их на дальнейшее рассмотрение в организации, 
создает важные объявления для жителей

##### Начало работы:
📍 Откройте мини-приложение, пройдите авторизацию:

📍 Введите ```/uk_login ykcode2026```, вам будут выданы права сотрудника УК.

📍 Чтобы добавить дом, перейдите в приложение.

Вы можете создать чат жителей дома и добавить в него бота @t171_hakaton_max_bot, 
назначить бота администратором и с помощью ```/bind``` привязать бота к чату дома.

📍 Введите ```/login```, чтобы выйти из аккаунта УК и снова стать жителем

### 🙇‍♂️ Житель дома
Может подать заявку на вступление в дом, создает заявки для УК, поддерживает заявки 
других жителей, оспаривает заявку, создает новости для жителей.

## 🛠 Архитектура решения

#### ```/server``` - backend-сервер с собственным API
Node.js (Express + TypeScript) — REST API

#### ```/server/prisma``` - настройка базы данных через Prisma
PostgreSQL + Prisma

#### ```/client``` - frontend-сервер, подключается к backend
React (Web PWA) 

#### ```/bot``` - сервер чат-бота, подключается к backend

## ⚙️ Параметры окружения
Требования: Node.js ≥ 20.19, PostgreSQL ≥ 14

## 🐳 Запуск приложения на docker

```bash
cp .env.example .env   # заполнить секреты
docker compose up -d --build
```

## 💻 Запуск приложения локально
Запуск сервера

```bash
cd server
cp .env.example .env   # заполнить секреты
npm install
npm run build
npm run start          # API на http://localhost:3000
```

Запуск бота

```bash
cd ..
cd bot
cp .env.example .env    # заполнить секреты
npm install
npm run build           
npm run start                                 
```

Запуск клиента

```bash
cd ..
cd client
cp .env.example .env    # заполнить секреты
npm install
npm run build           
npm run dev                                 
```

## 🔑 Переменные окружения
```angular2html
# --- Порт мини-приложения на хосте ---
HTTP_PORT=8080

# --- PostgreSQL ---
POSTGRES_USER=smartcity
POSTGRES_PASSWORD=change-me-strong-password
POSTGRES_DB=smartcity

# --- Клиент (вшиваются на build) ---
# Пусто = same-origin https://smartcity.visitly.ru/api
VITE_API_URL=
# Кабинет Яндекс Maps: https://developer.tech.yandex.ru/
VITE_YANDEX_MAPS_API_KEY=

# --- CORS ---
CORS_ORIGIN=https://smartcity.visitly.ru

# --- Бот MAX ---
# Токен: кабинет бота MAX (business.max.ru / platform-api)
# Один и тот же токен: server (initData) + bot (polling)
MAX_BOT_TOKEN=
# Сами придумываете — общий секрет server↔bot
BOT_API_TOKEN=change-me-shared-secret
BOT_ENABLED=true
BOT_MODE=polling
BOT_USERNAME=
WEBHOOK_DOMAIN=
WEBHOOK_PATH=/bot/webhook
WEBHOOK_SECRET=
BOT_WEBHOOK_PORT=3001

# --- УК ---
UK_ACCESS_CODE=change-me
# MAX id через запятую - будет выдана роль УК при запуске
UK_ADMIN_IDS=

# --- Auth ---
DEV_AUTH_BYPASS=false
INIT_DATA_MAX_AGE_SEC=86400

# --- Правила заявок ---
VOTE_PERCENT_DEFAULT=20
DEFAULT_DEADLINE_DAYS=14
EXPIRE_CHECK_INTERVAL_SEC=300
NOTIFY_POLL_INTERVAL_SEC=3

# --- Гео на сервере (опционально) ---
YANDEX_GEO_API_KEY=

# --- SMTP (опционально; без него письма только в лог) ---
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# --- GigaChat / модерация бота (опционально) ---
GIGACHAT_AUTH_KEY=
GIGACHAT_CLIENT_ID=
GIGACHAT_CLIENT_SECRET=
GIGACHAT_MODEL=GigaChat
GIGACHAT_SCOPE=GIGACHAT_API_PERS
MODERATION_TIMEOUT_MS=20000
MODERATION_FAIL_STRATEGY=allow

# --- S3 (Beget) ---
S3_ENDPOINT=https://s3.ru1.storage.beget.cloud
S3_REGION=ru1
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_URL=
```

## 🔗 Интеграция с внешними сервисами
### Yandex.Maps
Карты для поиска дома

### GigaChat API
Модель для модерации сообщений в чате