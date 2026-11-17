"use strict";

const { COMPANY_NAME } = require("./company");
const { formatLeadLocation } = require("./location");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function publicBaseUrl() {
  const raw = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "";
  return String(raw).trim().replace(/\/+$/, "");
}

function crmLeadUrl(id) {
  const path = `/admin/leads/${id}`;
  const base = publicBaseUrl();
  return base ? `${base}${path}` : path;
}

function formatMoney(n) {
  if (n === null || n === undefined || n === "") return "n/a";
  return "$" + Number(n).toLocaleString("en-US");
}

function composeLeadAlert(lead) {
  const name = lead.full_name || "New lead";
  const priority = lead.ai_priority || "Unscored";
  const score = lead.ai_score != null ? `${lead.ai_score}/100` : "n/a";
  const category = lead.ai_category || "n/a";
  const crmUrl = crmLeadUrl(lead.id);
  const subject = `New ${priority} lead: ${name}${lead.ai_category ? " — " + lead.ai_category : ""}`;
  const location = formatLeadLocation(lead) || "Location needs review";
  const valueRange = `${formatMoney(lead.ai_value_low)}–${formatMoney(lead.ai_value_high)}`;
  const nextAction = lead.ai_next_action || "Review the lead and follow up.";
  const body = [
    `A new lead was submitted on the ${COMPANY_NAME} website.`,
    "",
    `Name: ${name}`,
    `Phone: ${lead.phone || "—"}`,
    `Email: ${lead.email || "—"}`,
    `Location: ${location}`,
    `Service: ${lead.service_needed || "—"}`,
    `Urgency: ${lead.urgency || "—"}`,
    "",
    `AI priority: ${priority}`,
    `AI score: ${score}`,
    `Category: ${category}`,
    `Est. job value: ${valueRange}`,
    `Follow up: ${lead.ai_followup || "—"}`,
    "",
    `Recommended action: ${nextAction}`,
    "",
    `Summary: ${lead.ai_summary || "—"}`,
    "",
    `Open in CRM: ${crmUrl}`,
  ].join("\n");

  const e = escapeHtml;
  const abs = /^https?:\/\//i.test(crmUrl);
  const button = abs
    ? `<p style="margin:24px 0 8px"><a href="${e(crmUrl)}" style="display:inline-block;background:#c45c26;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Open in CRM</a></p>
    <p style="margin:0;font-size:13px;color:#5c6573"><a href="${e(crmUrl)}" style="color:#1b2a4a">${e(crmUrl)}</a></p>`
    : `<p style="margin:24px 0 0">Open in CRM: ${e(crmUrl)}</p>`;

  const row = (label, value) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#5c6573;vertical-align:top;white-space:nowrap">${e(label)}</td><td style="padding:6px 0;color:#1f2430">${e(value)}</td></tr>`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f0ea;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1f2430">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <p style="margin:0 0 16px">A new lead was submitted on the ${e(COMPANY_NAME)} website.</p>
    <table style="border-collapse:collapse;width:100%;font-size:15px">
      ${row("Name", name)}
      ${row("Phone", lead.phone || "—")}
      ${row("Email", lead.email || "—")}
      ${row("Location", location)}
      ${row("Service", lead.service_needed || "—")}
      ${row("Urgency", lead.urgency || "—")}
      ${row("AI priority", priority)}
      ${row("AI score", score)}
      ${row("Category", category)}
      ${row("Est. job value", valueRange)}
      ${row("Follow up", lead.ai_followup || "—")}
      ${row("Recommended action", nextAction)}
      ${row("Summary", lead.ai_summary || "—")}
    </table>
    ${button}
  </div>
</body></html>`;

  return { subject, body, html };
}

async function deliver({ to, from, subject, body, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      status: "logged",
      error: "Email is not configured. Add RESEND_API_KEY, NOTIFY_EMAIL, and EMAIL_FROM in the hosting environment.",
    };
  }
  if (!to || !from) {
    return {
      status: "logged-send-failed",
      error: "Set NOTIFY_EMAIL and EMAIL_FROM before enabling email delivery.",
    };
  }

  try {
    const payload = {
      from: `${COMPANY_NAME} Leads <${from}>`,
      to: [to],
      subject,
      text: body,
    };
    if (html) payload.html = html;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = result.message || result.error || `Resend returned HTTP ${response.status}`;
      return { status: "logged-send-failed", error: String(reason).slice(0, 500) };
    }
    return { status: "sent" };
  } catch (err) {
    return {
      status: "logged-send-failed",
      error: String(err.message || err).slice(0, 500),
    };
  }
}

async function sendLeadAlert(dbmod, db, lead, createdAt) {
  const to = process.env.NOTIFY_EMAIL || "";
  const from = process.env.EMAIL_FROM || "";
  const { subject, body, html } = composeLeadAlert(lead);
  const result = await deliver({ to, from, subject, body, html });
  await dbmod.insertEmail(db, {
    to_addr: to,
    subject,
    body,
    status: result.status,
    error: result.error || null,
    lead_id: lead.id,
    created_at: createdAt || new Date().toISOString(),
  });
  return result;
}

module.exports = {
  composeLeadAlert,
  sendLeadAlert,
  publicBaseUrl,
  crmLeadUrl,
};
