"use strict";

const assert = require("node:assert/strict");
const { formatLeadLocation, isPlausibleUsLocation } = require("../location");
const { snoozeDue } = require("../workflow-postgres");
const { scoreLead } = require("../ai/leadScorer");
const { COMPANY_NAME } = require("../company");
const { LEGAL, REFUND_DAYS, PADDLE_ORDER_SENTENCE, SMS_CONSENT_VERSION, smsConsentText, smsConsentHtml } = require("../legal");

assert.equal(COMPANY_NAME, process.env.COMPANY_NAME || "Artific Creations Demo");
assert.equal(LEGAL.legalName, "Abdul Wahab");
assert.equal(LEGAL.supportPhone, "+92 3353392279");
assert.equal(LEGAL.supportEmail, "abdulwahab@artificcreations.com");
assert.equal(REFUND_DAYS, 7);
assert.equal(PADDLE_ORDER_SENTENCE, "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.");
assert.equal(SMS_CONSENT_VERSION, "2026-11-v1");
const consentText = smsConsentText("Northwind Roofing");
assert.match(consentText, /Northwind Roofing/);
assert.match(consentText, /automated or autodialed/);
assert.match(consentText, /not a condition of purchase/i);
assert.match(consentText, /Message and data rates may apply/);
assert.match(consentText, /Reply STOP to opt out/);
const consentHtml = smsConsentHtml("Roof <Co>");
assert.match(consentHtml, /Roof &lt;Co&gt;/);
assert.match(consentHtml, /href="\/terms"/);
assert.match(consentHtml, /href="\/privacy"/);
assert.doesNotMatch(consentHtml, /Roof <Co>/);

assert.equal(formatLeadLocation({ city: "Denver", state: "CO", zip: "80202" }), "Denver, CO");
assert.equal(formatLeadLocation({ city: "Karachi", state: "KY", zip: "74000" }), "");
assert.equal(isPlausibleUsLocation("Karachi", "KY", "74000"), false);
assert.equal(isPlausibleUsLocation("Springfield", "IL", "62701"), true);
assert.equal(isPlausibleUsLocation("Denver", "KY", "80202"), false);

const now = new Date("2026-11-17T17:00:00.000Z");
const future = "2026-11-18T22:30:00.000Z"; // later than now
const past = "2026-11-17T12:00:00.000Z";
assert.equal(snoozeDue(future, "1h", now), new Date(Date.parse(future) + 3600000).toISOString());
assert.equal(snoozeDue(future, "1d", now), new Date(Date.parse(future) + 86400000).toISOString());
assert.equal(snoozeDue(past, "1h", now), new Date(now.getTime() + 3600000).toISOString());

const inspection = scoreLead({
  full_name: "Unit Test",
  city: "Denver",
  state: "CO",
  zip: "80202",
  property_type: "Residential",
  roof_type: "Asphalt shingle",
  service_needed: "Roof inspection / estimate",
  urgency: "Just getting estimates",
  issue_description: "Fictional inspection request for unit tests.",
  preferred_contact: "Email",
});
assert.equal(inspection.category, "Inspection");
assert.ok(inspection.value_low >= 150, `inspection low should be >= 150, got ${inspection.value_low}`);
assert.ok(inspection.value_high >= 450, `inspection high should be >= 450, got ${inspection.value_high}`);
assert.doesNotMatch(inspection.next_action, /Summit Ridge/);
assert.match(inspection.next_action, /Artific Creations Demo|introducing/);
assert.match(inspection.summary, /in Denver, CO/);

const odd = scoreLead({
  full_name: "Odd Address",
  city: "Karachi",
  state: "KY",
  zip: "74000",
  property_type: "Residential",
  roof_type: "Metal",
  service_needed: "Leak / emergency repair",
  urgency: "Emergency — active leak",
  issue_description: "Fictional.",
  preferred_contact: "Phone",
});
assert.doesNotMatch(odd.summary, /Karachi, KY/);
assert.match(odd.summary, /location that needs review/);

console.log("Unit tests passed: branding, location sanity, snooze math, inspection floor, and AI copy.");
