# Paddle billing

Paddle billing is off unless `PADDLE_ENABLED` is exactly `1`. With any other value, `/subscribe`, `/subscribe/thanks`, `/admin/billing`, and `/webhooks/paddle` are the normal 404, and existing pages do not mention checkout. Subscription status never locks the CRM.

The server uses `@paddle/paddle-node-sdk`. Checkout uses Paddle.js from `https://cdn.paddle.com/paddle/v2/paddle.js`, and only on `/subscribe`.

## Environment variables

Set these in Render. Do not commit them.

- `PADDLE_ENABLED` — set to `1` to turn billing on. Anything else leaves it off.
- `PADDLE_ENV` — `sandbox` or `production`. Defaults to `sandbox`.
- `PADDLE_API_KEY` — server-side API key for that environment.
- `PADDLE_CLIENT_TOKEN` — client-side token. Paddle.js on `/subscribe` needs it. The admin page only shows whether it is set.
- `PUBLIC_BASE_URL` — public origin, such as `https://your-app.onrender.com`, with no trailing slash. The webhook is `{PUBLIC_BASE_URL}/webhooks/paddle`. If this is unset, the setup page uses the request host. Set it on Render so the destination is the public URL, not an internal host.

`NOTIFY_EMAIL` and `EMAIL_FROM` are lead-alert mail, not Paddle.

## Turn it on in sandbox

1. Create a sandbox API key and a sandbox client-side token in Paddle.
2. Set the variables above. Keep `PADDLE_ENV` as `sandbox` and set `PADDLE_ENABLED` to `1`.
3. Deploy.
4. Sign in and open `/admin/billing`.
5. Check the public site URL shown on that page.
6. Type `SETUP` and press **Set up Paddle sandbox catalog**.

That creates, or reuses:

- Product `Roofing Lead CRM` (`tax_category` `saas`)
- Monthly price `Starter, 2 users` at $49.00 USD
- Monthly price `Team, 5 users` at $99.00 USD
- A 14-day free trial on each price (`trial_period` interval `day`, frequency `14`, no trial charge)
- A webhook destination for `subscription.created`, `subscription.trialing`, `subscription.activated`, `subscription.updated`, `subscription.past_due`, `subscription.canceled`, and `transaction.completed`

Running setup again reuses a product, price, or destination with the same name or URL. The endpoint secret is stored in `billing_config` and is not shown in the app. Paddle returns that secret when the destination is created. If the destination already exists and Paddle does not return the secret again, the stored secret is left as it is.

Open `/subscribe` to start a sandbox checkout. The pay buttons stay off until the Terms and Refund Policy checkbox is checked. Sandbox shows “Test mode, no real charges”.

`/admin/billing` lists subscription status from webhooks. **Customer portal** creates a new portal session and redirects to it, so the customer can cancel or update the card. Do not save that link.

## Go live

Sandbox ids do not work in production. To go live:

1. Use a live API key and a live client-side token.
2. Set `PADDLE_ENV` to `production` and `PUBLIC_BASE_URL` to the live origin.
3. On `/admin/billing`, type `SETUP` and also type `PRODUCTION`. The setup refuses a live catalog change without that second word.
4. Complete Paddle’s own go-live checks (approved website, live default payment link). This app does not do those.

Gating is not built. A missing or canceled subscription does not hide leads, tasks, or the dashboard.
