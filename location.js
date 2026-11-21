"use strict";

const NON_US_CITIES = new Set([
  "karachi", "lahore", "islamabad", "rawalpindi", "peshawar", "quetta",
  "faisalabad", "multan", "hyderabad", "london", "manchester", "birmingham",
  "paris", "toronto", "vancouver", "montreal", "ottawa", "mumbai", "delhi",
  "new delhi", "bangalore", "bengaluru", "dubai", "abu dhabi", "sydney",
  "melbourne", "auckland", "mexico city", "lagos", "nairobi", "cairo",
  "tokyo", "seoul", "beijing", "shanghai", "singapore", "hong kong",
  "istanbul", "moscow", "berlin", "madrid", "rome", "dublin", "glasgow",
  "edinburgh", "lisbon", "amsterdam", "brussels",
]);

// First-three-digit ZIP ranges by US state / DC. Used only as a sanity check.
const ZIP_RANGES = {
  AL: [["350", "369"]], AK: [["995", "999"]], AZ: [["850", "865"]], AR: [["716", "729"]],
  CA: [["900", "961"]], CO: [["800", "816"]], CT: [["060", "069"]], DE: [["197", "199"]],
  DC: [["200", "205"]], FL: [["320", "349"]], GA: [["300", "319"], ["398", "399"]],
  HI: [["967", "968"]], ID: [["832", "838"]], IL: [["600", "629"]], IN: [["460", "479"]],
  IA: [["500", "528"]], KS: [["660", "679"]], KY: [["400", "427"]], LA: [["700", "714"]],
  ME: [["039", "049"]], MD: [["206", "219"]], MA: [["010", "027"], ["055", "055"]],
  MI: [["480", "499"]], MN: [["550", "567"]], MS: [["386", "397"]], MO: [["630", "658"]],
  MT: [["590", "599"]], NE: [["680", "693"]], NV: [["889", "898"]], NH: [["030", "038"]],
  NJ: [["070", "089"]], NM: [["870", "884"]], NY: [["100", "149"], ["005", "005"]],
  NC: [["270", "289"]], ND: [["580", "588"]], OH: [["430", "459"]], OK: [["730", "749"]],
  OR: [["970", "979"]], PA: [["150", "196"]], RI: [["028", "029"]], SC: [["290", "299"]],
  SD: [["570", "577"]], TN: [["370", "385"]], TX: [["733", "733"], ["750", "799"], ["885", "885"]],
  UT: [["840", "847"]], VT: [["050", "059"]], VA: [["201", "201"], ["220", "246"]],
  WA: [["980", "994"]], WV: [["247", "268"]], WI: [["530", "549"]], WY: [["820", "831"]],
};

function normalizeCity(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function zipPrefix(zip) {
  const digits = String(zip || "").replace(/\D/g, "");
  if (digits.length < 5) return "";
  return digits.slice(0, 3);
}

function zipMatchesState(zip, state) {
  const prefix = zipPrefix(zip);
  const ranges = ZIP_RANGES[String(state || "").toUpperCase()];
  if (!prefix || !ranges) return null;
  return ranges.some(([start, end]) => prefix >= start && prefix <= end);
}

function isKnownNonUsCity(city) {
  const name = normalizeCity(city);
  if (!name) return false;
  if (NON_US_CITIES.has(name)) return true;
  for (const known of NON_US_CITIES) {
    if (name === known || name.startsWith(known + " ") || name.endsWith(" " + known) || name.includes(" " + known + " ")) {
      return true;
    }
  }
  return false;
}

function isPlausibleUsLocation(city, state, zip) {
  if (isKnownNonUsCity(city)) return false;
  const match = zipMatchesState(zip, state);
  if (match === false) return false;
  return true;
}

function formatLeadLocation(lead) {
  const city = String(lead?.city || "").trim();
  const state = String(lead?.state || "").trim().toUpperCase();
  if (!isPlausibleUsLocation(city, state, lead?.zip)) return "";
  return [city, state].filter(Boolean).join(", ");
}

module.exports = {
  formatLeadLocation,
  isPlausibleUsLocation,
  isKnownNonUsCity,
  zipMatchesState,
};
