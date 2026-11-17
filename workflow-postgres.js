"use strict";

const mailer = require("./mailer");
const tz = require("./timezone");

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function denverParts(date) {
  return tz.zoneParts(date, { weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" });
}

function fromDenver(year, month, day, hour, minute) {
  return tz.fromZone(year, month, day, hour, minute);
}

function addBusinessDays(date, days) {
  let cursor = new Date(date);
  let added = 0;
  while (added < days) {
    cursor = new Date(cursor.getTime() + 86400000);
    const weekday = denverParts(cursor).weekday;
    if (weekday !== "Sat" && weekday !== "Sun") added += 1;
  }
  return cursor;
}

function dueFromFollowup(followup, fromDate) {
  const start = new Date(fromDate);
  const text = String(followup || "").toLowerCase();
  if (text.includes("15 minute")) return addMinutes(start, 15);
  if (text.includes("2 hour")) return addMinutes(start, 120);
  if (text.includes("same business day")) {
    const parts = denverParts(start);
    const endOfDay = fromDenver(+parts.year, +parts.month, +parts.day, 17, 0);
    if (["Sat", "Sun"].includes(parts.weekday) || start.getTime() >= endOfDay.getTime()) {
      const nextMorning = addBusinessDays(fromDenver(+parts.year, +parts.month, +parts.day, 9, 0), 1);
      return nextMorning;
    }
    return endOfDay;
  }
  if (text.includes("2 business day")) return addBusinessDays(start, 2);
  return addBusinessDays(start, 1);
}

function taskTitle(lead) {
  const verb = lead.ai_priority === "Hot" || String(lead.urgency || "").startsWith("Emergency") ? "Call" : "Follow up with";
  return `${verb} ${lead.full_name || "lead"}${lead.ai_category ? " — " + lead.ai_category : ""}`;
}

function notificationCopy(lead) {
  const title = `New ${lead.ai_priority || "New"} lead: ${lead.full_name}`;
  const bits = [lead.ai_category, lead.ai_score != null ? `score ${lead.ai_score}` : null, lead.ai_followup ? `follow up ${lead.ai_followup.toLowerCase()}` : null].filter(Boolean).join(" · ");
  const body = bits
    ? `${lead.full_name} submitted a request. ${bits}. ${lead.ai_next_action || ""}`.trim()
    : `${lead.full_name} submitted a new inspection request.`;
  return { title, body };
}

async function onNewLead(dbmod, db, lead) {
  const now = new Date().toISOString();
  const copy = notificationCopy(lead);
  await dbmod.insertNotification(db, { type: "new_lead", ...copy, lead_id: lead.id, created_at: now });
  await mailer.sendLeadAlert(dbmod, db, lead, now);
  await dbmod.insertTask(db, {
    lead_id: lead.id,
    title: taskTitle(lead),
    due_at: dueFromFollowup(lead.ai_followup, lead.created_at || now).toISOString(),
    created_at: now,
  });
}

async function flagOverdueTasks(dbmod) {
  const { rows } = await dbmod.pool.query(
    "SELECT tasks.*, leads.full_name lead_name FROM tasks LEFT JOIN leads ON leads.id=tasks.lead_id WHERE completed_at IS NULL AND notified_overdue_at IS NULL AND due_at::timestamptz < now()"
  );
  for (const task of rows) {
    await dbmod.insertNotification(dbmod.pool, {
      type: "task_overdue",
      title: `Follow-up overdue: ${task.lead_name || "a lead"}`,
      body: `The task “${task.title}” is past due. Complete it or snooze if you need more time.`,
      lead_id: task.lead_id,
      created_at: new Date().toISOString(),
    });
    await dbmod.pool.query("UPDATE tasks SET notified_overdue_at=$1 WHERE id=$2", [new Date().toISOString(), task.id]);
  }
  return rows.length;
}

function parseDenverInput(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? fromDenver(+match[1], +match[2], +match[3], +match[4], +match[5]) : null;
}

function snoozeDue(currentDue, amount, now = new Date()) {
  const ms = amount === "1d" ? 86400000 : 3600000;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const dueMs = new Date(currentDue).getTime();
  const base = Number.isFinite(dueMs) && dueMs > nowMs ? dueMs : nowMs;
  return new Date(base + ms).toISOString();
}

module.exports = {
  onNewLead,
  flagOverdueTasks,
  parseDenverInput,
  snoozeDue,
  dueFromFollowup,
  taskTitle,
};
