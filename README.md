# Roofing Lead Form & CRM

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

## Free-tier hosting plan

The intended initial no-monthly-cost stack is:

- Render Free for the Node.js web service (may sleep when idle).
- Neon Free PostgreSQL for persistent lead, task, notification, and session data.
- Resend Free API for email notifications over HTTPS (no SMTP ports required).

**Important:** the PostgreSQL runtime adapter and end-to-end database migration are not complete yet. Do not connect this branch to the live Render service or use it for real customer data until the migration tests pass. The file `postgres-schema.sql` is the target database schema, not a substitute for the unfinished application adapter.

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
- `COMPANY_NAME`, `COMPANY_PHONE`, `COMPANY_LOCATION`, `SERVICE_AREA`: customer-specific public branding.
- `SEED_DEMO_DATA=true`: explicitly seeds sample leads on a fresh database. Keep unset/false for production.

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

This branch is a separate migration track. It does not change the existing production branch or live Render service. The Resend API sender and PostgreSQL schema are prepared; the application-wide PostgreSQL query/session adapter and corresponding CI coverage must be completed before deployment.
