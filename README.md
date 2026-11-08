# Tracker

A personal tracker for daily habits, to-dos, measurable goals and mood/journal, with a stats dashboard.
Built with Next.js (App Router), Neon Postgres + Drizzle ORM, and Tailwind CSS. Deploys to Vercel.

## Features

- **Today**: tick off habits for the day (or browse back to backfill), +/- counters for measurable goals,
  per-check-in notes, tasks due today with quick-add, mood + energy + a short note.
- **Habits**: yes/no or measurable (target + unit), every day / specific weekdays / N times per week,
  categories, tags, colors, icons, reminder times, archive, reorder. Each habit has a detail page with
  streaks, completion rates, a clickable month calendar for editing history, a by-weekday chart and notes.
- **Tasks**: priority, due dates, subtasks, categories, tags, push reminders at a set date/time,
  filters (today / overdue / upcoming / no date / completed), search, sort, grouping by due bucket.
- **Journal**: daily entry with mood, energy and tags, autosave, mood-colored month calendar, search, writing streak.
- **Dashboard**: today's progress, 30-day completion with delta, best active streak, tasks this week,
  average mood, a year-long consistency heatmap, completion trend (30 days / 12 weeks / 12 months),
  mood & energy chart, tasks completed per day, completion by category, a per-habit leaderboard,
  and auto-generated insights (best/worst weekday, most consistent / most skipped habit, trend, mood vs habits).
- **Accounts**: email + password (bcrypt), signed HTTP-only session cookie, change password, delete account.
- **PWA**: installable on phone home screens, dark/light/system theme, offline fallback page.
- **Notifications**: Web Push for habit reminders and task reminders.
- **Export**: everything as JSON, or habit check-ins / habits / tasks / journal as CSV.

## Local setup

1. Create a Neon project at <https://console.neon.tech> and copy the **pooled** connection string.
2. `cp .env.example .env.local` and fill in `DATABASE_URL` and `AUTH_SECRET` (32+ random characters).
3. Optional, for reminders: `npx web-push generate-vapid-keys` and put the keys in `.env.local`.
4. Install and create the tables:
   ```bash
   npm install
   npm run db:push
   ```
5. `npm run dev` and open <http://localhost:3000>. Sign up and you're in.

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel (or run `vercel`).
2. Add the env vars from `.env.example` in **Project → Settings → Environment Variables**.
   You can also use the Neon integration from the Vercel Marketplace, which sets `DATABASE_URL` for you.
3. Run `npm run db:push` once against the production database (with `DATABASE_URL` pointed at it).
4. Deploy.

### Reminders (cron)

Reminders are sent by `GET /api/cron/reminders`, authorised with `Authorization: Bearer $CRON_SECRET`
(or `?secret=$CRON_SECRET`). It should run every 5–15 minutes:

- **Vercel Pro**: add a `vercel.json` with
  `{"crons":[{"path":"/api/cron/reminders","schedule":"*/10 * * * *"}]}`. Vercel sends the
  `CRON_SECRET` header automatically.
- **Vercel Hobby** only allows daily crons, so use a free external scheduler (e.g. cron-job.org,
  GitHub Actions) to call `https://<your-app>/api/cron/reminders?secret=<CRON_SECRET>` every 10 minutes.

Then open **Settings → Notifications → Enable** on each device. On iPhone, add the app to your Home
Screen first and enable notifications from the installed app (iOS 16.4+).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:push` | Sync the Drizzle schema to the database |
| `npm run db:generate` | Generate SQL migration files into `drizzle/` |
| `npm run db:migrate` | Apply generated migrations |
| `npm run db:studio` | Open Drizzle Studio to browse data |

## Project layout

```
app/(auth)/        login + signup
app/(app)/         signed-in pages: today, dashboard, habits, tasks, journal, settings
app/api/           export + cron reminder endpoints
app/icons/         generated PWA icons
components/        shared UI (forms, rows, nav, toasts)
lib/db/            Drizzle schema + Neon client
lib/actions/       server actions (all mutations)
lib/stats.ts       streaks, completion rates, heatmap scores, insights
lib/dates.ts       timezone-aware day helpers
proxy.ts           route protection (redirects to /login)
public/sw.js       service worker (push + offline)
```
