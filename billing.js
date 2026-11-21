"use strict";

const { Paddle, Environment } = require("@paddle/paddle-node-sdk");

const PRODUCT_NAME = "Roofing Lead CRM";
const STARTER_NAME = "Starter, 2 users";
const TEAM_NAME = "Team, 5 users";
const WEBHOOK_EVENTS = [
  "subscription.created",
  "subscription.trialing",
  "subscription.activated",
  "subscription.updated",
  "subscription.past_due",
  "subscription.canceled",
  "transaction.completed",
];

const CONFIG_KEYS = [
  "product_id",
  "price_starter_id",
  "price_team_id",
  "notification_destination_id",
  "webhook_endpoint_secret",
];

function paddleEnabled() {
  return String(process.env.PADDLE_ENABLED || "").trim() === "1";
}

function paddleEnv() {
  const value = String(process.env.PADDLE_ENV || "sandbox").trim().toLowerCase();
  return value === "production" ? "production" : "sandbox";
}

function envPresent(name) {
  return Boolean(String(process.env[name] || "").trim());
}

function createPaddleClient() {
  return new Paddle(String(process.env.PADDLE_API_KEY || ""), {
    environment: paddleEnv() === "production" ? Environment.production : Environment.sandbox,
  });
}

function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = req.get("host") || "localhost";
  return `${req.protocol || "http"}://${host}`;
}

function webhookUrl(base) {
  return String(base || "").replace(/\/+$/, "") + "/webhooks/paddle";
}

function assertCatalogAllowed(environment, allowProduction) {
  if (environment === "sandbox" || allowProduction) return;
  const error = new Error("Type PRODUCTION as well as SETUP before changing a live Paddle catalog.");
  error.status = 400;
  throw error;
}

async function listAll(collection) {
  const rows = [];
  for await (const item of collection) rows.push(item);
  return rows;
}

async function ensurePrice(paddle, prices, productId, plan) {
  const existing = prices.find((price) => price.name === plan.name || price.description === plan.name);
  if (existing) return existing;
  return paddle.prices.create({
    productId,
    description: plan.name,
    name: plan.name,
    unitPrice: { amount: plan.amount, currencyCode: "USD" },
    billingCycle: { interval: "month", frequency: 1 },
    trialPeriod: { interval: "day", frequency: 14 },
    taxMode: "account_setting",
  });
}

async function setupCatalog(paddle, { baseUrl, environment, allowProduction }) {
  assertCatalogAllowed(environment, allowProduction);
  const destinationUrl = webhookUrl(baseUrl);
  const products = await listAll(paddle.products.list());
  let product = products.find((item) => item.name === PRODUCT_NAME);
  if (!product) {
    product = await paddle.products.create({
      name: PRODUCT_NAME,
      taxCategory: "saas",
      description: "Lead form and CRM for small roofing companies.",
    });
  }
  const prices = await listAll(paddle.prices.list());
  const owned = prices.filter((price) => price.productId === product.id);
  const starter = await ensurePrice(paddle, owned, product.id, { name: STARTER_NAME, amount: "4900" });
  const team = await ensurePrice(paddle, owned.concat(starter), product.id, { name: TEAM_NAME, amount: "9900" });
  const settings = await listAll(paddle.notificationSettings.list());
  let destination = settings.find((item) => item.type === "url" && item.destination === destinationUrl);
  if (!destination) {
    destination = await paddle.notificationSettings.create({
      description: "Roofing Lead CRM subscription webhooks",
      type: "url",
      destination: destinationUrl,
      subscribedEvents: WEBHOOK_EVENTS,
      includeSensitiveFields: false,
    });
  }
  return {
    productId: product.id,
    starterPriceId: starter.id,
    teamPriceId: team.id,
    notificationDestinationId: destination.id,
    endpointSecret: destination.endpointSecretKey || "",
  };
}

async function getConfig(pool) {
  const result = await pool.query("SELECT key, value FROM billing_config");
  const config = {};
  for (const row of result.rows) config[row.key] = row.value;
  return config;
}

async function setConfig(pool, key, value) {
  if (!CONFIG_KEYS.includes(key) || value == null || value === "") return;
  await pool.query(
    `INSERT INTO billing_config (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, String(value), new Date().toISOString()]
  );
}

async function saveCatalog(pool, catalog) {
  await setConfig(pool, "product_id", catalog.productId);
  await setConfig(pool, "price_starter_id", catalog.starterPriceId);
  await setConfig(pool, "price_team_id", catalog.teamPriceId);
  await setConfig(pool, "notification_destination_id", catalog.notificationDestinationId);
  await setConfig(pool, "webhook_endpoint_secret", catalog.endpointSecret);
}

function presence(config) {
  return {
    apiKey: envPresent("PADDLE_API_KEY"),
    clientToken: envPresent("PADDLE_CLIENT_TOKEN"),
    sandbox: paddleEnv() === "sandbox",
    product: Boolean(config.product_id),
    starterPrice: Boolean(config.price_starter_id),
    teamPrice: Boolean(config.price_team_id),
    notification: Boolean(config.notification_destination_id),
    webhookSecret: Boolean(config.webhook_endpoint_secret),
  };
}

function safeBillingError(err) {
  let text = String((err && err.message) || "Paddle request failed.");
  for (const name of ["PADDLE_API_KEY", "PADDLE_CLIENT_TOKEN"]) {
    const secret = String(process.env[name] || "");
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text.slice(0, 300);
}

function subscriptionFromEvent(event) {
  const type = String(event.eventType || "");
  const data = event.data || {};
  if (!type.startsWith("subscription.")) return null;
  const item = (data.items && data.items[0]) || {};
  const price = item.price || {};
  const scheduled = data.scheduledChange;
  const scheduledCancel = scheduled && scheduled.action === "cancel" ? scheduled.effectiveAt || "scheduled" : "";
  return {
    paddle_customer_id: data.customerId || "",
    paddle_subscription_id: data.id || "",
    price_id: price.id || "",
    plan_name: price.name || price.description || "",
    status: data.status || "",
    trial_end: (item.trialDates && item.trialDates.endsAt) || "",
    current_period_end: (data.currentBillingPeriod && data.currentBillingPeriod.endsAt) || "",
    scheduled_cancel: scheduledCancel,
    raw_last_event_id: event.eventId || "",
  };
}

async function applyWebhook(pool, rawBody, signature) {
  const config = await getConfig(pool);
  const secret = config.webhook_endpoint_secret || "";
  if (!secret || !signature) {
    const error = new Error("Invalid signature");
    error.status = 400;
    throw error;
  }
  let event;
  try {
    event = await createPaddleClient().webhooks.unmarshal(String(rawBody || ""), secret, signature);
  } catch (err) {
    const error = new Error("Invalid signature");
    error.status = 400;
    throw error;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      "INSERT INTO billing_events (event_id, type, received_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING event_id",
      [event.eventId, event.eventType, new Date().toISOString()]
    );
    if (!inserted.rowCount) {
      await client.query("COMMIT");
      console.log("paddle webhook " + event.eventType + " " + event.eventId);
      return { duplicate: true };
    }
    const row = subscriptionFromEvent(event);
    if (row && row.paddle_subscription_id) {
      await client.query(
        `INSERT INTO billing_subscriptions (
           paddle_customer_id, paddle_subscription_id, price_id, plan_name, status,
           trial_end, current_period_end, scheduled_cancel, updated_at, raw_last_event_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (paddle_subscription_id) DO UPDATE SET
           paddle_customer_id = EXCLUDED.paddle_customer_id,
           price_id = EXCLUDED.price_id,
           plan_name = EXCLUDED.plan_name,
           status = EXCLUDED.status,
           trial_end = EXCLUDED.trial_end,
           current_period_end = EXCLUDED.current_period_end,
           scheduled_cancel = EXCLUDED.scheduled_cancel,
           updated_at = EXCLUDED.updated_at,
           raw_last_event_id = EXCLUDED.raw_last_event_id`,
        [
          row.paddle_customer_id,
          row.paddle_subscription_id,
          row.price_id,
          row.plan_name,
          row.status,
          row.trial_end,
          row.current_period_end,
          row.scheduled_cancel,
          new Date().toISOString(),
          row.raw_last_event_id,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  console.log("paddle webhook " + event.eventType + " " + event.eventId);
  return { duplicate: false };
}

async function listSubscriptions(pool) {
  const result = await pool.query(
    "SELECT paddle_customer_id, paddle_subscription_id, price_id, plan_name, status, trial_end, current_period_end, scheduled_cancel, updated_at FROM billing_subscriptions ORDER BY updated_at DESC, id DESC"
  );
  return result.rows;
}

async function portalUrl(paddle, customerId, subscriptionId) {
  const ids = subscriptionId ? [subscriptionId] : undefined;
  const session = await paddle.customerPortalSessions.create(customerId, ids);
  const url = session.urls && session.urls.general && session.urls.general.overview;
  if (!url || !/^https:\/\//.test(url)) {
    const error = new Error("Paddle did not return a customer portal link.");
    error.status = 502;
    throw error;
  }
  return url;
}

module.exports = {
  PRODUCT_NAME,
  STARTER_NAME,
  TEAM_NAME,
  WEBHOOK_EVENTS,
  paddleEnabled,
  paddleEnv,
  createPaddleClient,
  publicBaseUrl,
  webhookUrl,
  assertCatalogAllowed,
  setupCatalog,
  getConfig,
  saveCatalog,
  presence,
  safeBillingError,
  applyWebhook,
  listSubscriptions,
  portalUrl,
  subscriptionFromEvent,
};
