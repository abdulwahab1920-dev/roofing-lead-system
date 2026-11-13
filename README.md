# Summit Ridge Roofing — Lead Form & CRM

## Run locally

```bash
npm install
ADMIN_USERNAME=admin ADMIN_PASSWORD='use-a-long-local-password' SESSION_SECRET='replace-with-at-least-32-random-characters' npm start
```

Requires Node.js 22 or newer. The app listens on `0.0.0.0:$PORT` (default 3847).

## Routes

- Public lead form: `/`
- CRM login: `/admin/login`
- Dashboard: `/admin`
- Leads: `/admin/leads`
- Notifications: `/admin/notifications`
- Follow-up tasks: `/admin/tasks`
- Email log: `/admin/emails`

## Required production environment variables

- `ADMIN_USERNAME`: private admin login name.
- `ADMIN_PASSWORD`: strong unique password (at least 16 characters).
- `SESSION_SECRET`: random secret (at least 32 characters).
- `DB_PATH`: absolute path on a persistent mounted disk, for example `/var/data/leads.db`.

Optional:

- `OPENAI_API_KEY`: enables OpenAI lead scoring refinement. Without it, the app uses transparent rule-based scoring.
- `OPENAI_MODEL`: defaults to `gpt-4o-mini`.
- `COMPANY_NAME`, `COMPANY_PHONE`, `COMPANY_LOCATION`, `SERVICE_AREA`: customer-specific public branding. Defaults are demo values; replace them before a client launch.
- `SEED_DEMO_DATA=true`: explicitly seeds sample leads on a fresh database. Keep unset/false for production.
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `NOTIFY_EMAIL` or `SMTP_TO`. Both sender and recipient must be configured; email is not delivered until SMTP is configured and tested.

## Render deployment checklist

1. Attach a persistent disk to the web service, mounted at `/var/data`.
2. Set `DB_PATH=/var/data/leads.db`.
3. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` as Render environment variables. Do not commit them to Git.
4. Keep `SEED_DEMO_DATA` unset/false for production.
5. Set `OPENAI_API_KEY` if you want model-assisted scoring. Without it, rule-based scoring is used.
6. Deploy this branch only after reviewing the pull request. Verify the disk mount and environment variables before switching production traffic.

SQLite lead data and login sessions share the database at `DB_PATH`. The app refuses to start in production if `DB_PATH` is missing or is not an absolute path. A persistent disk is required on Render because its ordinary service filesystem is ephemeral.

## Lead scoring and workflow

Each submitted lead is first given a deterministic rule-based score. If `OPENAI_API_KEY` is configured, the app attempts to refine that score with the configured OpenAI model; if the API is unavailable, it keeps the rule-based fallback. Scoring finishes before notifications and the follow-up task are created, so the task uses the final available priority and recommended follow-up.

A new lead creates an in-app notification, a follow-up task, and an email log entry. Actual email delivery requires SMTP configuration. Overdue tasks are flagged by the periodic workflow check.

Demo-only forced overdue tasks and artificial extra follow-ups have been removed. Existing valid tasks are not automatically modified or deleted.


## Customer onboarding checklist

- Set `COMPANY_NAME`, `COMPANY_PHONE`, `COMPANY_LOCATION`, and `SERVICE_AREA` to the customer's approved details.
- Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `DB_PATH` on persistent storage.
- Configure a real mailbox/provider with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (use `1` for implicit TLS/port 465), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `SMTP_TO` (or `NOTIFY_EMAIL`).
- Submit a controlled test lead and verify it appears in the CRM and that a test notification is received. Check the email log for the result.
- Do not use the Summit Ridge demo identity, sample phone number, or example contact details for a customer's public launch.
- Obtain the customer's approval before publishing their contact information or sending any real customer-facing messages.
