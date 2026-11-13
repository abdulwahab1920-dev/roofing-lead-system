const path = require("path");
const express = require("express");
const session = require("express-session");
const dbmod = require("./db");
const views = require("./views");
const scorer = require("./ai/leadScorer");
const workflow = require("./workflow");

const PORT = Number(process.env.PORT) || 3847;
const HOST = "0.0.0.0";
const ADMIN_USER = "admin";
const ADMIN_PASS = "SummitRidge2026!";
const SESSION_SECRET = process.env.SESSION_SECRET || "summit-ridge-part1-demo-secret";

const db = dbmod.open();
const app = express();

app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: "sr.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 },
  })
);
app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  const nextUrl = req.originalUrl || "/admin";
  return res.redirect("/admin/login?next=" + encodeURIComponent(nextUrl));
}

function chrome() {
  return {
    unread: dbmod.countUnreadNotifications(db),
    overdueCount: dbmod.countOverdueTasks(db),
    notifications: dbmod.listNotifications(db, 8),
  };
}

function safeNext(req, fallback) {
  const next = trim((req.body && req.body.next) || "");
  return next.startsWith("/admin") ? next : fallback;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const PHONE_RE = /^[0-9+().\-\s]{7,30}$/;
const STATE_CODES = new Set(dbmod.US_STATES.map(([code]) => code));

function trim(value) {
  return String(value || "").trim();
}

function inList(value, list) {
  return list.includes(value);
}

function validateLead(body) {
  const values = {
    full_name: trim(body.full_name),
    phone: trim(body.phone),
    email: trim(body.email),
    street: trim(body.street),
    city: trim(body.city),
    state: trim(body.state).toUpperCase(),
    zip: trim(body.zip),
    property_type: trim(body.property_type),
    roof_type: trim(body.roof_type),
    service_needed: trim(body.service_needed),
    issue_description: trim(body.issue_description),
    urgency: trim(body.urgency),
    preferred_contact: trim(body.preferred_contact),
  };
  const errors = {};

  if (!values.full_name) errors.full_name = "Enter your full name.";
  else if (values.full_name.length < 2) errors.full_name = "Name is too short.";

  if (!values.phone) errors.phone = "Enter a phone number.";
  else if (!PHONE_RE.test(values.phone) || values.phone.replace(/\D/g, "").length < 10) {
    errors.phone = "Enter a valid US phone number.";
  }

  if (!values.email) errors.email = "Enter an email address.";
  else if (!EMAIL_RE.test(values.email)) errors.email = "Enter a valid email address.";

  if (!values.street) errors.street = "Enter the street address.";
  if (!values.city) errors.city = "Enter the city.";
  if (!values.state) errors.state = "Select a state.";
  else if (!STATE_CODES.has(values.state)) errors.state = "Select a valid US state.";

  if (!values.zip) errors.zip = "Enter a ZIP code.";
  else if (!ZIP_RE.test(values.zip)) errors.zip = "Enter a 5-digit ZIP code.";

  if (!inList(values.property_type, dbmod.PROPERTY_TYPES)) {
    errors.property_type = "Select a property type.";
  }
  if (!inList(values.roof_type, dbmod.ROOF_TYPES)) {
    errors.roof_type = "Select a roof type.";
  }
  if (!inList(values.service_needed, dbmod.SERVICES)) {
    errors.service_needed = "Select the service needed.";
  }
  if (!inList(values.urgency, dbmod.URGENCIES)) {
    errors.urgency = "Select an urgency / timeline.";
  }
  if (!inList(values.preferred_contact, dbmod.CONTACT_METHODS)) {
    errors.preferred_contact = "Select a preferred contact method.";
  }
  if (!values.issue_description) {
    errors.issue_description = "Describe the issue.";
  } else if (values.issue_description.length < 10) {
    errors.issue_description = "Please add a bit more detail (at least 10 characters).";
  }

  return { values, errors, ok: Object.keys(errors).length === 0 };
}

app.get("/", (req, res) => {
  res.type("html").send(views.formPage());
});

app.post("/leads", async (req, res) => {
  const { values, errors, ok } = validateLead(req.body || {});
  if (!ok) {
    return res.status(400).type("html").send(
      views.formPage({
        values,
        errors,
        banner: "Please fix the highlighted fields and try again.",
      })
    );
  }
  const info = dbmod.insertLead(db, {
    ...values,
    status: "New",
    created_at: new Date().toISOString(),
  });
  const leadId = info.lastInsertRowid;
  const lead = dbmod.getLead(db, leadId);
  await workflow.onNewLead(dbmod, db, lead);
  if (process.env.OPENAI_API_KEY) {
    scorer.scoreLeadMaybeAi(lead).then((result) => dbmod.saveScore(db, leadId, result)).catch(() => {});
  }
  res.redirect("/thanks?id=" + leadId);
});

app.get("/thanks", (req, res) => {
  res.type("html").send(views.thanksPage());
});

app.get("/admin/login", (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect("/admin");
  res.type("html").send(views.loginPage());
});

app.post("/admin/login", (req, res) => {
  const username = trim(req.body && req.body.username);
  const password = String((req.body && req.body.password) || "");
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.authenticated = true;
    const next = trim(req.query.next || req.body.next || "");
    const dest = next.startsWith("/admin") ? next : "/admin";
    return res.redirect(dest);
  }
  res.status(401).type("html").send(views.loginPage({ error: "Invalid username or password." }));
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

app.get("/admin", requireAdmin, (req, res) => {
  if (trim(req.query.q)) {
    return res.redirect("/admin/leads?q=" + encodeURIComponent(trim(req.query.q)));
  }
  const stats = dbmod.dashboardStats(db);
  res.type("html").send(views.dashboardPage({ stats, chrome: chrome() }));
});

function leadFilters(query) {
  const status = trim(query.status);
  const priority = trim(query.priority);
  const range = trim(query.range);
  return {
    status: dbmod.STATUSES.includes(status) ? status : "",
    priority: ["Hot", "Warm", "Cold"].includes(priority) ? priority : "",
    open: query.open === "1",
    pipeline: query.pipeline === "1",
    range: range === "today" || range === "month" ? range : "",
  };
}

function leadFilterLabel(filters) {
  if (filters.range === "today") return "new leads today";
  if (filters.open && filters.priority === "Hot") return "open Hot leads";
  if (filters.pipeline) return "leads in the pipeline";
  if (filters.status === "Won" && filters.range === "month") return "leads won this month";
  const bits = [];
  if (filters.status) bits.push("status " + filters.status);
  if (filters.priority) bits.push(filters.priority + " priority");
  if (filters.open) bits.push("open leads");
  if (filters.range === "month") bits.push("received this month");
  return bits.join(", ");
}

app.get("/admin/leads", requireAdmin, (req, res) => {
  const query = trim(req.query.q);
  const filters = leadFilters(req.query);
  const leads = dbmod.listLeads(db, query, filters);
  const count = dbmod.countLeads(db);
  res.type("html").send(
    views.listPage({
      leads,
      query,
      count,
      chrome: chrome(),
      filterLabel: leadFilterLabel(filters),
    })
  );
});

function renderDetail(res, lead, extra) {
  const notes = dbmod.getNotes(db, lead.id);
  const tasks = dbmod.listTasksForLead(db, lead.id);
  res.type("html").send(views.detailPage({ lead, notes, tasks, chrome: chrome(), ...extra }));
}

app.get("/admin/leads/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const lead = dbmod.getLead(db, id);
  if (!lead) return res.status(404).type("html").send(views.notFoundPage());
  renderDetail(res, lead);
});

app.post("/admin/leads/:id/status", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const lead = dbmod.getLead(db, id);
  if (!lead) return res.status(404).type("html").send(views.notFoundPage());
  const status = trim(req.body && req.body.status);
  if (!dbmod.STATUSES.includes(status)) {
    res.status(400);
    return renderDetail(res, lead, { error: "Choose a valid status." });
  }
  dbmod.updateStatus(db, id, status);
  res.redirect("/admin/leads/" + id);
});

app.post("/admin/leads/:id/notes", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const lead = dbmod.getLead(db, id);
  if (!lead) return res.status(404).type("html").send(views.notFoundPage());
  const body = trim(req.body && req.body.body);
  if (!body) {
    res.status(400);
    return renderDetail(res, lead, { error: "Enter a note before saving." });
  }
  dbmod.addNote(db, id, body);
  res.redirect("/admin/leads/" + id);
});

app.post("/admin/leads/:id/rescore", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const lead = dbmod.getLead(db, id);
  if (!lead) return res.status(404).type("html").send(views.notFoundPage());
  const result = await scorer.scoreLeadMaybeAi(lead);
  dbmod.saveScore(db, id, result);
  res.redirect("/admin/leads/" + id);
});

app.get("/admin/notifications", requireAdmin, (req, res) => {
  res.type("html").send(
    views.notificationsPage({
      notifications: dbmod.listNotifications(db),
      chrome: chrome(),
      inboxOpen: req.query.open === "1",
    })
  );
});

app.get("/admin/notifications/:id/open", requireAdmin, (req, res) => {
  const item = dbmod.getNotification(db, Number(req.params.id));
  if (!item) return res.redirect("/admin/notifications");
  dbmod.markNotificationRead(db, item.id);
  if (item.lead_id) return res.redirect("/admin/leads/" + item.lead_id);
  return res.redirect("/admin/notifications");
});

app.post("/admin/notifications/read-all", requireAdmin, (req, res) => {
  dbmod.markAllNotificationsRead(db);
  const back = (req.get("referer") || "").includes("/admin") ? req.get("referer") : "/admin/notifications";
  res.redirect(back);
});

app.get("/admin/emails", requireAdmin, (req, res) => {
  res.type("html").send(views.emailLogPage({ emails: dbmod.listEmails(db), chrome: chrome() }));
});

app.get("/admin/tasks", requireAdmin, (req, res) => {
  res.type("html").send(views.tasksPage({ tasks: dbmod.listTasks(db), chrome: chrome() }));
});

app.post("/admin/leads/:id/tasks", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const lead = dbmod.getLead(db, id);
  if (!lead) return res.status(404).type("html").send(views.notFoundPage());
  const title = trim(req.body && req.body.title);
  const due = workflow.parseDenverInput(req.body && req.body.due_at);
  if (!title || !due) {
    res.status(400);
    return renderDetail(res, lead, { error: "Enter a task title and a valid due date." });
  }
  dbmod.insertTask(db, {
    lead_id: id,
    title,
    due_at: due.toISOString(),
    created_at: new Date().toISOString(),
  });
  res.redirect("/admin/leads/" + id);
});

app.post("/admin/tasks/:id/complete", requireAdmin, (req, res) => {
  const task = dbmod.getTask(db, Number(req.params.id));
  if (!task) return res.redirect("/admin/tasks");
  dbmod.completeTask(db, task.id);
  res.redirect(safeNext(req, task.lead_id ? "/admin/leads/" + task.lead_id : "/admin/tasks"));
});

app.post("/admin/tasks/:id/snooze", requireAdmin, (req, res) => {
  const task = dbmod.getTask(db, Number(req.params.id));
  if (!task) return res.redirect("/admin/tasks");
  const amount = trim(req.body && req.body.amount);
  const hours = amount === "1d" ? 24 : 1;
  const due = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  dbmod.snoozeTask(db, task.id, due);
  res.redirect(safeNext(req, "/admin/tasks"));
});

app.use((req, res) => {
  res.status(404).type("html").send(views.notFoundPage());
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Summit Ridge lead form: http://localhost:${PORT}/`);
  console.log(`Dashboard: http://localhost:${PORT}/admin`);
  console.log(`Leads: http://localhost:${PORT}/admin/leads`);
  workflow.flagOverdueTasks(dbmod, db);
  setInterval(() => {
    try {
      workflow.flagOverdueTasks(dbmod, db);
    } catch (err) {
      console.error("overdue check failed", err);
    }
  }, 30000).unref();
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is in use. Set PORT to a free port and retry.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
