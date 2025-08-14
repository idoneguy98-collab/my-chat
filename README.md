# Telegram-ish Messenger v3

Фичи:
- Push-уведомления (Web Push, VAPID)
- Счётчики непрочитанных (пер-чату)
- Read receipts (двойная галочка)
- Онлайн/оффлайн + last seen
- Реакции к сообщениям
- Тёмная/светлая тема
- Аватарки, прикрепления, стикеры (из v2)

## Стек
Backend: Node.js, Express, Socket.IO, better-sqlite3, web-push  
Frontend: React, Vite, Tailwind, emoji-mart, Service Worker

---

## Запуск локально
### 1) Backend
```bash
cd server
cp .env.example .env
# СГЕНЕРИРУЙ VAPID-ключи (1 раз):
npm install
npm run gen:vapid
# Вставь VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY в .env
npm run dev    # http://localhost:4000
```

### 2) Frontend
```bash
cd client
npm install
npm run dev    # http://localhost:5173
```

---

## Деплой на Railway (рекомендуется)
### Вариант А: монорепо с двумя сервисами
1. Залей репозиторий на GitHub.
2. В Railway ➜ New Project ➜ **Deploy from GitHub Repo**.
3. Добавь **два Service**:
   - **server**: Specify Root Directory = `server`
     - Build: `npm install`
     - Start: `npm start`
     - Env Vars:
       - `PORT` = `4000` (Railway выставит PORT, но мы слушаем его)
       - `JWT_SECRET` = сгенерируй строку
       - `CORS_ORIGIN` = URL фронтенда (после деплоя)
       - `DATABASE_URL` = `./data.sqlite`
       - `PUBLIC_URL` = публичный URL сервера (после деплоя)
       - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` = из `npm run gen:vapid`
     - Persistent Storage: добавь Volume (например `/data`), и укажи `DATABASE_URL=/data/data.sqlite`
   - **client**: Specify Root Directory = `client`
     - Build: `npm install && npm run build`
     - Start: (Static) — Railway определит автоматически (Nixpacks). Если нужен Node static, можно `npm run preview`.
     - Env Vars:
       - `VITE_API_URL` = публичный URL сервера
4. После первого деплоя **обнови** `CORS_ORIGIN` и `PUBLIC_URL` переменными реальных доменов.

### Вариант B: раздельные репозитории
Создай два репо: `/server` и `/client` отдельно. Процесс аналогичный.

---

## Web Push — как это работает
- На бэке храним VAPID ключи и подписки пользователей (таблица `push_subscriptions`).
- Клиент регистрирует Service Worker, получает permission и отправляет subscription на сервер.
- Когда приходит новое сообщение, сервер шлёт пуш получателям (кроме автора), если они оффлайн/вкладка не активна.

## Миграции БД
SQLite инициализируется автоматически. Таблицы (основные):
- `users (last_seen, avatar_url)`
- `chats, chat_participants`
- `messages (type, file_url, deleted, edited_at)`
- `chat_reads (user_id, chat_id, last_read_message_id)`
- `message_reactions (message_id, user_id, emoji)`
- `push_subscriptions (user_id, endpoint, p256dh, auth)`

---

## Важные заметки
- Это стартовый код. Для продакшена добавь rate limiting, валидации, CDN/облако для медиа, логи и резервные копии.
- Нет E2E-шифрования — не используй для чувствительных данных без доработок.
