"use strict";

const { scoreLead } = require("./ai/leadScorer");
const tz = require("./timezone");
const workflow = require("./workflow-postgres");

const META_KEY = "reset_token";

function isoFromDenver(daysAgo, hour, minute = 0) {
  const now = new Date();
  const parts = tz.zoneParts(now, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = tz.fromZone(Number(parts.year), Number(parts.month), Number(parts.day), hour, minute, 0);
  return new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

const SAMPLE_LEADS = [
  {
    full_name: "Priya Raman",
    phone: "(555) 010 2044",
    email: "priya.raman@example.com",
    street: "1847 Steele Street",
    city: "Denver",
    state: "CO",
    zip: "80206",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Leak / emergency repair",
    issue_description: "DEMO SAMPLE (fictional). Water is dripping onto the dining-room ceiling after last night's storm. We put a bucket under it and would like someone out today if possible.",
    urgency: "Emergency — active leak",
    preferred_contact: "Phone",
    status: "New",
    created_days_ago: 0,
    created_hour: 8,
    created_minute: 15,
    notes: ["Demo sample lead — fictional Denver-area homeowner."],
    tasks: [{ title: "Call Priya Raman — Emergency Repair", followup: "Within 15 minutes", overdue: true }],
  },
  {
    full_name: "Marcus Heller",
    phone: "(555) 010 3318",
    email: "marcus.heller@example.com",
    street: "920 Sable Boulevard",
    city: "Aurora",
    state: "CO",
    zip: "80011",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Storm damage inspection",
    issue_description: "DEMO SAMPLE (fictional). Golf-ball hail hit the neighborhood on Saturday. Several shingles are cracked on the south face and the gutters filled with granules. We have not opened an insurance claim yet.",
    urgency: "This week",
    preferred_contact: "Phone",
    status: "Contacted",
    created_days_ago: 2,
    created_hour: 9,
    created_minute: 40,
    notes: [
      "Demo sample lead — fictional.",
      "Left a voicemail and texted a photo checklist for the hail claim.",
    ],
    tasks: [{ title: "Schedule hail inspection — Marcus Heller", due_days_from_now: 1, due_hour: 10, due_minute: 0 }],
  },
  {
    full_name: "Elena Vasquez",
    phone: "(555) 010 4472",
    email: "elena.vasquez@example.com",
    street: "14 Mountain View Road",
    city: "Lakewood",
    state: "CO",
    zip: "80228",
    property_type: "Residential",
    roof_type: "Tile",
    service_needed: "Roof replacement",
    issue_description: "DEMO SAMPLE (fictional). The tile roof is 26 years old. A home inspector flagged cracked tiles and worn underlayment during a refinance. We would like a full replacement quote this month.",
    urgency: "This month",
    preferred_contact: "Email",
    status: "Quoted",
    created_days_ago: 5,
    created_hour: 11,
    created_minute: 5,
    notes: [
      "Demo sample lead — fictional.",
      "Sent a written replacement range and two material options. Waiting on a decision.",
    ],
    tasks: [{ title: "Follow up on replacement quote — Elena Vasquez", due_days_from_now: 2, due_hour: 15, due_minute: 0 }],
  },
  {
    full_name: "James Ortiz",
    phone: "(555) 010 5581",
    email: "james.ortiz@example.com",
    street: "6724 W Long Drive",
    city: "Littleton",
    state: "CO",
    zip: "80123",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Roof repair",
    issue_description: "DEMO SAMPLE (fictional). A cluster of shingles lifted on the back slope after high winds. No interior leak yet, but we want it repaired before the next snow.",
    urgency: "This week",
    preferred_contact: "Text",
    status: "Contacted",
    created_days_ago: 3,
    created_hour: 14,
    created_minute: 20,
    notes: ["Demo sample lead — fictional. Confirmed wind damage photos by text."],
    tasks: [{ title: "Follow up with James Ortiz — Leak Repair", overdue: true, due_hours_ago: 6 }],
  },
  {
    full_name: "Hannah Brooks",
    phone: "(555) 010 6620",
    email: "hannah.brooks@example.com",
    street: "10511 Meadowgrass Circle",
    city: "Highlands Ranch",
    state: "CO",
    zip: "80126",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Roof inspection / estimate",
    issue_description: "DEMO SAMPLE (fictional). Just getting a few estimates before we sell the house next spring. No known leaks. Would like a written inspection summary.",
    urgency: "Just getting estimates",
    preferred_contact: "Email",
    status: "New",
    created_days_ago: 1,
    created_hour: 16,
    created_minute: 45,
    notes: ["Demo sample lead — fictional. Pre-listing inspection request."],
    tasks: [{ title: "Follow up with Hannah Brooks — Inspection", due_days_from_now: 1, due_hour: 11, due_minute: 30 }],
  },
  {
    full_name: "Robert Chen",
    phone: "(555) 010 7735",
    email: "robert.chen@example.com",
    street: "3814 Xavier Street",
    city: "Arvada",
    state: "CO",
    zip: "80003",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Roof replacement",
    issue_description: "DEMO SAMPLE (fictional). Full tear-off and replacement of a 22-square asphalt roof. We already compared two other quotes and accepted the mid-range option.",
    urgency: "This month",
    preferred_contact: "Phone",
    status: "Won",
    created_days_ago: 9,
    created_hour: 10,
    created_minute: 0,
    notes: [
      "Demo sample lead — fictional.",
      "Signed the replacement agreement. Job tentatively set for next week.",
    ],
    tasks: [{ title: "Call Robert Chen — Full Replacement", completed: true, due_hours_after_create: 2 }],
  },
  {
    full_name: "Olivia Grant",
    phone: "(555) 010 8849",
    email: "olivia.grant@example.com",
    street: "11980 Federal Boulevard",
    city: "Westminster",
    state: "CO",
    zip: "80234",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Roof inspection / estimate",
    issue_description: "DEMO SAMPLE (fictional). Shopping around for a second opinion on a small repair. Decided to stay with the original contractor after they lowered the price.",
    urgency: "Just getting estimates",
    preferred_contact: "Email",
    status: "Lost",
    created_days_ago: 10,
    created_hour: 13,
    created_minute: 10,
    notes: [
      "Demo sample lead — fictional.",
      "Homeowner chose to stay with their current contractor. Marked lost.",
    ],
    tasks: [{ title: "Follow up with Olivia Grant — Inspection", completed: true, due_hours_after_create: 24 }],
  },
  {
    full_name: "Northfield Properties",
    phone: "(555) 010 9902",
    email: "facilities@northfield.example.com",
    street: "4550 Wynkoop Street",
    city: "Denver",
    state: "CO",
    zip: "80216",
    property_type: "Commercial",
    roof_type: "Flat",
    service_needed: "Roof repair",
    issue_description: "DEMO SAMPLE (fictional). 18,000 sq ft TPO roof over a warehouse. Property manager reports ponding near two drains and a slow leak above the loading dock. Need a site walk this week.",
    urgency: "This week",
    preferred_contact: "Phone",
    status: "Quoted",
    created_days_ago: 4,
    created_hour: 9,
    created_minute: 0,
    notes: [
      "Demo sample lead — fictional commercial account.",
      "Site walk completed. Sent a drain repair and coating proposal.",
    ],
    tasks: [{ title: "Call the property contact today — Commercial Project", due_days_from_now: 3, due_hour: 9, due_minute: 30 }],
  },
  {
    full_name: "Danielle Porter",
    phone: "(555) 010 1166",
    email: "danielle.porter@example.com",
    street: "7429 E Dry Creek Place",
    city: "Centennial",
    state: "CO",
    zip: "80112",
    property_type: "Residential",
    roof_type: "Asphalt shingle",
    service_needed: "Gutter installation or repair",
    issue_description: "DEMO SAMPLE (fictional). Gutters pulled away from the fascia on the garage side and overflow during heavy rain. Would like them re-secured or replaced, plus a downspout cleanup.",
    urgency: "This month",
    preferred_contact: "Phone",
    status: "Contacted",
    created_days_ago: 6,
    created_hour: 15,
    created_minute: 30,
    notes: ["Demo sample lead — fictional. Quoted a gutter reset and two new downspouts."],
    tasks: [{ title: "Follow up with Danielle Porter — Maintenance", due_days_from_now: 2, due_hour: 14, due_minute: 0 }],
  },
];

async function wipeDemoData(client) {
  await client.query("DELETE FROM emails");
  await client.query("DELETE FROM notifications");
  await client.query("DELETE FROM notes");
  await client.query("DELETE FROM tasks");
  await client.query("DELETE FROM lead_photos");
  await client.query("DELETE FROM leads");
}

async function insertSampleLead(dbmod, db, spec) {
  const createdAt = isoFromDenver(spec.created_days_ago, spec.created_hour, spec.created_minute);
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
    created_at: createdAt,
  };
  const info = await dbmod.insertLead(db, values);
  const lead = await dbmod.getLead(db, info.id);
  const score = scoreLead(lead);
  await dbmod.saveScore(db, info.id, score);
  const scored = await dbmod.getLead(db, info.id);

  for (const body of spec.notes || []) {
    await dbmod.addNote(db, info.id, body);
    // addNote uses now(); reset the timestamp to sit after the lead was created.
  }
  if (spec.notes?.length) {
    await dbmod.pool.query(
      "UPDATE notes SET created_at = $1 WHERE lead_id = $2",
      [new Date(new Date(createdAt).getTime() + 60 * 60 * 1000).toISOString(), info.id]
    );
  }

  for (const task of spec.tasks || []) {
    let dueAt;
    if (task.overdue && task.due_hours_ago) {
      dueAt = new Date(Date.now() - task.due_hours_ago * 3600000).toISOString();
    } else if (task.overdue) {
      dueAt = new Date(new Date(createdAt).getTime() + 15 * 60 * 1000).toISOString();
    } else if (typeof task.due_days_from_now === "number") {
      dueAt = isoFromDenver(-task.due_days_from_now, task.due_hour || 10, task.due_minute || 0);
    } else if (typeof task.due_hours_after_create === "number") {
      dueAt = new Date(new Date(createdAt).getTime() + task.due_hours_after_create * 3600000).toISOString();
    } else {
      dueAt = workflow.dueFromFollowup
        ? workflow.dueFromFollowup(task.followup || scored.ai_followup, createdAt).toISOString()
        : new Date(new Date(createdAt).getTime() + 86400000).toISOString();
    }
    // dueFromFollowup may not be exported from workflow-postgres; compute locally if needed.
    await dbmod.insertTask(db, {
      lead_id: info.id,
      title: task.title,
      due_at: dueAt,
      created_at: createdAt,
    });
    if (task.completed) {
      await dbmod.pool.query(
        "UPDATE tasks SET completed_at = $1 WHERE lead_id = $2 AND title = $3",
        [dueAt, info.id, task.title]
      );
    }
  }

  if (spec.status === "New") {
    const title = `New ${scored.ai_priority || "New"} lead: ${spec.full_name}`;
    const body = `${spec.full_name} submitted a request. ${scored.ai_category || ""} · score ${scored.ai_score ?? ""}`.replace(/\s+/g, " ").trim();
    await dbmod.insertNotification(db, {
      type: "new_lead",
      title,
      body,
      lead_id: info.id,
      created_at: createdAt,
    });
  }
}

async function maybeResetDemoData(dbmod) {
  const token = String(process.env.RESET_DEMO_DATA || "").trim();
  if (!token) return { ran: false, reason: "no-token" };

  await dbmod.pool.query(
    "CREATE TABLE IF NOT EXISTS demo_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
  );
  const existing = await dbmod.pool.query("SELECT value FROM demo_meta WHERE key = $1", [META_KEY]);
  if (existing.rows[0] && existing.rows[0].value === token) {
    console.log("Demo data already seeded for this reset token; leaving it in place.");
    return { ran: false, reason: "already-applied" };
  }

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

  for (const spec of SAMPLE_LEADS) {
    await insertSampleLead(dbmod, dbmod.pool, spec);
  }

  await dbmod.pool.query(
    "INSERT INTO demo_meta(key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
    [META_KEY, token]
  );
  console.log(`Seeded ${SAMPLE_LEADS.length} fictional demo leads (reset token applied).`);
  return { ran: true, count: SAMPLE_LEADS.length };
}

module.exports = {
  maybeResetDemoData,
  SAMPLE_LEADS,
};
