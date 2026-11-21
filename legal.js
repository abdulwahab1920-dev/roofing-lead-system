"use strict";

// TODO: A lawyer should review the Privacy Policy (/privacy), the Terms
// of Service (/terms), and the Refund Policy (/refunds) before launch.
// The copy in this file is a plain-language draft for a US roofing CRM pilot.
// It is not legal advice.
//
// Business details live in LEGAL. The refund window is REFUND_DAYS.
// Change them here only. Do not scatter replacements through the pages.

const LEGAL = {
  legalName: "Abdul Wahab",
  vendorName: "Artific Creations",
  productName: "Roofing Lead CRM",
  supportPhone: "+92 3353392279",
  supportEmail: "abdulwahab@artificcreations.com",
  updated: "November 21, 2026",
};

const REFUND_DAYS = 7;

const PADDLE_ORDER_SENTENCE = "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.";

const SMS_CONSENT_VERSION = "2026-11-v1";

function companyLabel(companyName) {
  const name = String(companyName || "").trim();
  return name || "the roofing company";
}

function smsConsentParts(companyName) {
  const name = companyLabel(companyName);
  return {
    before: `I agree to receive calls and text messages, including automated or autodialed messages, from ${name} about my roof inspection request. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out. See our `,
    linkPhrase: "Terms and Privacy Policy",
    after: ".",
  };
}

function smsConsentLeadIn(companyName) {
  return smsConsentParts(companyName).before;
}

function smsConsentText(companyName) {
  const parts = smsConsentParts(companyName);
  return parts.before + parts.linkPhrase + parts.after;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function smsConsentHtml(companyName) {
  const parts = smsConsentParts(companyName);
  return `${escapeHtml(parts.before)}<a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>${escapeHtml(parts.after)}`;
}

module.exports = {
  LEGAL,
  REFUND_DAYS,
  PADDLE_ORDER_SENTENCE,
  SMS_CONSENT_VERSION,
  smsConsentLeadIn,
  smsConsentText,
  smsConsentHtml,
};
