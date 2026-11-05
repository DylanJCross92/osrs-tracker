# OSRS XP Tracker

Tracks Old School RuneScape hiscores for a list of players: a snapshot is
taken the moment you add someone, then automatically every 6 hours after
that, so you can watch XP gains over time on a chart.

## Stack

**Frontend** (this directory) — Vue 3 (`<script setup>`), Vite, Vue Router,
Pinia, Vitest.

**Backend** ([`server/`](server/)) — Express + PostgreSQL (`pg`), a
`node-cron` job that re-polls the official OSRS hiscores feed every 6 hours.

No accounts/login — anyone who can reach the app can add, remove, or view
any tracked player. OSRS stats are public information anyway.

## Getting started

Start the API first:

```bash
cd server
cp .env.example .env
docker compose up -d
npm install
npm run migrate
npm run dev            # http://localhost:4000
```

Then the frontend, from the repo root:

```bash
npm install
npm run dev        # http://localhost:5173
npm run build       # production build -> dist/
npm run test        # run the test suite
```

Add a player's RSN on the home page — it's fetched from the hiscores
immediately, then re-synced every 6 hours (override with `SYNC_CRON` in
`server/.env`, e.g. `*/5 * * * *` for a short interval while testing). Click
a player to see their XP-over-time chart for any skill, plus day/week/month
gain stats and a "Refresh Now" button for an on-demand sync.

## Project structure

```
src/
  api/          client.js (fetch wrapper) + players.js
  components/   XpLineChart.vue (the chart), ToastHost.vue
  composables/  useToast
  router/       players list + player detail routes
  stores/       players.js — Pinia store backed by the API
  utils/        osrsSkills.js (skill list, xp formatting, gain calc), time.js
  views/        PlayersView (list + add), PlayerDetailView (chart, stats, table)
server/         Express + PostgreSQL API
  src/
    services/osrsHiscores.service.js  — fetches/parses the public hiscores feed
    services/players.service.js       — DB reads/writes
    routes/players.routes.js          — /api/players REST routes
    jobs/sync.js                      — the 6-hourly cron job
```

## Notes

- The hiscores feed is the official public endpoint Jagex also uses for its
  in-game widget (`secure.runescape.com/m=hiscore_oldschool/index_lite.json`)
  — no API key needed, but an unranked/never-logged-in RSN returns 404.
- The XP chart is a hand-built inline-SVG line chart (no charting library):
  single-hue line, hairline gridlines, a crosshair + tooltip on hover/keyboard
  focus, and a y-axis zoomed to the data's own range rather than starting at
  zero, since a long-tracked player's total XP dwarfs a week's gains.
- `docker-compose.yml` is for local Postgres only — no production deploy config.
