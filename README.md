# Roofing Lead Form & CRM

## Run locally

```bash
npm install
ADMIN_USERNAME=admin ADMIN_PASSWORD='use-a-long-local-password' SESSION_SECRET='replace-with-at-least-32-random-characters' npm start
```

Requires Node.js 22 or newer. The app listens on `0.0.0.0:$PORT` (default 3847).

## Routes

- Product page for roofers: `/`
- Public inspection form: `/inspection`
- Privacy: `/privacy`
- Terms: `/terms`
- Refunds: `/refunds`
- Pilot request: `POST /pilot` (stored in the database and the staff notifications list)
- CRM login: `/admin/login`
- Dashboard: `/admin`
- Leads: `/admin/leads`
- Notifications: `/admin/notifications`
- Follow-up tasks: `/admin/tasks`
- Email log: `/admin/emails`
- New lead: `/admin/leads/new`
- CSV import: `/admin/leads/import` (`/admin/import` redirects here)
- CSV export: `/admin/leads/export.csv` (`/admin/export` and `/admin/leads/export` redirect here)

## Demo data

Sample leads are fictional US homeowners: `example.com` emails, `555-010` phone numbers, and street names like Demo Lane. Nothing in the seed is a real customer.

Dates are calculated when the seed runs, relative to that moment. The task list then contains a mix of overdue, due today, upcoming, and completed follow-ups. Leads are spread across the last few weeks and the statuses New, Contacted, Quoted, Won, Lost, and Cold. Cold is both a status and, for the sample cold leads, the scoring priority.

Startup applies this seed only when `RESET_DEMO_DATA` is set to a token the app has not applied before. To load the sample data again from a machine that has `DATABASE_URL`, which deletes existing leads, tasks, notes, notifications, emails, and photos:

```bash
DATABASE_URL='postgres://…' npm run reseed
```

That command keeps the current `RESET_DEMO_DATA` token when one is set, so the next startup does not wipe the database a second time. Leave `RESET_DEMO_DATA` unset on a real customer install.

On Render, where there is no shell, an admin can reseed only while `ALLOW_DEMO_RESEED` is exactly `1`. The page is `POST /admin/reseed` after login, and the form requires the confirmation text `RESEED`. With the variable unset, that URL is a normal 404 and the nav link is hidden. Remove the variable and deploy again after the reseed so the action is no longer available.

## Free-tier hosting plan

The intended initial no-monthly-cost stack is:

- Render Free for the Node.js web service (may sleep when idle).
- Neon Free PostgreSQL for persistent lead, task, notification, and session data.
- Resend Free API for email notifications over HTTPS (no SMTP ports required).

**Important:** this branch now contains a PostgreSQL runtime and PostgreSQL-backed session store, with a CI integration test configured against PostgreSQL 16. It remains a draft until CI passes and a real Neon/Resend end-to-end test is completed. Do not connect it to the live Render service or use it for real customer data yet.

## Required production environment variables

- `ADMIN_USERNAME`: private admin login name.
- `ADMIN_PASSWORD`: strong unique password (at least 16 characters).
- `SESSION_SECRET`: random secret (at least 32 characters).
- `DATABASE_URL`: Neon PostgreSQL connection string. Keep it private.
- `RESEND_API_KEY`: Resend API key. Keep it private.
- `NOTIFY_EMAIL`: address that should receive new lead alerts.
- `EMAIL_FROM`: verified sender address/domain configured in Resend.

Optional:

- `OPENAI_API_KEY`: enables OpenAI lead scoring refinement. Without it, the app uses transparent rule-based scoring.
- `OPENAI_MODEL`: defaults to `gpt-4o-mini`.
- `COMPANY_NAME`, `COMPANY_PHONE`, `COMPANY_LOCATION`, `SERVICE_AREA`: public branding used on the form, admin, emails, and AI next-step copy. `COMPANY_NAME` defaults to `Artific Creations Demo`.
- `RESET_DEMO_DATA`: optional one-time demo reset token. When this value changes, the app wipes leads/tasks/notes/notifications/emails and seeds fictional US sample leads. Restarting with the same token does not wipe again. Leave unset on a real customer install.
- `APP_TIMEZONE`: IANA time zone for CRM dates, “today/this month” filters, and task due times. Defaults to `America/Denver` (Mountain Time). Examples: `America/Chicago`, `America/New_York`, `Asia/Karachi`, `UTC`. Times in the CRM include a short zone label such as MST, CST, or PKT.
- `APP_URL`: public site origin used in lead-alert email links, for example `https://roofing-crm-staging.onrender.com`. Optional on Render, which already sets `RENDER_EXTERNAL_URL` automatically. If neither is set, the email keeps a relative CRM path.

## Email delivery

Lead notifications use the Resend HTTPS API. The application logs the email result in the CRM. A successful HTTP response from Resend means the provider accepted the message; it does not guarantee inbox placement. A verified sending domain/address is required before real customer notifications can be sent.

## Customer onboarding checklist

- Set the customer's approved company name, phone, location, and service area.
- Create a separate Neon database for the customer and apply `postgres-schema.sql`.
- Set the production admin username, strong password, session secret, and database connection string in Render environment variables.
- Configure a verified Resend sender and recipient.
- Submit a controlled test lead and verify it appears in the CRM, remains after a service restart, and triggers the expected email.
- Do not use demo identity, sample phone numbers, or example contact details for a customer's public launch.
- Obtain the customer's approval before publishing contact information or sending real customer-facing messages.

## Current development status

This branch is a separate migration track. It does not change the existing production branch or live Render service. The PostgreSQL runtime, PostgreSQL session store, Resend API sender, and CI integration test are now present. The app has passed its PostgreSQL 16 CI integration test. Live Neon/Resend verification and environment configuration are the remaining deployment gates. This branch does not alter the existing live Render service.
