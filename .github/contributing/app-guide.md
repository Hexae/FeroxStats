# App Development Guide

The FeroxStats web app is built with Next.js 16 (App Router), React 19, Tailwind CSS v4, and Supabase.

## Prerequisites

- Node.js 20+
- npm
- A Supabase project

## 1. Clone and install dependencies

```bash
git clone https://github.com/your-org/feroxstats.git
cd feroxstats
npm install
```

## 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only secret key |
| `CRON_SECRET` | Yes | Bearer secret for `/api/cron/update-players` |
| `RESEND_API_KEY` | Yes (for email) | Used by Supabase SMTP setup with Resend |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | Yes (for auth forms) | hCaptcha site key |
| `NEXT_PUBLIC_FEROX_API_BASE` | Optional | Defaults to `https://ferox.ps/api` |
| `NEXT_PUBLIC_SITE_URL` | Optional | Used for absolute feed URLs and metadata |

## 3. Apply database migrations

Migrations live in `supabase/migrations/`.

Using Supabase CLI:

```bash
npx supabase db push
```

Or run migration SQL files manually in the Supabase SQL Editor (in order):

1. `supabase/migrations/20260423_tracker_tables.sql`
2. `supabase/migrations/202604270001_game_updates.sql`
3. `supabase/migrations/202604270002_seed_game_updates.sql`

## 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## TypeScript and linting

TypeScript strict mode is enabled. Before submitting a PR:

```bash
npm run build   # type-check
npm run lint    # lint
```

## Project structure

```text
app/                  Next.js App Router pages and route handlers
  api/                API endpoints (players, groups, GE, cron, updates, admin)
  api-docs/           Interactive API documentation UI
  updates/            Updates listing, detail pages, archive, social images
bot/                  Standalone Discord notifier service
components/           Shared React UI components
lib/                  Shared server/client utilities and typed data services
supabase/migrations/  SQL schema and data migrations
scripts/              Utility scripts
```

## Cron job

The internal endpoint `/api/cron/update-players` refreshes player snapshots. Trigger with:

```text
GET /api/cron/update-players
Authorization: Bearer <CRON_SECRET>
```

## Updates platform

Game updates are database-backed (`public.game_updates`) with admin CRUD and public feeds.

| Endpoint | Description |
| -------- | ----------- |
| `GET /api/updates?limit=20` | Public JSON feed |
| `GET /api/updates/feed` | Public RSS feed |
| `/updates/[slug]/opengraph-image` | Dynamic Open Graph image |
| `/updates`, `/updates/archived` | Web UI |

The Discord bot also announces newly published updates by polling `/api/updates`.
