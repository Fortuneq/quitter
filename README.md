# Reboot (quitter)

A Telegram Mini App for a 90-day dopamine reset, in the spirit of QUITTR. It combines a streak counter, a day-by-day 90-day plan (a lesson and a micro-task for each day), a panic button, a relapse calendar, badges and recovery statistics. Onboarding is a short quiz followed by a paywall.

## Features

- Streak counter and relapse calendar
- 90-day plan: a lesson and a micro-task for every day
- Panic button for urges
- Badges and recovery statistics
- Access tiers: 24-hour trial → free (streak + panic button) → premium (full plan and stats)
- Payments via Telegram Stars and YooKassa
- Personal-data consent flow, lead capture from the mini-site
- Prometheus metrics (`quitter_*`, `/api/metrics`) with a dedicated Grafana instance

## Tech stack

| Part | Technology |
|---|---|
| Mini App | React, Vite (hash router), dark theme; progress stored in localStorage, Telegram CloudStorage and the backend |
| API | FastAPI, SQLite |
| Monitoring | Prometheus, Grafana |
| Deploy | Docker, Caddy, blue-green deploy script |

## Project structure

```
miniapp/            — the Mini App
api/                — FastAPI backend: state sync, subscriptions, payments, metrics
deploy/             — Grafana provisioning and a Caddy reference block
scripts/deploy.sh   — git-based blue-green deployment
```

## Getting started

```bash
cd miniapp
npm install
npm run dev
```

Outside Telegram the app runs in local mode (no payments or sync).

## Configuration

The API reads its settings from an env file: `BOT_TOKEN`, `WEBHOOK_SECRET`, `BOT_USERNAME`, `BOT_URL`, `APP_URL`, `DOCS_URL`, `ADMIN_CHAT_ID`, `YOOKASSA_*`.

## Deployment

`scripts/deploy.sh` deploys strictly through git: push → `git pull` on the server → build images → blue-green container swap.

The architecture mirrors [StretcherMiniapp](https://github.com/Fortuneq/StretcherMiniapp).
