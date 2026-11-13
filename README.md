# Summit Ridge Roofing — Lead Form & CRM (Parts 1–4)

## How to run

```bash
cd /workspace/roofing-lead-system
npm install
npm start
```

The app listens on `0.0.0.0:3847` (override with `PORT`).

## URLs

- Public lead form: http://localhost:3847/
- Thank-you page: http://localhost:3847/thanks
- CRM login: http://localhost:3847/admin/login
- Dashboard: http://localhost:3847/admin
- CRM lead list: http://localhost:3847/admin/leads
- Notifications: http://localhost:3847/admin/notifications
- Follow-up tasks: http://localhost:3847/admin/tasks
- Email log: http://localhost:3847/admin/emails

## Credentials

- Username: `admin`
- Password: `SummitRidge2026!`

The SQLite database is created at `data/leads.db` and seeded with sample leads on first run if empty.


## Scoring

New leads are scored automatically when the form is submitted. Existing leads are backfilled on startup if they have no score. A **Re-run scoring** button is on each lead detail page.

The default engine in `ai/leadScorer.js` is offline and needs no API key. It classifies the job, assigns a 0–100 score and Hot/Warm/Cold priority, estimates a 2026 US job-value range, and writes a short sales summary plus a recommended follow-up time.

If `OPENAI_API_KEY` is already set in the environment, scoring may be refined by OpenAI. The key is optional and the app works the same without it.


## Notifications and tasks

A new website lead creates an in-app notification (bell in the admin header), a follow-up task timed from the AI recommendation (for example, call within 15 minutes for a Hot emergency), and an internal email alert.

Every outbound email is written to the **Email log** (`/admin/emails`) with to, subject, body, timestamp, and status, even when SMTP is not configured. If `SMTP_HOST` (and optional `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `NOTIFY_EMAIL` / `SMTP_TO`) is already set, the app also tries to send the message.

The **Tasks** page groups follow-ups into overdue, today, and upcoming. You can complete or snooze a task (1 hour or 1 day), and add a task from a lead’s detail page. A lightweight 30-second check flags newly overdue tasks and adds a reminder notification.


## Dashboard

The admin home page at http://localhost:3847/admin is a live dashboard of SQLite data: new leads today, open Hot leads, pipeline (not Won/Lost), won this month (by date received), and overdue follow-ups. Tiles and charts link through to the filtered lead list or the tasks page. The full lead list is at `/admin/leads`. Dates for “today” and “this month” use America/Denver.
