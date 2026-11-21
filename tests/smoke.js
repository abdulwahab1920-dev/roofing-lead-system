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
      RESET_DEMO_DATA: "",
      ALLOW_DEMO_RESEED: "",
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

    const form = await fetch(base + "/");
    assert.equal(form.status, 200, "Public lead form should load.");
    const formHtml = await form.text();
    assert.match(formHtml, /Roofing Lead CRM Demo/);
    assert.match(formHtml, /INTERACTIVE DEMO/);
    assert.match(formHtml, /name="photos"/);
    assert.match(formHtml, /Artific Creations Demo/);
    assert.doesNotMatch(formHtml, /Summit Ridge|Sample Roofing Company/);
    assert.equal(form.headers.get("x-frame-options"), "DENY");
    assert.equal(form.headers.get("x-content-type-options"), "nosniff");
    assert.match(form.headers.get("content-security-policy") || "", /frame-ancestors/);
    const favicon = await fetch(base + "/favicon.svg");
    assert.equal(favicon.status, 200, "Favicon should be available.");
    const formScript = await fetch(base + "/form-assets/app.js");
    assert.equal(formScript.status, 200, "New form JavaScript should load.");
    const formStyles = await fetch(base + "/form-assets/styles.css");
    assert.equal(formStyles.status, 200, "New form stylesheet should load.");
    assert.match(await formStyles.text(), /Fraunces/);

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

    const optionalEmail = new FormData();
    for (const [key, value] of Object.entries({
      full_name: "Email Only Test", email: "email-only@example.com", preferred_contact: "Email",
      street: "456 Test Street", city: "Denver", state: "CO", zip: "80203",
      property_type: "Residential", roof_type: "Metal", service_needed: "Roof inspection / estimate",
      urgency: "This month",
    })) optionalEmail.append(key, value);
    const emailOnlyResponse = await fetch(base + "/leads", {
      method: "POST", headers: { Accept: "application/json" }, body: optionalEmail,
    });
    assert.equal(emailOnlyResponse.status, 201, "Email preference should allow an omitted phone and issue description.");
    const emailOnlyResult = await emailOnlyResponse.json();
    assert.match(emailOnlyResult.reference, /^RL-/);

    const missingEmail = new FormData();
    for (const [key, value] of Object.entries({
      full_name: "Missing Email Test", preferred_contact: "Email",
      street: "456 Test Street", city: "Denver", state: "CO", zip: "80203",
      property_type: "Residential", roof_type: "Metal", service_needed: "Roof repair", urgency: "This week",
    })) missingEmail.append(key, value);
    const missingEmailResponse = await fetch(base + "/leads", {
      method: "POST", headers: { Accept: "application/json" }, body: missingEmail,
    });
    assert.equal(missingEmailResponse.status, 400, "Email preference must require an email address.");

    const missingPhone = new FormData();
    for (const [key, value] of Object.entries({
      full_name: "Missing Phone Test", preferred_contact: "Text", email: "optional@example.com",
      street: "456 Test Street", city: "Denver", state: "CO", zip: "80203",
      property_type: "Residential", roof_type: "Metal", service_needed: "Roof repair", urgency: "This week",
    })) missingPhone.append(key, value);
    const missingPhoneResponse = await fetch(base + "/leads", {
      method: "POST", headers: { Accept: "application/json" }, body: missingPhone,
    });
    assert.equal(missingPhoneResponse.status, 400, "Phone/Text preference must require a phone number.");

    const photoForm = new FormData();
    for (const [key, value] of Object.entries({
      full_name: "Photo Upload Test", phone: "(303) 555-0188", preferred_contact: "Phone",
      street: "789 Photo Road", city: "Denver", state: "CO", zip: "80204",
      property_type: "Residential", roof_type: "Asphalt shingle", service_needed: "Roof repair",
      urgency: "This week",
    })) photoForm.append(key, value);
    const pngSignature = Buffer.from([137,80,78,71,13,10,26,10]);
    for (let i = 0; i < 5; i++) photoForm.append("photos", new Blob([pngSignature], { type: "image/png" }), `roof-${i+1}.png`);
    const photoResponse = await fetch(base + "/leads", {
      method: "POST", headers: { Accept: "application/json" }, body: photoForm,
    });
    assert.equal(photoResponse.status, 201, "A lead with five images should be accepted.");
    const photoResult = await photoResponse.json();
    const detailResponse = await fetch(base + `/admin/leads/${photoResult.id}`, {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(detailResponse.status, 200, "Photo lead detail should load.");
    const detailHtml = await detailResponse.text();
    assert.match(detailHtml, /Roof photos/);
    assert.equal((detailHtml.match(/\/photos\//g) || []).length >= 5, true, "All five photos should be shown.");
    const storedPhoto = await fetch(base + `/admin/leads/${photoResult.id}/photos/1`, {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(storedPhoto.status, 200, "Authenticated photo retrieval should work.");
    assert.equal(storedPhoto.headers.get("content-type"), "image/png");

    const tooManyPhotos = new FormData();
    for (const [key, value] of Object.entries({
      full_name: "Too Many Photos Test", phone: "(303) 555-0187", preferred_contact: "Phone",
      street: "789 Photo Road", city: "Denver", state: "CO", zip: "80204",
      property_type: "Residential", roof_type: "Asphalt shingle", service_needed: "Roof repair",
      urgency: "This week",
    })) tooManyPhotos.append(key, value);
    for (let i = 0; i < 6; i++) tooManyPhotos.append("photos", new Blob([pngSignature], { type: "image/png" }), `extra-${i+1}.png`);
    const tooManyResponse = await fetch(base + "/leads", {
      method: "POST", headers: { Accept: "application/json" }, body: tooManyPhotos,
    });
    assert.equal(tooManyResponse.status, 400, "More than five images must be rejected.");

        const invalidPhotoForm = new FormData();
    for (const [key, value] of Object.entries({
      full_name: "Invalid Photo Test", phone: "(303) 555-0186", preferred_contact: "Phone",
      street: "789 Photo Road", city: "Denver", state: "CO", zip: "80204",
      property_type: "Residential", roof_type: "Asphalt shingle", service_needed: "Roof repair",
      urgency: "This week",
    })) invalidPhotoForm.append(key, value);
    invalidPhotoForm.append("photos", new Blob(["<svg></svg>"], { type: "image/svg+xml" }), "not-an-image.svg");
    const invalidPhotoResponse = await fetch(base + "/leads", {
      method: "POST", headers: { Accept: "application/json" }, body: invalidPhotoForm,
    });
    assert.equal(invalidPhotoResponse.status, 400, "Unsupported image formats must be rejected.");

    const oversizedPhotoForm = new FormData();
    for (const [key, value] of Object.entries({
      full_name: "Oversized Photo Test", phone: "(303) 555-0185", preferred_contact: "Phone",
      street: "789 Photo Road", city: "Denver", state: "CO", zip: "80204",
      property_type: "Residential", roof_type: "Asphalt shingle", service_needed: "Roof repair",
      urgency: "This week",
    })) oversizedPhotoForm.append(key, value);
    oversizedPhotoForm.append("photos", new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "image/png" }), "too-large.png");
    const oversizedResponse = await fetch(base + "/leads", {
      method: "POST", headers: { Accept: "application/json" }, body: oversizedPhotoForm,
    });
    assert.equal(oversizedResponse.status, 400, "Images larger than 5 MB must be rejected.");

    const newLeadPage = await fetch(base + "/admin/leads/new", {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(newLeadPage.status, 200, "New lead page should render.");
    const newLeadHtml = await newLeadPage.text();
    assert.match(newLeadHtml, /action="\/admin\/leads"/);
    assert.match(newLeadHtml, /name="full_name"/);
    assert.match(newLeadHtml, /Create lead/);
    assert.doesNotMatch(newLeadHtml, /Something went wrong/);

    const invalidNewLead = await fetch(base + "/admin/leads", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ full_name: "A", status: "New" }).toString(),
    });
    assert.equal(invalidNewLead.status, 400, "Incomplete new lead should re-render the form.");
    assert.match(await invalidNewLead.text(), /Enter your full name|too short|This field is required/i);

    const manualLead = {
      full_name: 'Ada, "Demo"\nLead',
      phone: "(555) 010-0198",
      email: "ada.demo@example.com",
      preferred_contact: "Phone",
      street: "100 Demo Lane",
      city: "Denver",
      state: "CO",
      zip: "80202",
      property_type: "Residential",
      roof_type: "Asphalt shingle",
      service_needed: "Roof repair",
      urgency: "This week",
      issue_description: "FICTIONAL manual lead with a comma, a \"quote\", and a\nnewline.",
      status: "Contacted",
    };
    const created = await fetch(base + "/admin/leads", {
      method: "POST",
      redirect: "manual",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams(manualLead).toString(),
    });
    assert.equal(created.status, 302, "Creating a lead should redirect to it.");
    const createdLocation = created.headers.get("location") || "";
    assert.match(createdLocation, /^\/admin\/leads\/\d+$/);
    const createdDetail = await fetch(base + createdLocation, {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(createdDetail.status, 200, "The new lead should be viewable.");
    const createdHtml = await createdDetail.text();
    assert.match(createdHtml, /Ada,/);
    assert.match(createdHtml, /Contacted/);

    const bogusLead = await fetch(base + "/admin/leads/not-a-number", {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(bogusLead.status, 404, "A non-numeric lead id should be a 404, not a 500.");
    assert.match(await bogusLead.text(), /Back to the dashboard/);

    const exported = await fetch(base + "/admin/leads/export.csv", {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(exported.status, 200, "CSV export should download.");
    assert.match(exported.headers.get("content-type") || "", /text\/csv/);
    assert.match(exported.headers.get("content-disposition") || "", /leads\.csv/);
    const exportedText = await exported.text();
    const { recordsFromCsv } = require("../csv");
    const exportedRows = recordsFromCsv(exportedText);
    assert.equal(exportedRows.error, undefined);
    const ada = exportedRows.records.find((row) => row.data.email === "ada.demo@example.com");
    assert.ok(ada, "Exported CSV should include the manual lead.");
    assert.equal(ada.data.full_name, manualLead.full_name);
    assert.equal(ada.data.issue_description, manualLead.issue_description);
    assert.equal(ada.data.status, "Contacted");

    const importRedirect = await fetch(base + "/admin/import", {
      redirect: "manual",
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(importRedirect.status, 302);
    assert.equal(importRedirect.headers.get("location"), "/admin/leads/import");
    const exportRedirect = await fetch(base + "/admin/export", {
      redirect: "manual",
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(exportRedirect.status, 302);
    assert.equal(exportRedirect.headers.get("location"), "/admin/leads/export.csv");

    const importPage = await fetch(base + "/admin/leads/import", {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(importPage.status, 200);
    assert.match(await importPage.text(), /multipart\/form-data/);

    const importCsv = [
      "full_name,phone,email,street,city,state,zip,property_type,roof_type,service_needed,issue_description,urgency,preferred_contact,status",
      '"Import, OK","(555) 010-0199",import.ok@example.com,100 Demo Lane,Denver,CO,80202,Residential,Asphalt shingle,Roof repair,"Line one\nLine two, still quoted",This week,Phone,New',
      "Bad Zip,(555) 010-0188,bad.zip@example.com,200 Sample Street,Denver,CO,12,Residential,Metal,Roof repair,This fictional row has a bad ZIP code.,This month,Email,Quoted",
    ].join("\r\n");
    const importForm = new FormData();
    importForm.append("file", new Blob([importCsv], { type: "text/csv" }), "leads.csv");
    const imported = await fetch(base + "/admin/leads/import", {
      method: "POST",
      headers: { cookie, "x-forwarded-proto": "https" },
      body: importForm,
    });
    assert.equal(imported.status, 200, "CSV import should report a result.");
    const importHtml = await imported.text();
    assert.match(importHtml, /Imported 1 lead/);
    assert.match(importHtml, /Row 3:/);
    assert.match(importHtml, /ZIP/);
    assert.match(importHtml, /Import, OK/);

    const loginWithNext = await fetch(base + "/admin/login?next=/admin/tasks", {
      headers: { "x-forwarded-proto": "https" },
    });
    assert.match(await loginWithNext.text(), /name="next" value="\/admin\/tasks"/);
    const postedNext = await fetch(base + "/admin/login", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ username, password, next: "/admin/leads/new" }).toString(),
    });
    assert.equal(postedNext.status, 302);
    assert.equal(postedNext.headers.get("location"), "/admin/leads/new");
    for (const evil of ["https://evil.example/admin", "//evil.example", "/\\evil.example", "/admin.evil.example", "/admin/%2f%2fevil.example"]) {
      const rejected = await fetch(base + "/admin/login", {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
        body: new URLSearchParams({ username, password, next: evil }).toString(),
      });
      assert.equal(rejected.status, 302, evil);
      assert.equal(rejected.headers.get("location"), "/admin", evil);
    }
    const queryNext = await fetch(base + "/admin/login?next=/admin/emails", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ username, password }).toString(),
    });
    assert.equal(queryNext.headers.get("location"), "/admin/emails");

    const adminMissing = await fetch(base + "/admin/does-not-exist");
    assert.equal(adminMissing.status, 404);
    const adminMissingHtml = await adminMissing.text();
    assert.match(adminMissingHtml, /Back to the dashboard/);
    assert.match(adminMissingHtml, /href="\/admin"/);
    assert.doesNotMatch(adminMissingHtml, /inspection form/);
    const publicMissing = await fetch(base + "/no-such-public-page");
    assert.equal(publicMissing.status, 404);
    const publicMissingHtml = await publicMissing.text();
    assert.match(publicMissingHtml, /Back to the inspection form/);
    assert.doesNotMatch(publicMissingHtml, /Back to the dashboard/);

    const reseedOff = await fetch(base + "/admin/reseed", {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.equal(reseedOff.status, 404, "Reseed must not exist unless ALLOW_DEMO_RESEED=1.");
    const reseedPost = await fetch(base + "/admin/reseed", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "x-forwarded-proto": "https" },
      body: new URLSearchParams({ confirm: "RESEED" }).toString(),
    });
    assert.equal(reseedPost.status, 404, "A disabled reseed POST must not run.");
    const stillThere = await fetch(base + "/admin/leads", {
      headers: { cookie, "x-forwarded-proto": "https" },
    });
    assert.match(await stillThere.text(), /CI Smoke Test/, "Disabled reseed must leave existing leads in place.");
    const dash = await fetch(base + "/admin", { headers: { cookie, "x-forwarded-proto": "https" } });
    assert.doesNotMatch(await dash.text(), /href="\/admin\/reseed"/);

    console.log("Smoke test passed: form assets, protected admin, lead submission, conditional contact validation, optional description, five-image storage, authenticated photo display, invalid/oversized upload rejection, new lead, CSV import/export, login next, admin 404, and disabled reseed.");
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
