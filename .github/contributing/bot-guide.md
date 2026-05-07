# Bot Development Guide

The FeroxStats Discord bot is a standalone Node.js service that polls the database and sends notifications to Discord webhooks configured per group.

## Prerequisites

- Node.js 20+
- npm
- A running FeroxStats Supabase project (apply the bot migration first)

## 1. Apply the bot migration

Run `bot/supabase/migration.sql` in the Supabase SQL Editor. This adds Discord webhook, bot state, and rank columns to the `groups` and `group_members` tables.

## 2. Install dependencies

```bash
cd bot
npm install
```

## 3. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `SUPABASE_URL` | Yes | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only secret key |
| `SITE_URL` | Yes | Base URL of the FeroxStats web app |
| `POLL_INTERVAL_MS` | Optional | Defaults to `60000` (60 seconds) |

## 4. Start in development mode

```bash
npm run dev
```

## 5. Build and run in production

```bash
npm run build
npm start
```

## Notification handlers

Each notification type has its own handler in `src/notify/`:

| Handler | Description |
| ------- | ----------- |
| `members.ts` | Announces members joining or leaving a group |
| `competitions.ts` | Announces competition start, end, and standings |
| `achievements.ts` | Announces player skill/boss milestones |
| `deaths.ts` | Announces player deaths |
| `updates.ts` | Announces newly published game updates |
