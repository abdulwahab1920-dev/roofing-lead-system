"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomInt } = require("node:crypto");

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
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for PostgreSQL smoke tests.");
  const directory = await mkdtemp(path.join(os.tmpdir(), "roofing-crm-smoke-"));
  const port = randomInt(41000, 59000);
  const base = `http://127.0.0.1:${port}`;
  const username = "smoke-admin";
  const password = "smoke-test-password-2026";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_URL: process.env.DATABASE_URL,
      ADMIN_USERNAME: username,
      ADMIN_PASSWORD: password,
      SESSION_SECRET: "smoke-test-session-secret-at-least-32-characters",
      OPENAI_API_KEY: "",
      SMTP_HOST: "",
      SEED_DEMO_DATA: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForServer(base + "/", child);

    const form = await fetch(base + "/");
    assert.equal(form.status, 200, "Public lead form should load.");
    assert.match(await form.text(), /Request a roofing inspection/);

    const protectedPage = await fetch(base + "/admin", {
      redirect: "manual",
      headers: { "x-forwarded-proto": "https" },
    });
    assert.equal(protectedPage.status, 302, "Admin dashboard should require login.");
    assert.match(protectedPage.headers.get("location") || "", /admin\/login/);

    const login = await fetch(base + "/admin/login", {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-forwarded-proto": "https",
      },
      body: new URLSearchParams({ username, password }).toString(),
    });
    assert.equal(login.status, 302, "Valid admin credentials should log in.");
    const setCookie = login.headers.get("set-cookie") || "";
    const cookie = setCookie.split(";")[0];
    assert.match(cookie, /^roof\.sid=/, "Login should issue a session cookie.");

    const dashboard = await fetch(base + "/admin", {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(dashboard.status, 200, "Authenticated dashboard should load.");

    const leadData = {
      full_name: "CI Smoke Test",
      phone: "(303) 555-0199",
      email: "ci-smoke@example.com",
      preferred_contact: "Phone",
      street: "123 Test Avenue",
      city: "Denver",
      state: "CO",
      zip: "80202",
      property_type: "Residential",
      roof_type: "Asphalt shingle",
      service_needed: "Roof repair",
      urgency: "This week",
      issue_description: "Missing shingles after a recent wind storm.",
    };
    const submission = await fetch(base + "/leads", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(leadData).toString(),
    });
    assert.equal(submission.status, 302, "Valid lead submission should be accepted.");
    assert.match(submission.headers.get("location") || "", /^\/thanks\?id=/);

    const leadsPage = await fetch(base + "/admin/leads", {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(leadsPage.status, 200, "Admin lead list should load after submission.");
    assert.match(await leadsPage.text(), /CI Smoke Test/, "Submitted lead should appear in the CRM.");

    console.log("Smoke test passed: public form, protected admin, PostgreSQL-backed login session, lead submission, CRM listing.");
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(resolve, 2000).unref();
    });
    await rm(directory, { recursive: true, force: true });
    if (child.exitCode !== 0 && child.exitCode !== null) {
      throw new Error(`Server exited with code ${child.exitCode}. Logs:\n${logs}`);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
