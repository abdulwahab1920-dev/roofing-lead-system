const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "leads.db");

const STATUSES = ["New", "Contacted", "Quoted", "Won", "Lost"];

const PROPERTY_TYPES = ["Residential", "Commercial"];

const ROOF_TYPES = [
  "Asphalt shingle",
  "Metal",
  "Tile",
  "Flat",
  "Other",
];

const SERVICES = [
  "Roof repair",
  "Roof replacement",
  "Storm damage inspection",
  "Leak / emergency repair",
  "New construction",
  "Gutter installation or repair",
  "Roof inspection / estimate",
  "Other",
];

const URGENCIES = [
  "Emergency — active leak",
  "This week",
  "This month",
  "Planning — 1 to 3 months",
  "Just getting estimates",
];

const CONTACT_METHODS = ["Phone", "Email", "Text"];

const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

const SEED_LEADS = [
  {
    full_name: "James Whitaker",
    phone: "(512) 555-0184",
    email: "james.whitaker@email.com",
    street: "1847 Barton Hills Dr",
    city: "Austin",
    state: "TX",
    zip: "78704",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Storm damage inspection",
    issue_description:
      "Hail last weekend left dents on the south slope and two shingles are missing near the chimney. No active leak yet, but the attic smells damp after rain.",
    urgency: "This week",
    preferred_contact: "Phone",
    status: "New",
    created_at: "2026-11-12T16:22:00.000Z",
    notes: [
      { body: "Inbound from the website form.", created_at: "2026-11-12T16:22:00.000Z" },
    ],
  },
  {
    full_name: "Maria Gonzalez",
    phone: "(602) 555-0137",
    email: "maria.g.home@outlook.com",
    street: "3921 E Camelback Rd",
    city: "Phoenix",
    state: "AZ",
    zip: "85018",
    property_type: "Residential",
    roof_type: "Tile",
    service_needed: "Roof replacement",
    issue_description:
      "20-year-old clay tile roof. Several cracked tiles on the front elevation and granule loss in the valleys. Looking for a full replacement quote before summer.",
    urgency: "Planning — 1 to 3 months",
    preferred_contact: "Email",
    status: "Quoted",
    created_at: "2026-11-05T18:10:00.000Z",
    notes: [
      { body: "Site visit completed Nov 7. Measured 28 squares.", created_at: "2026-11-07T21:40:00.000Z" },
      { body: "Sent written quote for tile replacement, $24,850.", created_at: "2026-11-09T16:05:00.000Z" },
    ],
  },
  {
    full_name: "Robert Chen",
    phone: "(303) 555-0192",
    email: "rchen.family@gmail.com",
    street: "2784 S Gaylord St",
    city: "Denver",
    state: "CO",
    zip: "80210",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Leak / emergency repair",
    issue_description:
      "Water staining on the ceiling of the upstairs bedroom after the last snow. Suspect ice damming on the north side. Need someone out as soon as possible.",
    urgency: "Emergency — active leak",
    preferred_contact: "Phone",
    status: "Contacted",
    created_at: "2026-11-11T13:04:00.000Z",
    notes: [
      { body: "Called back within an hour. Scheduled inspection for Nov 12 at 9am.", created_at: "2026-11-11T14:18:00.000Z" },
    ],
  },
  {
    full_name: "Patricia Holloway",
    phone: "(404) 555-0166",
    email: "pholloway@bellsouth.net",
    street: "915 Virginia Ave NE",
    city: "Atlanta",
    state: "GA",
    zip: "30306",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Roof inspection / estimate",
    issue_description:
      "Buying a 1960s bungalow and the inspector flagged the roof as near end of life. Need a second opinion and a ballpark for replacement before closing.",
    urgency: "Just getting estimates",
    preferred_contact: "Email",
    status: "New",
    created_at: "2026-11-13T02:47:00.000Z",
    notes: [],
  },
  {
    full_name: "David Okonkwo",
    phone: "(713) 555-0141",
    email: "dokonkwo@harborlineproperties.com",
    street: "6100 Richmond Ave, Suite 200",
    city: "Houston",
    state: "TX",
    zip: "77057",
    property_type: "Commercial",
    roof_type: "Flat",
    service_needed: "Roof repair",
    issue_description:
      "TPO roof on a 12,000 sq ft office building. Ponding water on the west corner and a seam failure near the HVAC curb. Need repair now and a maintenance plan.",
    urgency: "This month",
    preferred_contact: "Phone",
    status: "Quoted",
    created_at: "2026-11-03T15:30:00.000Z",
    notes: [
      { body: "Commercial walkthrough Nov 4 with property manager.", created_at: "2026-11-04T20:15:00.000Z" },
      { body: "Quote sent for seam repair plus drainage correction, $18,400.", created_at: "2026-11-06T17:50:00.000Z" },
    ],
  },
  {
    full_name: "Linda Park",
    phone: "(206) 555-0178",
    email: "linda.park.home@gmail.com",
    street: "4415 SW Charlestown St",
    city: "Seattle",
    state: "WA",
    zip: "98116",
    property_type: "Residential",
    roof_type: "Tile",
    service_needed: "Roof repair",
    issue_description:
      "A few concrete tiles slipped after a windstorm. Gutters on the west side are also pulling away from the fascia.",
    urgency: "This week",
    preferred_contact: "Text",
    status: "Won",
    created_at: "2026-10-28T17:12:00.000Z",
    notes: [
      { body: "Approved repair quote. Crew booked for Nov 4.", created_at: "2026-10-30T18:20:00.000Z" },
      { body: "Work completed. Customer paid in full.", created_at: "2026-11-04T23:10:00.000Z" },
    ],
  },
  {
    full_name: "Michael Brennan",
    phone: "(312) 555-0129",
    email: "mbrennan@gmail.com",
    street: "2257 W Cortland St",
    city: "Chicago",
    state: "IL",
    zip: "60647",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Roof replacement",
    issue_description:
      "Asphalt shingles are curling and a few have blown off the rear dormer. Want a full tear-off and replace, preferably architectural shingles.",
    urgency: "Planning — 1 to 3 months",
    preferred_contact: "Email",
    status: "Lost",
    created_at: "2026-10-20T14:45:00.000Z",
    notes: [
      { body: "Quote sent Oct 24 for tear-off and GAF Timberline, $14,200.", created_at: "2026-10-24T19:00:00.000Z" },
      { body: "Went with another contractor on price. Closing out.", created_at: "2026-11-01T16:33:00.000Z" },
    ],
  },
  {
    full_name: "Sarah Nguyen",
    phone: "(407) 555-0153",
    email: "snguyen.home@yahoo.com",
    street: "1280 S Summerlin Ave",
    city: "Orlando",
    state: "FL",
    zip: "32806",
    property_type: "Residential",
    roof_type: "Metal",
    service_needed: "Storm damage inspection",
    issue_description:
      "Standing-seam metal roof took a beating in a tropical storm. One panel lifted near the ridge and the garage has a slow drip when it rains hard.",
    urgency: "Emergency — active leak",
    preferred_contact: "Phone",
    status: "Contacted",
    created_at: "2026-11-10T12:08:00.000Z",
    notes: [
      { body: "Left voicemail and followed up by text. Waiting to confirm a time window.", created_at: "2026-11-10T13:40:00.000Z" },
    ],
  },
];

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      street TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip TEXT NOT NULL,
      property_type TEXT NOT NULL,
      roof_type TEXT NOT NULL,
      service_needed TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      urgency TEXT NOT NULL,
      preferred_contact TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'New',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );
  `);
  if (process.env.SEED_DEMO_DATA === "true") seedIfEmpty(db);
  ensureAiColumns(db);
  backfillScores(db);
  ensureOpsTables(db);
  const workflow = require("./workflow");
  workflow.backfillNotificationsAndEmails(module.exports, db);
  workflow.backfillTasks(module.exports, db);
  return db;
}

function ensureOpsTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      lead_id INTEGER,
      read_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_addr TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      lead_id INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      title TEXT NOT NULL,
      due_at TEXT NOT NULL,
      completed_at TEXT,
      notified_overdue_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function ensureAiColumns(db) {
  const have = new Set(db.prepare("PRAGMA table_info(leads)").all().map((c) => c.name));
  const cols = [
    ["ai_category", "TEXT"],
    ["ai_priority", "TEXT"],
    ["ai_score", "INTEGER"],
    ["ai_value_low", "INTEGER"],
    ["ai_value_high", "INTEGER"],
    ["ai_next_action", "TEXT"],
    ["ai_followup", "TEXT"],
    ["ai_summary", "TEXT"],
    ["ai_scored_at", "TEXT"],
    ["ai_source", "TEXT"],
  ];
  for (const [name, typ] of cols) {
    if (!have.has(name)) db.exec("ALTER TABLE leads ADD COLUMN " + name + " " + typ);
  }
}

function scoreRow(result) {
  return {
    ai_category: result.category,
    ai_priority: result.priority,
    ai_score: result.score,
    ai_value_low: result.value_low,
    ai_value_high: result.value_high,
    ai_next_action: result.next_action,
    ai_followup: result.followup,
    ai_summary: result.summary,
    ai_scored_at: result.scored_at,
    ai_source: result.source,
  };
}

function saveScore(db, id, result) {
  return db.prepare(`
    UPDATE leads SET
      ai_category = @ai_category,
      ai_priority = @ai_priority,
      ai_score = @ai_score,
      ai_value_low = @ai_value_low,
      ai_value_high = @ai_value_high,
      ai_next_action = @ai_next_action,
      ai_followup = @ai_followup,
      ai_summary = @ai_summary,
      ai_scored_at = @ai_scored_at,
      ai_source = @ai_source
    WHERE id = @id
  `).run({ ...scoreRow(result), id });
}

function backfillScores(db) {
  const { scoreLead } = require("./ai/leadScorer");
  const leads = db.prepare("SELECT * FROM leads WHERE ai_score IS NULL").all();
  const tx = db.transaction(() => {
    for (const lead of leads) saveScore(db, lead.id, scoreLead(lead));
  });
  tx();
}

function seedIfEmpty(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM leads").get().n;
  if (count > 0) return;

  const insertLead = db.prepare(`
    INSERT INTO leads (
      full_name, phone, email, street, city, state, zip,
      property_type, roof_type, service_needed, issue_description,
      urgency, preferred_contact, status, created_at
    ) VALUES (
      @full_name, @phone, @email, @street, @city, @state, @zip,
      @property_type, @roof_type, @service_needed, @issue_description,
      @urgency, @preferred_contact, @status, @created_at
    )
  `);
  const insertNote = db.prepare(
    "INSERT INTO notes (lead_id, body, created_at) VALUES (?, ?, ?)"
  );

  const tx = db.transaction(() => {
    for (const lead of SEED_LEADS) {
      const info = insertLead.run(lead);
      for (const note of lead.notes) {
        insertNote.run(info.lastInsertRowid, note.body, note.created_at);
      }
    }
  });
  tx();
}

function insertLead(db, lead) {
  const stmt = db.prepare(`
    INSERT INTO leads (
      full_name, phone, email, street, city, state, zip,
      property_type, roof_type, service_needed, issue_description,
      urgency, preferred_contact, status, created_at
    ) VALUES (
      @full_name, @phone, @email, @street, @city, @state, @zip,
      @property_type, @roof_type, @service_needed, @issue_description,
      @urgency, @preferred_contact, @status, @created_at
    )
  `);
  const info = stmt.run(lead);
  const { scoreLead } = require("./ai/leadScorer");
  const row = db.prepare("SELECT * FROM leads WHERE id = ?").get(info.lastInsertRowid);
  saveScore(db, info.lastInsertRowid, scoreLead(row));
  return info;
}

function denverParts(date) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)) {
    parts[p.type] = p.value;
  }
  return parts;
}

function fromDenverLocal(year, month, day, hour, minute, second) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));
  const p = denverParts(guess);
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return new Date(guess.getTime() - (asUTC - guess.getTime()));
}

function startOfDenverDay(date) {
  const p = denverParts(date);
  return fromDenverLocal(Number(p.year), Number(p.month), Number(p.day), 0, 0, 0);
}

function startOfDenverMonth(date) {
  const p = denverParts(date);
  return fromDenverLocal(Number(p.year), Number(p.month), 1, 0, 0, 0);
}

function nextDenverMonth(date) {
  const p = denverParts(date);
  let year = Number(p.year);
  let month = Number(p.month) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return fromDenverLocal(year, month, 1, 0, 0, 0);
}

function rangeBounds(range) {
  const now = new Date();
  if (range === "today") {
    const start = startOfDenverDay(now);
    const end = startOfDenverDay(new Date(start.getTime() + 36 * 60 * 60 * 1000));
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (range === "month") {
    return {
      start: startOfDenverMonth(now).toISOString(),
      end: nextDenverMonth(now).toISOString(),
    };
  }
  return null;
}

function listLeads(db, query, filters) {
  const q = (query || "").trim();
  const f = filters || {};
  const where = [];
  const params = [];
  if (q) {
    where.push(
      "(full_name LIKE ? COLLATE NOCASE OR phone LIKE ? OR email LIKE ? COLLATE NOCASE)"
    );
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (f.status) {
    where.push("status = ?");
    params.push(f.status);
  }
  if (f.priority) {
    where.push("ai_priority = ?");
    params.push(f.priority);
  }
  if (f.open || f.pipeline) {
    where.push("status NOT IN ('Won', 'Lost')");
  }
  const bounds = rangeBounds(f.range);
  if (bounds) {
    where.push("datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)");
    params.push(bounds.start, bounds.end);
  }
  const sql =
    "SELECT * FROM leads" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY datetime(created_at) DESC, id DESC";
  return db.prepare(sql).all(...params);
}

function dashboardStats(db) {
  const today = rangeBounds("today");
  const month = rangeBounds("month");
  const countRange = (extraSql, start, end) =>
    db.prepare(
      `SELECT COUNT(*) AS n FROM leads WHERE ${extraSql} datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)`
    ).get(start, end).n;

  const newToday = countRange("", today.start, today.end);
  const openHot = db
    .prepare("SELECT COUNT(*) AS n FROM leads WHERE ai_priority = 'Hot' AND status NOT IN ('Won', 'Lost')")
    .get().n;
  const pipeline = db
    .prepare("SELECT COUNT(*) AS n FROM leads WHERE status NOT IN ('Won', 'Lost')")
    .get().n;
  const wonMonth = countRange("status = 'Won' AND", month.start, month.end);
  const overdueFollowups = countOverdueTasks(db);
  const total = countLeads(db);

  const byStatus = STATUSES.map((status) => ({
    status,
    n: db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = ?").get(status).n,
  }));
  const byPriority = ["Hot", "Warm", "Cold"].map((priority) => ({
    priority,
    n: db.prepare("SELECT COUNT(*) AS n FROM leads WHERE ai_priority = ?").get(priority).n,
  }));

  const recentLeads = db
    .prepare("SELECT * FROM leads ORDER BY datetime(created_at) DESC, id DESC LIMIT 8")
    .all();
  const overdueTasks = db
    .prepare(
      `SELECT tasks.*, leads.full_name AS lead_name, leads.ai_priority AS ai_priority
       FROM tasks
       LEFT JOIN leads ON leads.id = tasks.lead_id
       WHERE tasks.completed_at IS NULL AND datetime(tasks.due_at) < datetime('now')
       ORDER BY datetime(tasks.due_at) ASC, tasks.id ASC
       LIMIT 6`
    )
    .all();
  const upcomingTasks = db
    .prepare(
      `SELECT tasks.*, leads.full_name AS lead_name, leads.ai_priority AS ai_priority
       FROM tasks
       LEFT JOIN leads ON leads.id = tasks.lead_id
       WHERE tasks.completed_at IS NULL AND datetime(tasks.due_at) >= datetime('now')
       ORDER BY datetime(tasks.due_at) ASC, tasks.id ASC
       LIMIT 6`
    )
    .all();
  const recentNotifications = listNotifications(db, 6);
  const nowParts = denverParts(new Date());

  return {
    newToday,
    openHot,
    pipeline,
    wonMonth,
    overdueFollowups,
    total,
    byStatus,
    byPriority,
    recentLeads,
    overdueTasks,
    upcomingTasks,
    recentNotifications,
    todayLabel: `${nowParts.weekday}, ${nowParts.month}/${nowParts.day}/${nowParts.year}`,
    bounds: { today, month },
  };
}

function getLead(db, id) {
  return db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
}

function getNotes(db, leadId) {
  return db
    .prepare(
      "SELECT * FROM notes WHERE lead_id = ? ORDER BY datetime(created_at) DESC, id DESC"
    )
    .all(leadId);
}

function updateStatus(db, id, status) {
  return db.prepare("UPDATE leads SET status = ? WHERE id = ?").run(status, id);
}

function addNote(db, leadId, body) {
  return db
    .prepare("INSERT INTO notes (lead_id, body, created_at) VALUES (?, ?, ?)")
    .run(leadId, body, new Date().toISOString());
}

function countLeads(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM leads").get().n;
}

function insertNotification(db, row) {
  return db.prepare(`
    INSERT INTO notifications (type, title, body, lead_id, read_at, created_at)
    VALUES (@type, @title, @body, @lead_id, @read_at, @created_at)
  `).run({
    type: row.type,
    title: row.title,
    body: row.body || "",
    lead_id: row.lead_id || null,
    read_at: row.read_at || null,
    created_at: row.created_at || new Date().toISOString(),
  });
}

function listNotifications(db, limit) {
  const sql = `
    SELECT notifications.*, leads.full_name AS lead_name
    FROM notifications
    LEFT JOIN leads ON leads.id = notifications.lead_id
    ORDER BY datetime(notifications.created_at) DESC, notifications.id DESC
  `;
  if (limit) return db.prepare(sql + " LIMIT ?").all(limit);
  return db.prepare(sql).all();
}

function getNotification(db, id) {
  return db.prepare("SELECT * FROM notifications WHERE id = ?").get(id);
}

function markNotificationRead(db, id) {
  return db.prepare(
    "UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL"
  ).run(new Date().toISOString(), id);
}

function markAllNotificationsRead(db) {
  return db.prepare(
    "UPDATE notifications SET read_at = ? WHERE read_at IS NULL"
  ).run(new Date().toISOString());
}

function countUnreadNotifications(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL").get().n;
}

function insertEmail(db, row) {
  return db.prepare(`
    INSERT INTO emails (to_addr, subject, body, status, error, lead_id, created_at)
    VALUES (@to_addr, @subject, @body, @status, @error, @lead_id, @created_at)
  `).run({
    to_addr: row.to_addr,
    subject: row.subject,
    body: row.body,
    status: row.status,
    error: row.error || null,
    lead_id: row.lead_id || null,
    created_at: row.created_at || new Date().toISOString(),
  });
}

function listEmails(db) {
  return db.prepare(`
    SELECT emails.*, leads.full_name AS lead_name
    FROM emails
    LEFT JOIN leads ON leads.id = emails.lead_id
    ORDER BY datetime(emails.created_at) DESC, emails.id DESC
  `).all();
}

function insertTask(db, row) {
  return db.prepare(`
    INSERT INTO tasks (lead_id, title, due_at, completed_at, notified_overdue_at, created_at)
    VALUES (@lead_id, @title, @due_at, @completed_at, @notified_overdue_at, @created_at)
  `).run({
    lead_id: row.lead_id || null,
    title: row.title,
    due_at: row.due_at,
    completed_at: row.completed_at || null,
    notified_overdue_at: row.notified_overdue_at || null,
    created_at: row.created_at || new Date().toISOString(),
  });
}

function listTasks(db) {
  return db.prepare(`
    SELECT tasks.*, leads.full_name AS lead_name, leads.ai_priority AS ai_priority
    FROM tasks
    LEFT JOIN leads ON leads.id = tasks.lead_id
    ORDER BY datetime(tasks.due_at) ASC, tasks.id ASC
  `).all();
}

function listTasksForLead(db, leadId) {
  return db.prepare(`
    SELECT tasks.*, leads.full_name AS lead_name, leads.ai_priority AS ai_priority
    FROM tasks
    LEFT JOIN leads ON leads.id = tasks.lead_id
    WHERE tasks.lead_id = ?
    ORDER BY (tasks.completed_at IS NULL) DESC, datetime(tasks.due_at) ASC, tasks.id ASC
  `).all(leadId);
}

function getTask(db, id) {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
}

function completeTask(db, id) {
  return db.prepare(
    "UPDATE tasks SET completed_at = ? WHERE id = ? AND completed_at IS NULL"
  ).run(new Date().toISOString(), id);
}

function snoozeTask(db, id, dueAt) {
  return db.prepare(
    "UPDATE tasks SET due_at = ?, notified_overdue_at = NULL WHERE id = ? AND completed_at IS NULL"
  ).run(dueAt, id);
}

function countOverdueTasks(db) {
  return db.prepare(
    `SELECT COUNT(*) AS n FROM tasks
     WHERE completed_at IS NULL AND datetime(due_at) < datetime('now')`
  ).get().n;
}

module.exports = {
  open,
  insertLead,
  listLeads,
  dashboardStats,
  rangeBounds,
  getLead,
  getNotes,
  updateStatus,
  addNote,
  saveScore,
  countLeads,
  insertNotification,
  listNotifications,
  getNotification,
  markNotificationRead,
  markAllNotificationsRead,
  countUnreadNotifications,
  insertEmail,
  listEmails,
  insertTask,
  listTasks,
  listTasksForLead,
  getTask,
  completeTask,
  snoozeTask,
  countOverdueTasks,
  STATUSES,
  PROPERTY_TYPES,
  ROOF_TYPES,
  SERVICES,
  URGENCIES,
  CONTACT_METHODS,
  US_STATES,
  DB_PATH,
};
