"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { randomInt } = require("node:crypto");
const { SAMPLE_LEADS } = require("../demo-seed");

async function waitForServer(url, child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Server exited before becoming ready.");
    try {
      const response = await fetch(url, { headers: { "x-forwarded-proto": "https" } });
      if (response.status === 200) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server did not become ready within 15 seconds.");
}

(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the reseed test.");
  const port = randomInt(41000, 59000);
  const base = `http://127.0.0.1:${port}`;
  const username = "reseed-admin";
  const password = "reseed-test-password-2026";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_URL: process.env.DATABASE_URL,
      ADMIN_USERNAME: username,
      ADMIN_PASSWORD: password,
      SESSION_SECRET: "reseed-test-session-secret-at-least-32-characters",
      OPENAI_API_KEY: "",
      SMTP_HOST: "",
      RESET_DEMO_DATA: "",
      ALLOW_DEMO_RESEED: "1",
      COMPANY_NAME: "Artific Creations Demo",
      APP_TIMEZONE: "America/Denver",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForServer(base + "/", child);

    const locked = await fetch(base + "/admin/reseed", { redirect: "manual", headers: { "x-forwarded-proto": "https" } });
    assert.equal(locked.status, 302, "Reseed must require admin login.");
    assert.match(locked.headers.get("location") || "", /\/admin\/login/);

    const login = await fetch(base + "/admin/login", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ username, password, next: "/admin/reseed" }).toString(),
    });
    assert.equal(login.status, 302);
    assert.equal(login.headers.get("location"), "/admin/reseed");
    const cookie = (login.headers.get("set-cookie") || "").split(";")[0];

    const page = await fetch(base + "/admin/reseed", { headers: { cookie, "x-forwarded-proto": "https" } });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Type RESEED to confirm/);
    assert.match(html, /href="\/admin\/reseed"/);
    assert.doesNotMatch(html, /Replace the database with/);

    const marker = {
      full_name: "Wipe Marker",
      phone: "(555) 010-0191",
      email: "wipe.marker@example.com",
      preferred_contact: "Phone",
      street: "100 Demo Lane",
      city: "Denver",
      state: "CO",
      zip: "80202",
      property_type: "Residential",
      roof_type: "Asphalt shingle",
      service_needed: "Roof repair",
      urgency: "This week",
      issue_description: "FICTIONAL marker that the reseed must delete.",
    };
    const created = await fetch(base + "/leads", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(marker).toString(),
    });
    assert.equal(created.status, 302);

    const anonymous = await fetch(base + "/admin/reseed", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ confirm: "RESEED" }).toString(),
    });
    assert.equal(anonymous.status, 302);
    assert.match(anonymous.headers.get("location") || "", /\/admin\/login/);

    const rejected = await fetch(base + "/admin/reseed", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ confirm: "yes" }).toString(),
    });
    assert.equal(rejected.status, 400);
    assert.match(await rejected.text(), /Type RESEED/);
    const before = await fetch(base + "/admin/leads", { headers: { cookie, "x-forwarded-proto": "https" } });
    assert.match(await before.text(), /Wipe Marker/);

    const accepted = await fetch(base + "/admin/reseed", {
      method: "POST",
      redirect: "manual",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ confirm: "RESEED" }).toString(),
    });
    assert.equal(accepted.status, 302);
    assert.equal(accepted.headers.get("location"), "/admin/reseed?done=" + SAMPLE_LEADS.length);
    assert.match(logs, /Admin reseeded demo data: \d+ fictional leads/);

    const after = await fetch(base + "/admin/leads", { headers: { cookie, "x-forwarded-proto": "https" } });
    const afterHtml = await after.text();
    assert.match(afterHtml, /Casey Demo/);
    assert.doesNotMatch(afterHtml, /Wipe Marker/);
    const done = await fetch(base + accepted.headers.get("location"), { headers: { cookie, "x-forwarded-proto": "https" } });
    assert.match(await done.text(), new RegExp("Replaced the database with " + SAMPLE_LEADS.length));

    console.log("Reseed test passed: login required, confirmation required, and a confirmed reseed replaces demo data.");
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(resolve, 2000).unref();
    });
    if (child.exitCode !== 0 && child.exitCode !== null && child.exitCode !== 143 && child.exitCode !== 130) {
      throw new Error(`Server exited with code ${child.exitCode}. Logs:\n${logs}`);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
