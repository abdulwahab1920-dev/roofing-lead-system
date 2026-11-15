"use strict";

const DEFAULT_TIMEZONE = "America/Denver";

function isValidTimeZone(zone) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveTimeZone(value) {
  const zone = String(value || "").trim() || DEFAULT_TIMEZONE;
  if (isValidTimeZone(zone)) return zone;
  console.warn(`Invalid APP_TIMEZONE "${zone}". Falling back to ${DEFAULT_TIMEZONE}.`);
  return DEFAULT_TIMEZONE;
}

const APP_TIMEZONE = resolveTimeZone(process.env.APP_TIMEZONE);

function zoneParts(date, options) {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, ...options }).formatToParts(date)) {
    p[x.type] = x.value;
  }
  return p;
}

const FIXED_ABBR = {
  "Asia/Karachi": "PKT",
  "Asia/Kolkata": "IST",
  "Asia/Dubai": "GST",
};

function timeZoneAbbr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const short = zoneParts(d, { timeZoneName: "short" }).timeZoneName || "";
  if (/^[A-Z]{2,5}$/.test(short)) return short;
  if (FIXED_ABBR[APP_TIMEZONE]) return FIXED_ABBR[APP_TIMEZONE];
  return short || APP_TIMEZONE;
}

function fromZone(year, month, day, hour = 0, minute = 0, second = 0) {
  const g = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const p = zoneParts(g, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(g.getTime() - (asUtc - g.getTime()));
}

function ymd(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const p = zoneParts(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

module.exports = {
  APP_TIMEZONE,
  DEFAULT_TIMEZONE,
  timeZoneAbbr,
  zoneParts,
  fromZone,
  ymd,
};
