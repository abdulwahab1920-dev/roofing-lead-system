"use strict";

const DEMO_MODE = process.env.DEMO_MODE !== "false";

function env(name, fallback = "") {
  const value = String(process.env[name] ?? "").trim();
  return value || fallback;
}

const COMPANY_NAME = env("COMPANY_NAME", "Artific Creations Demo");
const COMPANY_PHONE = DEMO_MODE
  ? env("DEMO_COMPANY_PHONE", env("COMPANY_PHONE"))
  : env("COMPANY_PHONE");
const COMPANY_LOCATION = DEMO_MODE
  ? env("DEMO_COMPANY_LOCATION", env("COMPANY_LOCATION", "Denver, Colorado"))
  : env("COMPANY_LOCATION");
const SERVICE_AREA = DEMO_MODE
  ? env("DEMO_SERVICE_AREA", env("SERVICE_AREA", "Denver Metro"))
  : env("SERVICE_AREA", "Your local service area");

module.exports = {
  DEMO_MODE,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_LOCATION,
  SERVICE_AREA,
};
