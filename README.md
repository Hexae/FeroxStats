<div align="center">

<img src="./public/logo/logo.png" alt="FeroxStats logo" width="120" />


The open-source stats and analytics platform for the Ferox.ps OSRS private server.

FeroxStats tracks player progress, group events, Grand Exchange activity, competitions, and more — built for the [Ferox.ps](https://ferox.ps) Old School RuneScape private server.

[![Build Status](https://github.com/Hexae/RSPS_Stats/actions/workflows/ci.yml/badge.svg)](https://github.com/Hexae/RSPS_Stats/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Hexae/RSPS_Stats)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/Hexae/RSPS_Stats)](https://github.com/Hexae/RSPS_Stats/commits)
[![Open Issues](https://img.shields.io/github/issues/Hexae/RSPS_Stats)](https://github.com/Hexae/RSPS_Stats/issues)

[Website](https://www.feroxstats.com/) | [Discord](#) | [API Docs](https://www.feroxstats.com/api-docs)

</div>

<br />

> This project is not affiliated with Jagex Ltd or the official Old School RuneScape game.

## Project structure and stack

The repository is divided into two components:

- **App**: (The web app & API)
  - Next.js 16 (App Router)
  - React 19 + Tailwind CSS v4
  - Supabase (Postgres + Auth + RLS)
  - Chart.js + SWR

- **Bot**: (The Discord notifier)
  - Node.js + TypeScript
  - Supabase JS

<br />

## API

FeroxStats exposes a REST API used by the web app and bot. Interactive documentation is available at `/api-docs` on any running instance.

<br />

## Suggestions and bugs

Have a suggestion or a bug to report? [Click here to create an issue](https://github.com/your-org/feroxstats/issues)

Have something else you'd like to discuss? [Join us on Discord](#)

<br />

## Screenshots

### Leaderboard

![Leaderboard](./public/screenshot/leaderboard.png)

### GE analytics (overview)

![GE Analytics Overview](./public/screenshot/ge_overview.png)

### GE analytics (item detail)

![GE Item Detail](./public/screenshot/ge_item_dragon_bones.png)

### Groups

![Groups](./public/screenshot/group_skillnation.png)

### Updates

![Updates](./public/screenshot/latest_updates.png)

<br />

## Contributing

Check the development guides below to get started:

**Help expand and improve the FeroxStats web app:** [App Development Guide](.github/contributing/app-guide.md)

**Help expand and improve the FeroxStats Discord bot:** [Bot Development Guide](.github/contributing/bot-guide.md)

<br />

## License

[MIT](LICENSE)
