"use strict";

const mailer = require("./mailer");

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date, hours) {
  return addMinutes(date, hours * 60);
}

function denverParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return parts;
}

function denverOffsetIso(date) {
  const p = denverParts(date);
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return (asUTC - date.getTime()) / 60000;
}

function fromDenverLocal(year, month, day, hour, minute) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMin = denverOffsetIso(guess);
  return new Date(guess.getTime() - offsetMin * 60000);
}

function addBusinessDays(date, days) {
  let cursor = new Date(date);
  let added = 0;
  while (added < days) {
    cursor = addHours(cursor, 24);
    const wd = denverParts(cursor).weekday;
    if (wd !== "Sat" && wd !== "Sun") added += 1;
  }
  return cursor;
}

function endOfBusinessDay(date) {
  const p = denverParts(date);
  const wd = p.weekday;
  let year = Number(p.year);
  let month = Number(p.month);
  let day = Number(p.day);
  let target = fromDenverLocal(year, month, day, 17, 0);
  if (wd === "Sat" || wd === "Sun" || date.getTime() >= target.getTime()) {
    return addBusinessDays(fromDenverLocal(year, month, day, 9, 0), 1);
  }
  return target;
}

function dueFromFollowup(followup, fromDate) {
  const start = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const t = String(followup || "").toLowerCase();
  if (t.includes("15 minute")) return addMinutes(start, 15);
  if (t.includes("2 hour")) return addHours(start, 2);
  if (t.includes("same business day")) return endOfBusinessDay(start);
  if (t.includes("2 business day")) return addBusinessDays(start, 2);
  if (t.includes("1 business day")) return addBusinessDays(start, 1);
  return addBusinessDays(start, 1);
}

function taskTitle(lead) {
  const name = lead.full_name || "lead";
  const verb = lead.ai_priority === "Hot" || String(lead.urgency || "").startsWith("Emergency")
    ? "Call"
    : "Follow up with";
  const extra = lead.ai_category ? ` — ${lead.ai_category}` : "";
  return `${verb} ${name}${extra}`;
}

function notificationCopy(lead) {
  const priority = lead.ai_priority || "New";
  const title = `New ${priority} lead: ${lead.full_name}`;
  const bits = [
    lead.ai_category ? `${lead.ai_category}` : null,
    lead.ai_score != null ? `score ${lead.ai_score}` : null,
    lead.ai_followup ? `follow up ${lead.ai_followup.toLowerCase()}` : null,
  ].filter(Boolean);
  const body = bits.length
    ? `${lead.full_name} submitted a request. ${bits.join(" · ")}. ${lead.ai_next_action || ""}`.trim()
    : `${lead.full_name} submitted a new inspection request.`;
  return { title, body };
}

async function onNewLead(dbmod, db, lead) {
  const now = new Date().toISOString();
  const { title, body } = notificationCopy(lead);
  dbmod.insertNotification(db, {
    type: "new_lead",
    title,
    body,
    lead_id: lead.id,
    created_at: now,
  });
  await mailer.sendLeadAlert(dbmod, db, lead, now);
  dbmod.insertTask(db, {
    lead_id: lead.id,
    title: taskTitle(lead),
    due_at: dueFromFollowup(lead.ai_followup, lead.created_at || now).toISOString(),
    created_at: now,
  });
}

function backfillNotificationsAndEmails(dbmod, db) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM notifications").get().n;
  if (existing > 0) return;
  const leads = db
    .prepare("SELECT * FROM leads ORDER BY datetime(created_at) DESC, id DESC LIMIT 5")
    .all();
  for (const lead of leads) {
    const when = lead.created_at || new Date().toISOString();
    const { title, body } = notificationCopy(lead);
    dbmod.insertNotification(db, {
      type: "new_lead",
      title,
      body,
      lead_id: lead.id,
      created_at: when,
    });
    const { subject, body: emailBody } = mailer.composeLeadAlert(lead);
    dbmod.insertEmail(db, {
      to_addr: process.env.NOTIFY_EMAIL || process.env.SMTP_TO || mailer.DEFAULT_TO,
      subject,
      body: emailBody,
      status: "logged",
      error: null,
      lead_id: lead.id,
      created_at: when,
    });
  }
}

function backfillTasks(dbmod, db) {
  const leads = db.prepare("SELECT * FROM leads").all();
  const now = Date.now();
  for (const lead of leads) {
    const has = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE lead_id = ?").get(lead.id).n;
    if (has > 0) continue;
    const created = lead.created_at || new Date().toISOString();
    const due = dueFromFollowup(lead.ai_followup, created).toISOString();
    const completed = lead.status === "Won" || lead.status === "Lost" ? due : null;
    dbmod.insertTask(db, {
      lead_id: lead.id,
      title: taskTitle(lead),
      due_at: due,
      completed_at: completed,
      created_at: created,
    });
  }

  const overdue = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks
       WHERE completed_at IS NULL AND datetime(due_at) < datetime('now')`
    )
    .get().n;
  if (overdue === 0) {
    const row = db
      .prepare(
        `SELECT id FROM tasks WHERE completed_at IS NULL
         ORDER BY datetime(due_at) ASC, id ASC LIMIT 1`
      )
      .get();
    if (row) {
      const past = new Date(now - 3 * 60 * 60 * 1000).toISOString();
      db.prepare("UPDATE tasks SET due_at = ? WHERE id = ?").run(past, row.id);
    }
  }

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks
       WHERE completed_at IS NULL
         AND date(due_at, 'localtime') = date('now', 'localtime')
         AND datetime(due_at) >= datetime('now')`
    )
    .get().n;
  if (todayCount === 0) {
    const lead = db
      .prepare(
        `SELECT * FROM leads WHERE status IN ('Quoted', 'Contacted', 'New')
         ORDER BY datetime(created_at) DESC LIMIT 1`
      )
      .get();
    if (lead) {
      const due = addHours(new Date(), 3).toISOString();
      dbmod.insertTask(db, {
        lead_id: lead.id,
        title: `Check in on ${lead.full_name}`,
        due_at: due,
        created_at: new Date().toISOString(),
      });
    }
  }
}

function flagOverdueTasks(dbmod, db) {
  const stale = db
    .prepare(
      `SELECT tasks.*, leads.full_name AS lead_name
       FROM tasks
       LEFT JOIN leads ON leads.id = tasks.lead_id
       WHERE tasks.completed_at IS NULL
         AND tasks.notified_overdue_at IS NULL
         AND datetime(tasks.due_at) < datetime('now')`
    )
    .all();
  if (!stale.length) return 0;
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const task of stale) {
      dbmod.insertNotification(db, {
        type: "task_overdue",
        title: `Follow-up overdue: ${task.lead_name || "a lead"}`,
        body: `The task “${task.title}” is past due. Complete it or snooze if you need more time.`,
        lead_id: task.lead_id,
        created_at: now,
      });
      db.prepare("UPDATE tasks SET notified_overdue_at = ? WHERE id = ?").run(now, task.id);
    }
  });
  tx();
  return stale.length;
}

function parseDenverInput(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return fromDenverLocal(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

module.exports = {
  dueFromFollowup,
  parseDenverInput,
  taskTitle,
  onNewLead,
  backfillNotificationsAndEmails,
  backfillTasks,
  flagOverdueTasks,
};
