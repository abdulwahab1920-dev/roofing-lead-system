"use strict";

const multer = require("multer");
const csv = require("./csv");
const demoSeed = require("./demo-seed");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 1024 * 1024 },
});

const MAX_ROWS = 500;

function canon(value, list) {
  const raw = String(value || "").trim();
  const found = (list || []).find((item) => item.toLowerCase() === raw.toLowerCase());
  return found || raw;
}

function resolveStatus(value, statuses) {
  const raw = String(value || "").trim();
  if (!raw) return "New";
  return statuses.find((item) => item.toLowerCase() === raw.toLowerCase()) || "";
}

function prepareBody(data, dbmod) {
  return {
    full_name: data.full_name,
    phone: data.phone,
    email: data.email,
    street: data.street,
    city: data.city,
    state: String(data.state || "").trim().toUpperCase(),
    zip: data.zip,
    property_type: canon(data.property_type, dbmod.PROPERTY_TYPES),
    roof_type: canon(data.roof_type, dbmod.ROOF_TYPES),
    service_needed: canon(data.service_needed, dbmod.SERVICES),
    issue_description: data.issue_description,
    urgency: canon(data.urgency, dbmod.URGENCIES),
    preferred_contact: canon(data.preferred_contact, dbmod.CONTACT_METHODS),
  };
}

function errorText(errors) {
  return Object.values(errors).filter(Boolean).join(" ");
}

function register(app, deps) {
  const { admin, dbmod, views, workflow, scorer, chrome, validate, getDb } = deps;

  function requireReseed(req, res, next) {
    if (!demoSeed.demoReseedEnabled()) return next("route");
    return admin(req, res, next);
  }

  app.get("/admin/reseed", requireReseed, async (req, res, next) => {
    try {
      const done = Number(req.query.done);
      const seeded = Number.isInteger(done) && done >= 0 && done <= 1000 ? done : null;
      res.type("html").send(views.reseedPage({ chrome: await chrome(), seeded }));
    } catch (err) {
      next(err);
    }
  });

  app.post("/admin/reseed", requireReseed, async (req, res, next) => {
    try {
      const confirm = String((req.body && req.body.confirm) || "").trim();
      if (confirm !== "RESEED") {
        res.status(400);
        return res.type("html").send(views.reseedPage({
          chrome: await chrome(),
          error: "Type RESEED in the confirmation box to replace the demo data.",
        }));
      }
      const result = await demoSeed.reseedDemoData(dbmod);
      console.log(`Admin reseeded demo data: ${result.count} fictional leads.`);
      res.redirect("/admin/reseed?done=" + result.count);
    } catch (err) {
      next(err);
    }
  });

  app.get("/admin/import", admin, (req, res) => {
    res.redirect(302, "/admin/leads/import");
  });
  app.get("/admin/export", admin, (req, res) => {
    res.redirect(302, "/admin/leads/export.csv");
  });

  app.get("/admin/leads/new", admin, async (req, res, next) => {
    try {
      res.type("html").send(views.newLeadPage({ chrome: await chrome(), status: "New" }));
    } catch (err) {
      next(err);
    }
  });

  app.post("/admin/leads", admin, async (req, res, next) => {
    try {
      const body = prepareBody(req.body || {}, dbmod);
      const status = resolveStatus(req.body && req.body.status, dbmod.STATUSES);
      const checked = validate(body);
      const errors = { ...checked.errors };
      if (!status) errors.status = "Select a valid status.";
      if (!checked.ok || !status) {
        res.status(400);
        return res.type("html").send(
          views.newLeadPage({
            values: checked.values,
            errors,
            status: status || String((req.body && req.body.status) || ""),
            banner: "Please fix the highlighted fields and try again.",
            chrome: await chrome(),
          })
        );
      }
      const db = getDb();
      const info = await dbmod.insertLead(db, {
        ...checked.values,
        status,
        created_at: new Date().toISOString(),
      });
      let lead = await dbmod.getLead(db, info.id);
      const score = await scorer.scoreLeadMaybeAi(lead);
      await dbmod.saveScore(db, info.id, score);
      lead = await dbmod.getLead(db, info.id);
      await workflow.onNewLead(dbmod, db, lead);
      res.redirect("/admin/leads/" + info.id);
    } catch (err) {
      next(err);
    }
  });

  async function sendExport(req, res, next) {
    try {
      const leads = await dbmod.listLeads(getDb(), "");
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set("Content-Disposition", 'attachment; filename="leads.csv"');
      res.send(csv.toCsv(leads));
    } catch (err) {
      next(err);
    }
  }

  app.get("/admin/leads/export.csv", admin, sendExport);
  app.get("/admin/leads/export", admin, (req, res) => {
    res.redirect(302, "/admin/leads/export.csv");
  });

  app.get("/admin/leads/import", admin, async (req, res, next) => {
    try {
      res.type("html").send(views.importPage({ chrome: await chrome() }));
    } catch (err) {
      next(err);
    }
  });

  app.post("/admin/leads/import", admin, (req, res, next) => {
    upload.single("file")(req, res, async (err) => {
      try {
        const c = await chrome();
        if (err) {
          const message = err.code === "LIMIT_FILE_SIZE"
            ? "CSV must be 1 MB or smaller."
            : "Unable to read the uploaded CSV.";
          return res.status(400).type("html").send(views.importPage({ chrome: c, error: message }));
        }
        if (!req.file) {
          return res.status(400).type("html").send(views.importPage({ chrome: c, error: "Choose a CSV file to import." }));
        }
        if (req.file.buffer.includes(0)) {
          return res.status(400).type("html").send(views.importPage({ chrome: c, error: "That file is not a text CSV." }));
        }
        const parsed = csv.recordsFromCsv(req.file.buffer.toString("utf8"));
        if (parsed.error) {
          return res.status(400).type("html").send(views.importPage({ chrome: c, error: parsed.error }));
        }
        if (!parsed.records.length) {
          return res.status(400).type("html").send(views.importPage({ chrome: c, error: "The CSV has a header but no data rows." }));
        }
        if (parsed.records.length > MAX_ROWS) {
          return res.status(400).type("html").send(views.importPage({
            chrome: c,
            error: `CSV has ${parsed.records.length} data rows. The limit is ${MAX_ROWS}.`,
          }));
        }
        const db = getDb();
        const failures = [];
        const imported = [];
        for (const record of parsed.records) {
          const body = prepareBody(record.data, dbmod);
          const status = resolveStatus(record.data.status, dbmod.STATUSES);
          const checked = validate(body);
          const errors = { ...checked.errors };
          if (!status) errors.status = "Status must be one of: " + dbmod.STATUSES.join(", ") + ".";
          if (!checked.ok || !status) {
            failures.push({ row: record.row, message: errorText(errors) });
            continue;
          }
          try {
            const info = await dbmod.insertLead(db, {
              ...checked.values,
              status,
              created_at: new Date().toISOString(),
            });
            imported.push({ id: info.id, name: checked.values.full_name });
          } catch (rowErr) {
            failures.push({ row: record.row, message: "Could not save this row." });
            console.error("csv import row failed", rowErr);
          }
        }
        res.type("html").send(views.importPage({
          chrome: await chrome(),
          imported,
          failures,
        }));
      } catch (handlerErr) {
        next(handlerErr);
      }
    });
  });
}

module.exports = { register, resolveStatus, prepareBody };
