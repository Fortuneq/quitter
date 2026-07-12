# Ребут (quitter)

Telegram Mini App: перезагрузка дофамина за 90 дней (аналог QUITTR).
Стрик-каунтер, план 90 дней (урок + микрозадание на день), паник-кнопка,
календарь срывов, значки, статистика восстановления. Онбординг-квиз → пейволл.

Архитектура повторяет stretcher (BendApp):

- `miniapp/` — React + Vite (hash-роутер), тёмная тема. Прогресс в
  localStorage + Telegram CloudStorage + бэкенд (`/api/state`).
- `api/` — FastAPI + SQLite: триал 24 ч → free (стрик + паника) → premium
  (план 90 дней, статистика). Оплата Telegram Stars и ЮKassa, согласия ПДн,
  лиды с минисайта, метрики Prometheus (`quitter_*`, `/api/metrics`).
- `deploy/` — Grafana (отдельный инстанс grafana-quitter за секретным путём,
  см. `deploy/grafana/SECRET_PATH.txt`) и референс-блок Caddy.
- `scripts/deploy.sh` — деплой на gas2 строго через git
  (push → git pull на сервере → сборка образов → blue-green подмена).

## Тарифы

1 месяц — 799 ₽ (500 ⭐), 1 год — 2990 ₽ (1870 ⭐).

## Локальная разработка

```bash
cd miniapp && npm install && npm run dev
```

Вне Telegram приложение работает в локальном режиме (без оплаты и синка).

## Сервер (gas2)

- Репозиторий: `/opt/quitter`, данные: `/var/lib/quitter`,
  env: `/etc/quitter/api.env` (BOT_TOKEN, WEBHOOK_SECRET, BOT_USERNAME,
  BOT_URL, APP_URL, DOCS_URL, ADMIN_CHAT_ID, YOOKASSA_*).
- Контейнеры: `quitter-api`, `quitter-app`, `grafana-quitter`
  (сеть `community_default`).
- Prometheus: джоба `quitter-api` в конфиге kegel-прометеуса.
- Caddy: блок домена в `/root/plane/deployments/cli/community/Caddyfile.custom`.

## Перед запуском продаж

- Создать бота в BotFather, положить токен в api.env, включить вебхук
  `https://<домен>/api/tg-webhook` (с secret_token = WEBHOOK_SECRET).
- Заполнить реквизиты в `miniapp/public/docs/*.html` (плейсхолдеры [ФИО]/[ИНН]/[e-mail]/[имя бота]/[домен]).
- Ключи ЮKassa в api.env + вебхук payment.succeeded → `/api/yk-webhook`.
