# FeroxStats

A full-featured analytics, leaderboard, and content platform for the [Ferox.ps](https://ferox.ps) Old School RuneScape private server.

## Features

- Live player stats and hiscores, synced from the Ferox API
- Grand Exchange analytics, trade history, and price history
- Snapshot-based progression tracking and top gains
- Group management, join requests, and group competitions
- Side-by-side player comparison
- Authenticated profile features (claim, screenshots, settings)
- Admin panel for moderation and game update publishing
- Markdown-powered updates hub with archive, OG images, JSON feed, and RSS feed
- Companion Discord bot for group events, achievements, deaths, competitions, and new updates

> This project is not affiliated with Jagex Ltd or the official Old School RuneScape game.

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | [Next.js](https://nextjs.org) (App Router, v16) |
| UI | React 19 + Tailwind CSS v4 |
| Database / Auth | [Supabase](https://supabase.com) (Postgres + Auth + RLS) |
| Charts | [Chart.js](https://www.chartjs.org) + [react-chartjs-2](https://react-chartjs-2.js.org) |
| Data fetching | [SWR](https://swr.vercel.app) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) |
| Discord bot | Node.js + Supabase JS |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-username/feroxstats.git
cd feroxstats
npm install
```

### 2. Configure web app environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Project Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase Project Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only secret key |
| `CRON_SECRET` | Yes | Bearer secret for `/api/cron/update-players` |
| `RESEND_API_KEY` | Yes (for email) | Used by Supabase SMTP setup with Resend |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | Yes (for auth forms) | hCaptcha site key |
| `NEXT_PUBLIC_FEROX_API_BASE` | Optional | Defaults to `https://ferox.ps/api` |
| `NEXT_PUBLIC_SITE_URL` | Optional | Used for absolute feed URLs and metadata |

### 3. Apply database migrations

Migrations live in `supabase/migrations/`.

If you use Supabase CLI:

```bash
npx supabase db push
```

If CLI is unavailable, run migration SQL files manually in Supabase SQL Editor (in order):

1. `supabase/migrations/20260423_tracker_tables.sql`
2. `supabase/migrations/202604270001_game_updates.sql`
3. `supabase/migrations/202604270002_seed_game_updates.sql`

### 4. Start the web app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Bot Setup (Optional)

```bash
cd bot
cp .env.example .env
npm install
npm run dev
```

Bot environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`
- `POLL_INTERVAL_MS` (optional, defaults to 60000)

Build and run bot in production mode:

```bash
cd bot
npm run build
npm start
```

---

## Updates Platform

Game updates are now database-backed (`public.game_updates`) with admin CRUD and public feeds.

- Admin CRUD API: `app/api/admin/updates/route.ts`
- Public JSON feed: `GET /api/updates?limit=20`
- Public RSS feed: `GET /api/updates/feed`
- Dynamic Open Graph image: `/updates/[slug]/opengraph-image`
- Web UI: `/updates` and `/updates/archived`

The Discord bot also announces newly published updates by polling `/api/updates`.

---

## API Docs

Interactive API reference is available at:

- `/api-docs`

This documents public, authenticated, admin, and internal endpoints used by the app.

---

## Cron Job

The internal endpoint `/api/cron/update-players` refreshes player snapshots and summary fields.

Trigger using:

```text
GET /api/cron/update-players
Authorization: Bearer <CRON_SECRET>
```

---

## Project Structure

```text
app/                  Next.js App Router pages and route handlers
  api/                API endpoints (players, groups, GE, cron, updates, admin)
  api-docs/           Interactive API documentation UI
  updates/            Updates listing, detail pages, archive, social images
bot/                  Standalone Discord notifier service
  src/notify/         Notification handlers (members, competitions, achievements, deaths, updates)
components/           Shared React UI components
lib/                  Shared server/client utilities and typed data services
  updates-service.ts  Canonical updates data layer (Supabase + fallback)
supabase/migrations/  SQL schema and data migrations
scripts/              Utility scripts (including update seed migration generator)
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
