# FeroxStats

A comprehensive analytics and hiscores platform for the [Ferox.ps](https://ferox.ps) Old School RuneScape private server.

## Features

- **Live player stats and hiscores** — track skill progress and server-wide rankings, updated automatically from the Ferox API
- **Grand Exchange analytics** — live trading data, item prices, and transaction history from the in-game GE
- **Snapshot history** — every player lookup saves a snapshot, building a progression timeline
- **Competitions** — create and track group XP competitions with live leaderboards
- **Groups** — clans can manage members, set ranks, and receive Discord notifications via the companion bot
- **Player comparison** — compare up to 5 players side-by-side across all skills
- **Mobile-friendly UI** — fully responsive design with instant player lookup and data visualizations

> This project is not affiliated with Jagex Ltd or the official Old School RuneScape game.

---

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Framework | [Next.js](https://nextjs.org) (App Router) |
| Database / Auth | [Supabase](https://supabase.com) (Postgres + Auth + RLS) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Charts | [Chart.js](https://www.chartjs.org) via [react-chartjs-2](https://react-chartjs-2.js.org) |
| Data fetching | [SWR](https://swr.vercel.app) |
| Discord bot | Node.js + Supabase JS (no discord.js) |

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is sufficient for development)

### 1. Clone and install

```bash
git clone https://github.com/your-username/feroxstats.git
cd feroxstats
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

| Variable | Where to find it |
| -------- | ---------------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard ? Project Settings ? API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard ? Project Settings ? API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard ? Project Settings ? API (secret) |
| `CRON_SECRET` | Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_FEROX_API_BASE` | Optional — defaults to `https://ferox.ps/api` |

### 3. Set up the database

Apply the schema migrations from `bot/supabase/migration.sql` via the Supabase SQL editor or the Supabase CLI:

```bash
npx supabase db push
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Project structure

```text
app/              # Next.js App Router pages and API routes
  api/            # REST API endpoints
  auth/           # Login, register, and auth callback pages
  player/         # Per-player stats pages
  groups/         # Group management pages
  ...
bot/              # Discord notification bot (standalone Node.js process)
  src/
    db.ts         # Supabase helpers
    discord.ts    # Webhook helpers
    notify/       # Event handlers (members, competitions, achievements, deaths)
components/       # Shared React components (Navbar, Footer, etc.)
lib/              # Shared server-side utilities
  osrs.ts         # OSRS game data and Ferox API client
  api-utils.ts    # Rate limiting, validation helpers
  admin-auth.ts   # Admin authentication helper for /api/admin/* routes
  supabase*.ts    # Supabase client factories
public/           # Static assets (rank icons)
supabase/         # Email templates
```

---

## Cron job

The `/api/cron/update-players` endpoint refreshes all player stats.
Trigger it on a schedule (e.g. Vercel Cron, GitHub Actions, or an external
scheduler) with:

```text
GET /api/cron/update-players
Authorization: Bearer <CRON_SECRET>
```

---

## Discord bot

The bot polls Supabase every 60 seconds and sends Discord webhook notifications
for group events (member joins/leaves, competition updates, level-up
achievements, deaths).

```bash
cd bot
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
npm install
npm start
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
