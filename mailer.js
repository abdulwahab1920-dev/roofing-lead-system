"use strict";

const net = require("net");
const tls = require("tls");

const DEFAULT_TO = "office@summitridgeroofing.com";
const DEFAULT_FROM = "leads@summitridgeroofing.com";

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
    "A new lead was submitted on the Summit Ridge website.",
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

function smtpCommand(socket, expected, payload) {
  return new Promise((resolve, reject) => {
    const onData = (buf) => {
      const text = buf.toString();
      const code = Number((text.match(/^(\d{3})/m) || [])[1]);
      socket.off("error", onErr);
      socket.off("data", onData);
      if (expected && code !== expected) {
        reject(new Error(`SMTP ${expected} expected, got: ${text.trim()}`));
      } else {
        resolve(text);
      }
    };
    const onErr = (err) => {
      socket.off("data", onData);
      reject(err);
    };
    socket.once("data", onData);
    socket.once("error", onErr);
    if (payload != null) socket.write(payload);
  });
}

async function sendViaSmtp({ from, to, subject, body }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "1" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const timeoutMs = 8000;

  const socket = await new Promise((resolve, reject) => {
    const s = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(s))
      : net.connect({ host, port }, () => resolve(s));
    s.setTimeout(timeoutMs, () => {
      s.destroy();
      reject(new Error("SMTP timeout"));
    });
    s.once("error", reject);
  });

  const write = (line, expected) => smtpCommand(socket, expected, line);
  try {
    await smtpCommand(socket, 220);
    await write(`EHLO summitridge.local\r\n`, 250);
    if (user && pass) {
      await write("AUTH LOGIN\r\n", 334);
      await write(Buffer.from(user).toString("base64") + "\r\n", 334);
      await write(Buffer.from(pass).toString("base64") + "\r\n", 235);
    }
    await write(`MAIL FROM:<${from}>\r\n`, 250);
    await write(`RCPT TO:<${to}>\r\n`, 250);
    await write("DATA\r\n", 354);
    const msg = [
      `From: Summit Ridge Leads <${from}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
      ".",
      "",
    ].join("\r\n");
    await write(msg, 250);
    await write("QUIT\r\n", 221);
    socket.end();
  } catch (err) {
    socket.destroy();
    throw err;
  }
}

async function deliver({ to, from, subject, body }) {
  if (!process.env.SMTP_HOST) return { status: "logged" };
  try {
    await sendViaSmtp({ from, to, subject, body });
    return { status: "sent" };
  } catch (err) {
    return { status: "logged-send-failed", error: String(err.message || err).slice(0, 500) };
  }
}

async function sendLeadAlert(dbmod, db, lead, createdAt) {
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_TO || DEFAULT_TO;
  const from = process.env.SMTP_FROM || DEFAULT_FROM;
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
  DEFAULT_TO,
  DEFAULT_FROM,
};
