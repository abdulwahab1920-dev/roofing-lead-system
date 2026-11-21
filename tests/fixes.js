"use strict";

const assert = require("node:assert/strict");
const { safeAdminNext, safeAdminReferer } = require("../safe-next");
const { toCsv, recordsFromCsv, COLUMNS } = require("../csv");
const { notFoundPage } = require("../views");
const { buildSeedSchedule, demoReseedEnabled } = require("../demo-seed");
const { scoreLead } = require("../ai/leadScorer");
const { isPlausibleUsLocation } = require("../location");
const tz = require("../timezone");

function classify(task, now) {
  if (task.completed) return "done";
  const due = new Date(task.due_at).getTime();
  if (!(due >= now.getTime())) return "overdue";
  if (tz.ymd(due) === tz.ymd(now)) return "today";
  return "upcoming";
}

assert.equal(safeAdminNext("/admin"), "/admin");
assert.equal(safeAdminNext("/admin/leads/new"), "/admin/leads/new");
assert.equal(safeAdminNext("/admin/leads/new?x=1"), "/admin/leads/new?x=1");
assert.equal(safeAdminNext("  /admin/tasks  "), "/admin/tasks");
assert.equal(safeAdminNext("https://evil.example/admin"), "");
assert.equal(safeAdminNext("http://evil.example/admin"), "");
assert.equal(safeAdminNext("//evil.example"), "");
assert.equal(safeAdminNext("//evil.example/admin"), "");
assert.equal(safeAdminNext("///evil.example"), "");
assert.equal(safeAdminNext("/\\evil.example"), "");
assert.equal(safeAdminNext("/admin\\\\@evil.example"), "");
assert.equal(safeAdminNext("/admin.evil.example"), "");
assert.equal(safeAdminNext("/administrator"), "");
assert.equal(safeAdminNext("/admin/%2f%2fevil.example"), "");
assert.equal(safeAdminNext("/admin/%252f%252fevil.example"), "");
assert.equal(safeAdminNext("javascript:alert(1)"), "");
assert.equal(safeAdminNext("/admin/leads\nSet-Cookie: a"), "");
assert.equal(safeAdminNext(""), "");
assert.equal(safeAdminNext(["/admin"]), "");
assert.equal(safeAdminReferer("https://evil.example/admin/leads?x=1"), "/admin/leads?x=1");
assert.equal(safeAdminReferer("https://evil.example/steal"), "");
assert.equal(safeAdminReferer("https://evil.example//admin"), "");

const tricky = {
  full_name: 'Ada, "Demo"\r\nLead',
  phone: "(555) 010-0198",
  email: "ada.demo@example.com",
  street: "100 Demo Lane",
  city: "Denver",
  state: "CO",
  zip: "80202",
  property_type: "Residential",
  roof_type: "Asphalt shingle",
  service_needed: "Roof repair",
  issue_description: "Quote, \"plus\"\nsecond line",
  urgency: "This week",
  preferred_contact: "Phone",
  status: "New",
};
const csvText = toCsv([tricky, { full_name: "Plain", status: "Cold" }]);
assert.ok(csvText.startsWith(COLUMNS.join(",") + "\r\n"));
assert.match(csvText, /"Ada, ""Demo""\r\nLead"/);
assert.match(csvText, /"Quote, ""plus""\nsecond line"/);
const roundTrip = recordsFromCsv("\uFEFF" + csvText);
assert.equal(roundTrip.error, undefined);
assert.equal(roundTrip.records[0].row, 2);
assert.equal(roundTrip.records[0].data.full_name, tricky.full_name);
assert.equal(roundTrip.records[0].data.issue_description, tricky.issue_description);
assert.equal(roundTrip.records[1].data.full_name, "Plain");
assert.equal(roundTrip.records[1].data.status, "Cold");
assert.equal(recordsFromCsv("").error, "The CSV is empty.");
assert.match(recordsFromCsv("name,phone\nA,1\n").error, /Missing columns/);

const public404 = notFoundPage();
assert.match(public404, /Back to the inspection form/);
assert.match(public404, /href="\/"/);
assert.doesNotMatch(public404, /Back to the dashboard/);
const admin404 = notFoundPage({ admin: true });
assert.match(admin404, /Back to the dashboard/);
assert.match(admin404, /href="\/admin"/);
assert.doesNotMatch(admin404, /inspection form/);

const now = new Date("2026-11-21T18:00:00.000Z");
const plan = buildSeedSchedule(now);
const counts = { overdue: 0, today: 0, upcoming: 0, done: 0 };
let taskCount = 0;
for (const lead of plan) {
  assert.match(lead.email, /@example\.com$/i, lead.full_name);
  assert.match(lead.phone, /555/, lead.full_name);
  assert.match(lead.issue_description, /FICTIONAL DEMO/, lead.full_name);
  assert.equal(isPlausibleUsLocation(lead.city, lead.state, lead.zip), true, lead.full_name);
  assert.ok(new Date(lead.created_at).getTime() < now.getTime(), lead.full_name);
  for (const task of lead.tasks) {
    taskCount += 1;
    const kind = classify(task, now);
    assert.equal(kind, task.bucket, task.title + " classified as " + kind);
    counts[kind] += 1;
  }
}
for (const key of Object.keys(counts)) assert.ok(counts[key] > 0, "expected some " + key + " tasks");
assert.ok(taskCount >= 16, "expected a full demo task list");
assert.ok(counts.overdue < taskCount, "seed tasks should not all be overdue");
const statuses = new Set(plan.map((lead) => lead.status));
for (const status of ["New", "Contacted", "Quoted", "Won", "Lost", "Cold"]) {
  assert.ok(statuses.has(status), "missing status " + status);
}
const ages = plan.map((lead) => (now - new Date(lead.created_at)) / 86400000);
assert.ok(Math.max(...ages) >= 14, "leads should span recent weeks");
assert.ok(plan.some((lead) => now - new Date(lead.created_at) < 36 * 3600000), "some leads should be from today");
for (const lead of plan.filter((item) => item.status === "Cold")) {
  assert.equal(scoreLead(lead).priority, "Cold", lead.full_name + " should score Cold");
}

const previousFlag = process.env.ALLOW_DEMO_RESEED;
delete process.env.ALLOW_DEMO_RESEED;
assert.equal(demoReseedEnabled(), false);
process.env.ALLOW_DEMO_RESEED = "true";
assert.equal(demoReseedEnabled(), false);
process.env.ALLOW_DEMO_RESEED = " 1 ";
assert.equal(demoReseedEnabled(), true);
if (previousFlag == null) delete process.env.ALLOW_DEMO_RESEED;
else process.env.ALLOW_DEMO_RESEED = previousFlag;

console.log("Fix tests passed: safe next, CSV escaping, admin 404 copy, relative demo schedule, and reseed flag.");
