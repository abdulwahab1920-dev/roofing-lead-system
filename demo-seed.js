"use strict";

const { scoreLead } = require("./ai/leadScorer");
const tz = require("./timezone");

const META_KEY = "reset_token";

function denverShift(now, daysFromToday, hour, minute) {
  const parts = tz.zoneParts(now, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const base = tz.fromZone(Number(parts.year), Number(parts.month), Number(parts.day), hour, minute, 0);
  return new Date(base.getTime() + daysFromToday * 24 * 60 * 60 * 1000);
}

function endOfDenverDay(now) {
  const parts = tz.zoneParts(now, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return tz.fromZone(Number(parts.year), Number(parts.month), Number(parts.day), 23, 59, 0);
}

function dueFor(spec, now) {
  if (spec.bucket === "overdue") return new Date(now.getTime() - (spec.hoursAgo || 6) * 3600000);
  if (spec.bucket === "today") {
    const room = endOfDenverDay(now).getTime() - now.getTime();
    if (room > 2 * 60 * 1000) return new Date(now.getTime() + Math.floor(room / 2));
    return new Date(now.getTime() + 60 * 1000);
  }
  if (spec.bucket === "upcoming") return denverShift(now, spec.days || 2, spec.hour == null ? 10 : spec.hour, spec.minute || 0);
  if (spec.bucket === "done") return new Date(now.getTime() - (spec.daysAgo || 3) * 86400000);
  throw new Error("Unknown task bucket: " + spec.bucket);
}

function createdStamp(now, daysAgo, hour, minute) {
  let when = denverShift(now, -daysAgo, hour, minute);
  const latest = now.getTime() - 60 * 1000;
  if (when.getTime() > latest) when = new Date(latest);
  return when.toISOString();
}

function lead(partial) {
  return {
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    preferred_contact: "Phone",
    notes: ["Fictional demo lead. Not a real customer or a real address."],
    tasks: [],
    ...partial,
  };
}

// Dates are not stored here. buildSeedSchedule() turns the buckets into
// timestamps relative to the moment the seed runs.
const SAMPLE_LEADS = [
  lead({
    full_name: "Casey Demo",
    phone: "(555) 010-0101",
    email: "casey.demo@example.com",
    street: "101 Demo Lane",
    city: "Denver",
    state: "CO",
    zip: "80202",
    service_needed: "Leak / emergency repair",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Water is dripping through a pretend dining-room ceiling after a made-up storm. This sample asks for a same-day look.",
    urgency: "Emergency — active leak",
    status: "New",
    days_ago: 0,
    hour: 8,
    minute: 15,
    tasks: [{ title: "Call Casey Demo about the active leak", bucket: "overdue", hoursAgo: 3 }],
  }),
  lead({
    full_name: "Riley Sample",
    phone: "(555) 010-0102",
    email: "riley.sample@example.com",
    street: "102 Sample Street",
    city: "Aurora",
    state: "CO",
    zip: "80012",
    service_needed: "Roof inspection / estimate",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Just looking for a ballpark someday, not in a hurry, and only getting estimates before deciding whether to do anything.",
    urgency: "Just getting estimates",
    preferred_contact: "Email",
    status: "New",
    days_ago: 0,
    hour: 9,
    minute: 5,
    tasks: [{ title: "Send Riley Sample an inspection window", bucket: "today" }],
  }),
  lead({
    full_name: "Jordan Fictional",
    phone: "(555) 010-0103",
    email: "jordan.fictional@example.com",
    street: "103 Fictional Court",
    city: "Boulder",
    state: "CO",
    zip: "80301",
    service_needed: "Storm damage inspection",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Made-up hail left imaginary granule piles in the gutters. No insurance claim has been opened in this sample.",
    urgency: "This week",
    status: "Contacted",
    days_ago: 2,
    hour: 10,
    minute: 0,
    tasks: [
      { title: "Confirm the hail inspection with Jordan Fictional", bucket: "today" },
      { title: "Left a voicemail for Jordan Fictional", bucket: "done", daysAgo: 1 },
    ],
  }),
  lead({
    full_name: "Avery Placeholder",
    phone: "(555) 010-0104",
    email: "avery.placeholder@example.com",
    street: "104 Pretend Avenue",
    city: "Colorado Springs",
    state: "CO",
    zip: "80903",
    service_needed: "Roof repair",
    issue_description: "FICTIONAL DEMO — not a real homeowner. A pretend wind lifted a few sample shingles on the back slope. No interior leak in this story.",
    urgency: "This week",
    preferred_contact: "Text",
    status: "Contacted",
    days_ago: 4,
    hour: 14,
    minute: 20,
    tasks: [{ title: "Follow up with Avery Placeholder on the wind damage", bucket: "overdue", hoursAgo: 20 }],
  }),
  lead({
    full_name: "Quinn Example",
    phone: "(555) 010-0105",
    email: "quinn.example@example.com",
    street: "105 Notareal Road",
    city: "Fort Collins",
    state: "CO",
    zip: "80524",
    roof_type: "Tile",
    service_needed: "Roof replacement",
    issue_description: "FICTIONAL DEMO — not a real homeowner. The sample tile roof is described as 26 years old so the quote page has a replacement to show. Nobody lives here.",
    urgency: "This month",
    preferred_contact: "Email",
    status: "Quoted",
    days_ago: 7,
    hour: 11,
    minute: 10,
    tasks: [{ title: "Check whether Quinn Example accepted the quote", bucket: "upcoming", days: 2 }],
  }),
  lead({
    full_name: "Skyler Notreal",
    phone: "(555) 010-0106",
    email: "skyler.notreal@example.com",
    street: "106 Imaginary Boulevard",
    city: "Denver",
    state: "CO",
    zip: "80216",
    property_type: "Commercial",
    roof_type: "Flat",
    service_needed: "Roof repair",
    issue_description: "FICTIONAL DEMO — not a real property. A made-up warehouse of 18,000 sq ft with pretend ponding near two drains. The contact is a sample property manager.",
    urgency: "This week",
    status: "Quoted",
    days_ago: 5,
    hour: 9,
    minute: 0,
    tasks: [
      { title: "Call Skyler Notreal about roof access", bucket: "today" },
      { title: "Schedule the fictional warehouse walk-through", bucket: "upcoming", days: 4 },
    ],
  }),
  lead({
    full_name: "Morgan Makebelieve",
    phone: "(555) 010-0107",
    email: "morgan.makebelieve@example.com",
    street: "107 Placeholder Drive",
    city: "Grand Junction",
    state: "CO",
    zip: "81501",
    service_needed: "Roof replacement",
    issue_description: "FICTIONAL DEMO — not a real homeowner. This sample was marked won so the dashboard has a job received this month. The agreement is imaginary.",
    urgency: "This month",
    status: "Won",
    days_ago: 0,
    hour: 8,
    minute: 40,
    tasks: [{ title: "Send Morgan Makebelieve the sample agreement", bucket: "done", daysAgo: 1 }],
  }),
  lead({
    full_name: "Taylor Pretend",
    phone: "(555) 010-0108",
    email: "taylor.pretend@example.com",
    street: "108 Makebelieve Way",
    city: "Pueblo",
    state: "CO",
    zip: "81003",
    service_needed: "Roof repair",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Sample repair that was marked won a couple of weeks ago. Payment in this story is already collected.",
    urgency: "This month",
    status: "Won",
    days_ago: 18,
    hour: 13,
    minute: 0,
    tasks: [{ title: "Collect the sample payment from Taylor Pretend", bucket: "done", daysAgo: 10 }],
  }),
  lead({
    full_name: "Reese Imaginary",
    phone: "(555) 010-0109",
    email: "reese.imaginary@example.com",
    street: "109 Example Circle",
    city: "Lakewood",
    state: "CO",
    zip: "80226",
    service_needed: "Roof inspection / estimate",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Shopping a pretend second opinion and then staying with another contractor. Marked lost on purpose.",
    urgency: "Just getting estimates",
    preferred_contact: "Email",
    status: "Lost",
    days_ago: 15,
    hour: 15,
    minute: 30,
    tasks: [{ title: "Close out Reese Imaginary", bucket: "done", daysAgo: 8 }],
  }),
  lead({
    full_name: "Parker Fakeson",
    phone: "(555) 010-0110",
    email: "parker.fakeson@example.com",
    street: "110 Nobody Lane",
    city: "Arvada",
    state: "CO",
    zip: "80004",
    service_needed: "Roof replacement",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Chose a made-up cheaper bid. This lost lead is a few weeks old so the list is not all from this week.",
    urgency: "This month",
    status: "Lost",
    days_ago: 22,
    hour: 11,
    minute: 45,
    tasks: [{ title: "Note that Parker Fakeson chose another contractor", bucket: "done", daysAgo: 14 }],
  }),
  lead({
    full_name: "Drew Sampleton",
    phone: "(555) 010-0111",
    email: "drew.sampleton@example.com",
    street: "111 Synthetic Court",
    city: "Westminster",
    state: "CO",
    zip: "80031",
    service_needed: "Roof inspection / estimate",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Just looking, not in a hurry, and only collecting estimates for a house that does not exist.",
    urgency: "Just getting estimates",
    preferred_contact: "Email",
    status: "Cold",
    days_ago: 6,
    hour: 16,
    minute: 10,
    tasks: [{ title: "Nurture email to Drew Sampleton", bucket: "upcoming", days: 6, hour: 9 }],
  }),
  lead({
    full_name: "Jamie Demo",
    phone: "(555) 010-0112",
    email: "jamie.demo@example.com",
    street: "112 Storybook Drive",
    city: "Centennial",
    state: "CO",
    zip: "80112",
    service_needed: "Roof inspection / estimate",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Planning a year out, just looking, and not in a hurry. Kept as a cold sample so the board is not all hot work.",
    urgency: "Planning — 1 to 3 months",
    preferred_contact: "Email",
    status: "Cold",
    days_ago: 11,
    hour: 10,
    minute: 30,
    tasks: [
      { title: "Reopen Jamie Demo — no reply", bucket: "overdue", hoursAgo: 30 },
      { title: "Send Jamie Demo a short check-in", bucket: "upcoming", days: 3 },
    ],
  }),
  lead({
    full_name: "Blake Fiction",
    phone: "(555) 010-0113",
    email: "blake.fiction@example.com",
    street: "113 Practice Avenue",
    city: "Littleton",
    state: "CO",
    zip: "80120",
    service_needed: "Leak / emergency repair",
    issue_description: "FICTIONAL DEMO — not a real homeowner. A sample attic stain noticed yesterday. Not an active downpour, just a made-up follow-up for today.",
    urgency: "This week",
    status: "New",
    days_ago: 1,
    hour: 17,
    minute: 5,
    tasks: [{ title: "Call Blake Fiction about the attic stain", bucket: "today" }],
  }),
  lead({
    full_name: "Cameron Example",
    phone: "(555) 010-0114",
    email: "cameron.example@example.com",
    street: "114 Demo Ridge",
    city: "Thornton",
    state: "CO",
    zip: "80229",
    service_needed: "Gutter installation or repair",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Sample gutters pulled away from a pretend fascia. One missed callback, one upcoming quote, and one finished text.",
    urgency: "This month",
    status: "Contacted",
    days_ago: 9,
    hour: 12,
    minute: 0,
    tasks: [
      { title: "Quote gutters for Cameron Example", bucket: "upcoming", days: 1, hour: 15 },
      { title: "Missed callback to Cameron Example", bucket: "overdue", hoursAgo: 8 },
      { title: "Texted Cameron Example a photo request", bucket: "done", daysAgo: 6 },
    ],
  }),
  lead({
    full_name: "Logan Notaperson",
    phone: "(555) 010-0115",
    email: "logan.notaperson@example.com",
    street: "115 Sample Creek Road",
    city: "Greeley",
    state: "CO",
    zip: "80631",
    service_needed: "Storm damage inspection",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Sample storm photos and a pretend insurance question. The claim number in this story was never real.",
    urgency: "This week",
    status: "Quoted",
    days_ago: 13,
    hour: 9,
    minute: 25,
    tasks: [
      { title: "Ask Logan Notaperson for the sample claim number", bucket: "overdue", hoursAgo: 12 },
      { title: "Follow up on Logan Notaperson's estimate", bucket: "upcoming", days: 2, hour: 11 },
    ],
  }),
  lead({
    full_name: "Hayden Demo",
    phone: "(555) 010-0116",
    email: "hayden.demo@example.com",
    street: "116 Fictional Parkway",
    city: "Longmont",
    state: "CO",
    zip: "80501",
    service_needed: "Roof inspection / estimate",
    issue_description: "FICTIONAL DEMO — not a real homeowner. Wants two sample inspection times before listing a house that is not for sale.",
    urgency: "This month",
    preferred_contact: "Text",
    status: "New",
    days_ago: 3,
    hour: 15,
    minute: 40,
    tasks: [{ title: "Offer Hayden Demo two inspection times", bucket: "today" }],
  }),
];

function buildSeedSchedule(now = new Date()) {
  return SAMPLE_LEADS.map((spec) => {
    const created_at = createdStamp(now, spec.days_ago, spec.hour, spec.minute);
    const tasks = (spec.tasks || []).map((task) => ({
      title: task.title,
      bucket: task.bucket,
      due_at: dueFor(task, now).toISOString(),
      completed: task.bucket === "done",
    }));
    return { ...spec, created_at, tasks };
  });
}

async function wipeDemoData(client) {
  await client.query("DELETE FROM emails");
  await client.query("DELETE FROM notifications");
  await client.query("DELETE FROM notes");
  await client.query("DELETE FROM tasks");
  await client.query("DELETE FROM lead_photos");
  await client.query("DELETE FROM leads");
}

async function ensureMeta(dbmod) {
  await dbmod.pool.query(
    "CREATE TABLE IF NOT EXISTS demo_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
  );
}

async function insertSampleLead(dbmod, spec) {
  const values = {
    full_name: spec.full_name,
    phone: spec.phone,
    email: spec.email,
    street: spec.street,
    city: spec.city,
    state: spec.state,
    zip: spec.zip,
    property_type: spec.property_type,
    roof_type: spec.roof_type,
    service_needed: spec.service_needed,
    issue_description: spec.issue_description,
    urgency: spec.urgency,
    preferred_contact: spec.preferred_contact,
    status: spec.status,
    created_at: spec.created_at,
  };
  const info = await dbmod.insertLead(dbmod.pool, values);
  const created = new Date(spec.created_at);
  const noteAt = new Date(Math.min(Date.now(), created.getTime() + 60 * 60 * 1000)).toISOString();
  for (const body of spec.notes || []) {
    await dbmod.addNote(dbmod.pool, info.id, body);
  }
  if (spec.notes?.length) {
    await dbmod.pool.query("UPDATE notes SET created_at = $1 WHERE lead_id = $2", [noteAt, info.id]);
  }
  for (const task of spec.tasks || []) {
    await dbmod.insertTask(dbmod.pool, {
      lead_id: info.id,
      title: task.title,
      due_at: task.due_at,
      completed_at: task.completed ? task.due_at : null,
      created_at: spec.created_at,
    });
  }
  if (spec.status === "New") {
    const scored = scoreLead({ ...values, id: info.id });
    await dbmod.insertNotification(dbmod.pool, {
      type: "new_lead",
      title: `New ${scored.priority || "New"} lead: ${spec.full_name}`,
      body: `${spec.full_name} submitted a request. ${scored.category || ""} · score ${scored.score ?? ""}`.replace(/\s+/g, " ").trim(),
      lead_id: info.id,
      created_at: spec.created_at,
    });
  }
  return info.id;
}

async function applySeed(dbmod) {
  const client = await dbmod.pool.connect();
  try {
    await client.query("BEGIN");
    await wipeDemoData(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  const plan = buildSeedSchedule(new Date());
  for (const spec of plan) await insertSampleLead(dbmod, spec);
  return plan.length;
}

async function rememberToken(dbmod, token) {
  await dbmod.pool.query(
    "INSERT INTO demo_meta(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
    [META_KEY, token]
  );
}

async function maybeResetDemoData(dbmod) {
  const token = String(process.env.RESET_DEMO_DATA || "").trim();
  if (!token) return { ran: false, reason: "no-token" };
  await ensureMeta(dbmod);
  const existing = await dbmod.pool.query("SELECT value FROM demo_meta WHERE key = $1", [META_KEY]);
  if (existing.rows[0] && existing.rows[0].value === token) {
    console.log("Demo data already seeded for this reset token; leaving it in place.");
    return { ran: false, reason: "already-applied" };
  }
  const count = await applySeed(dbmod);
  await rememberToken(dbmod, token);
  console.log(`Seeded ${count} fictional demo leads (reset token applied).`);
  return { ran: true, count };
}

function demoReseedEnabled() {
  return String(process.env.ALLOW_DEMO_RESEED || "").trim() === "1";
}

async function reseedDemoData(dbmod) {
  await ensureMeta(dbmod);
  const existing = await dbmod.pool.query("SELECT value FROM demo_meta WHERE key = $1", [META_KEY]);
  const envToken = String(process.env.RESET_DEMO_DATA || "").trim();
  const token = envToken || (existing.rows[0] && existing.rows[0].value) || "manual-reseed";
  const count = await applySeed(dbmod);
  await rememberToken(dbmod, token);
  return { ran: true, count, token };
}

async function main() {
  const dbmod = require("./db-postgres");
  await dbmod.open();
  try {
    const result = await reseedDemoData(dbmod);
    console.log(`Reseeded ${result.count} fictional demo leads. Task dates are relative to now.`);
  } finally {
    await dbmod.pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  maybeResetDemoData,
  reseedDemoData,
  demoReseedEnabled,
  buildSeedSchedule,
  SAMPLE_LEADS,
};
