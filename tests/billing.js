"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createHmac, randomInt } = require("node:crypto");
const path = require("node:path");
const { Client } = require("pg");
const billing = require("../billing");
const { REFUND_DAYS, PADDLE_ORDER_SENTENCE } = require("../legal");

function iterable(items) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

function fakePaddle() {
  const state = { products: [], prices: [], settings: [], calls: [] };
  return {
    state,
    products: {
      list: () => iterable(state.products),
      create: async (body) => {
        state.calls.push("product");
        const row = { id: "pro_testcatalog", name: body.name, taxCategory: body.taxCategory };
        state.products.push(row);
        return row;
      },
    },
    prices: {
      list: () => iterable(state.prices),
      create: async (body) => {
        state.calls.push("price:" + body.unitPrice.amount);
        assert.equal(body.trialPeriod.interval, "day");
        assert.equal(body.trialPeriod.frequency, 14);
        assert.equal(body.trialPeriod.unitPrice, undefined);
        assert.equal(body.billingCycle.interval, "month");
        assert.equal(body.billingCycle.frequency, 1);
        assert.equal(body.unitPrice.currencyCode, "USD");
        const row = {
          id: "pri_" + body.unitPrice.amount,
          name: body.name,
          description: body.description,
          productId: body.productId,
        };
        state.prices.push(row);
        return row;
      },
    },
    notificationSettings: {
      list: () => iterable(state.settings),
      create: async (body) => {
        state.calls.push("notification");
        assert.deepEqual(body.subscribedEvents, billing.WEBHOOK_EVENTS);
        const row = {
          id: "ntfset_test",
          type: "url",
          destination: body.destination,
          endpointSecretKey: "generated_secret_not_for_html",
        };
        state.settings.push(row);
        return row;
      },
    },
  };
}

(async () => {
  assert.throws(() => billing.assertCatalogAllowed("production", false), /PRODUCTION/);
  billing.assertCatalogAllowed("sandbox", false);
  billing.assertCatalogAllowed("production", true);

  const fake = fakePaddle();
  const first = await billing.setupCatalog(fake, {
    baseUrl: "https://crm.example",
    environment: "sandbox",
    allowProduction: false,
  });
  assert.equal(first.productId, "pro_testcatalog");
  assert.equal(first.starterPriceId, "pri_4900");
  assert.equal(first.teamPriceId, "pri_9900");
  assert.equal(first.endpointSecret, "generated_secret_not_for_html");
  assert.equal(fake.state.calls.length, 4);
  const second = await billing.setupCatalog(fake, {
    baseUrl: "https://crm.example",
    environment: "sandbox",
    allowProduction: false,
  });
  assert.equal(second.starterPriceId, "pri_4900");
  assert.equal(fake.state.calls.length, 4, "A second setup reuses the catalog.");
  assert.equal(fake.state.products[0].taxCategory, "saas");

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for billing tests.");
  const port = randomInt(41000, 59000);
  const base = `http://127.0.0.1:${port}`;
  const username = "billing-admin";
  const password = "billing-test-password-2026";
  const webhookSecret = "pdl_ntfset_test_secret_do_not_render";
  const apiKey = "pdl_test_api_key_not_rendered";
  const clientToken = "test_client_token_for_paddlejs";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_URL: process.env.DATABASE_URL,
      ADMIN_USERNAME: username,
      ADMIN_PASSWORD: password,
      SESSION_SECRET: "billing-test-session-secret-at-least-32",
      OPENAI_API_KEY: "",
      RESET_DEMO_DATA: "",
      ALLOW_DEMO_RESEED: "",
      PADDLE_ENABLED: "1",
      PADDLE_ENV: "sandbox",
      PADDLE_API_KEY: apiKey,
      PADDLE_CLIENT_TOKEN: clientToken,
      PUBLIC_BASE_URL: "https://crm.example",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  async function waitReady() {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error("Server exited.\n" + logs);
      try {
        const response = await fetch(base + "/", { headers: { "x-forwarded-proto": "https" } });
        if (response.status === 200) return;
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Billing test server did not start.\n" + logs);
  }

  function sign(raw) {
    const ts = Math.floor(Date.now() / 1000);
    const h1 = createHmac("sha256", webhookSecret).update(`${ts}:${raw}`).digest("hex");
    return `ts=${ts};h1=${h1}`;
  }

  function subscriptionEvent(eventId, status) {
    return JSON.stringify({
      event_id: eventId,
      event_type: "subscription.updated",
      occurred_at: new Date().toISOString(),
      notification_id: "ntf_01h04vsc0qhwtsbsxh3422wjs4",
      data: {
        id: "sub_01h04vsc0qhwtsbsxh3422wjs4",
        status,
        customer_id: "ctm_01hv6y1jedq4p1n0yqn5ba3ky4",
        address_id: "add_01hv8gq3318ktkfengj2r75gfx",
        currency_code: "USD",
        created_at: "2024-04-12T11:30:29.648Z",
        updated_at: "2024-04-12T11:30:29.648Z",
        collection_mode: "automatic",
        billing_cycle: { interval: "month", frequency: 1 },
        current_billing_period: { starts_at: "2024-04-12T11:30:29.637Z", ends_at: "2024-05-12T11:30:29.637Z" },
        scheduled_change: null,
        items: [{
          status,
          quantity: 1,
          recurring: true,
          created_at: "2024-04-12T11:30:29.648Z",
          updated_at: "2024-04-12T11:30:29.648Z",
          previously_billed_at: null,
          trial_dates: { starts_at: "2024-04-12T11:30:29.637Z", ends_at: "2024-04-26T11:30:29.637Z" },
          price: {
            id: "pri_01h1vjfevh5etwq3rb416a23h2",
            product_id: "pro_01gsz97mq9pa4fkyy0wqenepkz",
            description: "Starter, 2 users",
            name: "Starter, 2 users",
            tax_mode: "account_setting",
            unit_price: { amount: "4900", currency_code: "USD" },
            billing_cycle: { interval: "month", frequency: 1 },
            trial_period: { interval: "day", frequency: 14 },
          },
        }],
      },
    });
  }

  try {
    await waitReady();
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    await db.query(
      "INSERT INTO billing_config (key, value, updated_at) VALUES ('webhook_endpoint_secret', $1, $2), ('price_starter_id', 'pri_starter', $2), ('price_team_id', 'pri_team', $2)",
      [webhookSecret, new Date().toISOString()]
    );

    const locked = await fetch(base + "/admin/billing", { redirect: "manual", headers: { "x-forwarded-proto": "https" } });
    assert.equal(locked.status, 302, "Billing requires admin login.");
    assert.match(locked.headers.get("location") || "", /\/admin\/login/);

    const bad = await fetch(base + "/webhooks/paddle", {
      method: "POST",
      headers: { "content-type": "application/json", "paddle-signature": "ts=1;h1=deadbeef" },
      body: subscriptionEvent("evt_01h04vsc0qhwtsbsxh3422wjs4", "trialing"),
    });
    assert.equal(bad.status, 400, "A bad signature is rejected.");
    const none = await db.query("SELECT count(*)::int AS n FROM billing_subscriptions");
    assert.equal(none.rows[0].n, 0, "A bad signature does not write a subscription.");

    const raw = subscriptionEvent("evt_01h04vsc0qhwtsbsxh3422wjs4", "trialing");
    const ok = await fetch(base + "/webhooks/paddle", {
      method: "POST",
      headers: { "content-type": "application/json", "paddle-signature": sign(raw) },
      body: raw,
    });
    assert.equal(ok.status, 200, "A signed webhook is accepted.");
    const saved = await db.query("SELECT status, plan_name, trial_end, price_id FROM billing_subscriptions");
    assert.equal(saved.rows.length, 1);
    assert.equal(saved.rows[0].status, "trialing");
    assert.equal(saved.rows[0].plan_name, "Starter, 2 users");
    assert.equal(saved.rows[0].trial_end, "2024-04-26T11:30:29.637Z");
    assert.equal(saved.rows[0].price_id, "pri_01h1vjfevh5etwq3rb416a23h2");
    assert.match(logs, /paddle webhook subscription\.updated evt_01h04vsc0qhwtsbsxh3422wjs4/);
    assert.doesNotMatch(logs, new RegExp(webhookSecret));
    assert.doesNotMatch(logs, new RegExp(apiKey));

    const again = subscriptionEvent("evt_01h04vsc0qhwtsbsxh3422wjs4", "active");
    const duplicate = await fetch(base + "/webhooks/paddle", {
      method: "POST",
      headers: { "content-type": "application/json", "paddle-signature": sign(again) },
      body: again,
    });
    assert.equal(duplicate.status, 200, "A duplicate event is acknowledged.");
    const still = await db.query("SELECT status FROM billing_subscriptions");
    assert.equal(still.rows[0].status, "trialing", "A duplicate event does not change the row.");

    const login = await fetch(base + "/admin/login", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ username, password }).toString(),
    });
    const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
    const page = await fetch(base + "/admin/billing", { headers: { cookie, "x-forwarded-proto": "https" } });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /API key set/);
    assert.match(html, /Set up Paddle sandbox catalog/);
    assert.match(html, /https:\/\/crm\.example/);
    assert.doesNotMatch(html, new RegExp(webhookSecret));
    assert.doesNotMatch(html, new RegExp(apiKey));
    assert.doesNotMatch(html, new RegExp(clientToken));

    const refused = await fetch(base + "/admin/billing/setup", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ confirm: "NO" }).toString(),
    });
    assert.equal(refused.status, 400);
    assert.match(await refused.text(), /Type SETUP/);

    const subscribe = await fetch(base + "/subscribe");
    assert.equal(subscribe.status, 200);
    const subscribeHtml = await subscribe.text();
    assert.match(subscribeHtml, /\$49\.00/);
    assert.match(subscribeHtml, /\$99\.00/);
    assert.match(subscribeHtml, /14-day free trial/);
    assert.match(subscribeHtml, /cancel any time/i);
    assert.match(subscribeHtml, new RegExp(REFUND_DAYS + " days"));
    assert.equal(subscribeHtml.includes(PADDLE_ORDER_SENTENCE), true);
    assert.match(subscribeHtml, /accept-terms/);
    assert.match(subscribeHtml, /Test mode, no real charges/);
    assert.match(subscribeHtml, /cdn\.paddle\.com\/paddle\/v2\/paddle\.js/);
    assert.match(subscribeHtml, /disabled/);
    assert.doesNotMatch(subscribeHtml, new RegExp(webhookSecret));
    assert.doesNotMatch(subscribeHtml, new RegExp(apiKey));
    const home = await fetch(base + "/");
    assert.doesNotMatch(await home.text(), /cdn\.paddle\.com/);
    const thanks = await fetch(base + "/subscribe/thanks");
    assert.equal(thanks.status, 200);
    assert.doesNotMatch(await thanks.text(), new RegExp(webhookSecret));

    await db.end();
    console.log("Billing tests passed: catalog reuse, disabled is covered in smoke, signature, duplicate event, login, and no secret in HTML.");
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(resolve, 2000).unref();
    });
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
