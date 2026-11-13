"use strict";

const COMPANY_NAME = process.env.COMPANY_NAME || "Your Roofing Company";

function formatMoney(n) {
  if (n === null || n === undefined || n === "") return "n/a";
  return "$" + Number(n).toLocaleString("en-US");
}

function composeLeadAlert(lead) {
  const name = lead.full_name || "New lead";
  const priority = lead.ai_priority || "Unscored";
  const score = lead.ai_score != null ? `${lead.ai_score}/100` : "n/a";
  const category = lead.ai_category || "n/a";
  const subject = `New ${priority} lead: ${name}${lead.ai_category ? " — " + lead.ai_category : ""}`;
  const body = [
    `A new lead was submitted on the ${COMPANY_NAME} website.`,
    "",
    `Name: ${name}`,
    `Phone: ${lead.phone || "—"}`,
    `Email: ${lead.email || "—"}`,
    `Location: ${[lead.city, lead.state].filter(Boolean).join(", ") || "—"}`,
    `Service: ${lead.service_needed || "—"}`,
    `Urgency: ${lead.urgency || "—"}`,
    "",
    `AI priority: ${priority}`,
    `AI score: ${score}`,
    `Category: ${category}`,
    `Est. job value: ${formatMoney(lead.ai_value_low)}–${formatMoney(lead.ai_value_high)}`,
    `Follow up: ${lead.ai_followup || "—"}`,
    "",
    `Recommended action: ${lead.ai_next_action || "Review the lead and follow up."}`,
    "",
    `Summary: ${lead.ai_summary || "—"}`,
    "",
    `Open in CRM: /admin/leads/${lead.id}`,
  ].join("\n");
  return { subject, body };
}

async function deliver({ to, from, subject, body }) {
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
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${COMPANY_NAME} Leads <${from}>`,
        to: [to],
        subject,
        text: body,
      }),
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
  const { subject, body } = composeLeadAlert(lead);
  const result = await deliver({ to, from, subject, body });
  dbmod.insertEmail(db, {
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
};
