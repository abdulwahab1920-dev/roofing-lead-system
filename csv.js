"use strict";

const COLUMNS = [
  "full_name",
  "phone",
  "email",
  "street",
  "city",
  "state",
  "zip",
  "property_type",
  "roof_type",
  "service_needed",
  "issue_description",
  "urgency",
  "preferred_contact",
  "status",
];

function escapeCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(leads) {
  const lines = [COLUMNS.join(",")];
  for (const lead of leads || []) {
    lines.push(COLUMNS.map((key) => escapeCell(lead[key])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

function parseCsv(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  }
  return rows;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function recordsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { error: "The CSV is empty.", records: [] };
  const header = rows[0].map(normalizeHeader);
  const index = new Map();
  header.forEach((name, position) => {
    if (name && !index.has(name)) index.set(name, position);
  });
  const required = COLUMNS.filter((name) => name !== "status" && name !== "issue_description");
  const missing = required.filter((name) => !index.has(name));
  if (missing.length) {
    return { error: "Missing columns: " + missing.join(", ") + ".", records: [] };
  }
  const records = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    const data = {};
    for (const name of COLUMNS) {
      const at = index.get(name);
      data[name] = at == null ? "" : String(cells[at] ?? "").trim();
    }
    records.push({ row: r + 1, data });
  }
  return { records };
}

module.exports = { COLUMNS, escapeCell, toCsv, parseCsv, recordsFromCsv };
