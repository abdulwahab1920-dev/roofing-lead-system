"use strict";

const CATEGORIES = [
  "Emergency Repair",
  "Leak Repair",
  "Full Replacement",
  "Inspection",
  "Insurance Claim",
  "Maintenance",
  "Commercial Project",
  "Other",
];

const PRIORITIES = ["Hot", "Warm", "Cold"];

const REGION_MULT = {
  CA: 1.22, NY: 1.2, HI: 1.28, AK: 1.2, MA: 1.18, NJ: 1.16, CT: 1.15,
  WA: 1.14, CO: 1.12, OR: 1.1, IL: 1.08, MD: 1.1, VA: 1.08, DC: 1.16,
  FL: 1.08, TX: 1.05, AZ: 1.06, NV: 1.06, GA: 1.02, NC: 1.02,
  AL: 0.9, MS: 0.88, AR: 0.9, OK: 0.92, KY: 0.92, WV: 0.9, IA: 0.95,
  KS: 0.95, NE: 0.95, MO: 0.96, IN: 0.96, OH: 0.98, TN: 0.98, SC: 0.98,
};

function textOf(lead) {
  return [
    lead.service_needed,
    lead.urgency,
    lead.issue_description,
    lead.roof_type,
    lead.property_type,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" \n ");
}

function has(text, re) {
  return re.test(text);
}

function countMatches(text, patterns) {
  let n = 0;
  for (const re of patterns) {
    if (re.test(text)) n += 1;
  }
  return n;
}

function categorize(lead, text) {
  const weights = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const service = String(lead.service_needed || "");
  const urgency = String(lead.urgency || "");
  const isCommercial = String(lead.property_type || "") === "Commercial";

  if (urgency.startsWith("Emergency")) weights["Emergency Repair"] += 6;
  if (service === "Leak / emergency repair") {
    weights["Emergency Repair"] += urgency.startsWith("Emergency") ? 5 : 2;
    weights["Leak Repair"] += 4;
  }
  if (service === "Roof replacement" || service === "New construction") {
    weights["Full Replacement"] += 6;
  }
  if (service === "Storm damage inspection" || service === "Roof inspection / estimate") {
    weights["Inspection"] += 5;
  }
  if (service === "Gutter installation or repair") weights["Maintenance"] += 6;
  if (service === "Roof repair") {
    weights["Leak Repair"] += 2;
    weights["Maintenance"] += 1;
  }
  if (isCommercial) weights["Commercial Project"] += 5;

  weights["Emergency Repair"] += 3 * countMatches(text, [
    /\bemergenc(y|ies)\b/,
    /\b(active leak|leaking now|water (is )?(coming|pouring|running) in)\b/,
    /\b(flooding|ceiling (is )?(wet|stained|collaps)|needs? a tarp|tarping)\b/,
    /\b(asap|right away|tonight|can't wait|cannot wait)\b/,
  ]);
  weights["Leak Repair"] += 3 * countMatches(text, [
    /\bleak(ing|s)?\b/,
    /\b(drip|dripping|slow drip|water stain|wet attic|damp)\b/,
    /\bice dam(ming)?\b/,
  ]);
  weights["Insurance Claim"] += 4 * countMatches(text, [
    /\binsurance\b/,
    /\b(adjuster|filed a claim|claim number|homeowner'?s policy)\b/,
    /\binsurance (company|claim|adjuster)\b/,
  ]);
  weights["Full Replacement"] += 3 * countMatches(text, [
    /\breplac(e|ement|ing)\b/,
    /\btear-?off\b/,
    /\b(new roof|full (roof )?replace|end of life)\b/,
    /\b\d{2}[ -]?year-?old\b/,
  ]);
  weights["Inspection"] += 2 * countMatches(text, [
    /\binspect(ion|or|ing)?\b/,
    /\b(estimate|second opinion|ballpark|getting quotes?)\b/,
    /\b(buying|closing|home inspector)\b/,
  ]);
  weights["Maintenance"] += 3 * countMatches(text, [
    /\b(gutter|fascia|maintenance|routine|slipped tiles?|pulled away)\b/,
  ]);
  weights["Commercial Project"] += 3 * countMatches(text, [
    /\b(commercial|office building|warehouse|property manager|tpo|epdm|built-up)\b/,
    /\b\d{1,3}(?:,\d{3})+\s*(?:sq\.?\s*ft|square feet)\b/,
  ]);

  // Storm/hail often precedes an insurance claim, but only tip it when
  // insurance language is already present; otherwise leave it as inspection/repair.
  if (has(text, /\b(hail|hurricane|windstorm|tropical storm|storm damage)\b/) && weights["Insurance Claim"] >= 4) {
    weights["Insurance Claim"] += 2;
  }

  let category = "Other";
  let best = 0;
  for (const name of CATEGORIES) {
    if (weights[name] > best) {
      best = weights[name];
      category = name;
    }
  }
  // A commercial property with only a mild commercial signal and a much
  // stronger job-type signal should keep the job type (e.g. emergency leak).
  if (category === "Other" && best === 0) {
    if (isCommercial) category = "Commercial Project";
    else if (service === "Roof repair") category = "Leak Repair";
  }
  return category;
}

function extractSquares(text) {
  const sqft = text.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*(?:sq\.?\s*ft|square feet|sqft|sf)\b/i);
  if (sqft) return Number(sqft[1].replace(/,/g, "")) / 100;
  const squares = text.match(/(\d+(?:\.\d+)?)\s*squares?\b/i);
  if (squares) return Number(squares[1]);
  return null;
}

function moneyRange(lead, category, text) {
  const isCommercial = String(lead.property_type || "") === "Commercial";
  const roof = String(lead.roof_type || "");
  const mult = REGION_MULT[String(lead.state || "").toUpperCase()] || 1;
  const squares = extractSquares(text);

  // Mid-market installed ranges, 2026 US ballparks, then regional multiplier.
  let low;
  let high;
  if (category === "Inspection") {
    low = 0;
    high = 450;
  } else if (category === "Maintenance") {
    low = isCommercial ? 2000 : 800;
    high = isCommercial ? 9000 : 3500;
  } else if (category === "Emergency Repair") {
    low = isCommercial ? 1500 : 500;
    high = isCommercial ? 8000 : 2800;
  } else if (category === "Leak Repair") {
    low = isCommercial ? 2500 : 800;
    high = isCommercial ? 18000 : 4500;
  } else if (category === "Full Replacement" || category === "Insurance Claim" || category === "Commercial Project") {
    const sq = squares || (isCommercial ? 80 : 22);
    let perLow = 450;
    let perHigh = 750;
    if (roof === "Metal") {
      perLow = 700;
      perHigh = 1200;
    } else if (roof === "Tile") {
      perLow = 800;
      perHigh = 1500;
    } else if (roof === "Flat") {
      perLow = 500;
      perHigh = 950;
    }
    if (isCommercial && roof !== "Tile" && roof !== "Metal") {
      perLow = 450;
      perHigh = 900;
    }
    if (category === "Insurance Claim" && String(lead.service_needed || "").includes("inspection") && !/replac/i.test(text)) {
      // Storm inspection that may become a claim — use a repair-to-partial-replace band.
      low = Math.round(sq * 80);
      high = Math.round(sq * 400);
    } else {
      low = Math.round(sq * perLow);
      high = Math.round(sq * perHigh);
    }
  } else {
    low = isCommercial ? 2000 : 600;
    high = isCommercial ? 12000 : 5000;
  }

  low = Math.round(low * mult);
  high = Math.round(high * mult);
  if (high < low) high = low;
  return { low, high };
}

function computeScore(lead, category, text) {
  let score = 20;
  const urgency = String(lead.urgency || "");
  if (urgency.startsWith("Emergency")) score += 40;
  else if (urgency === "This week") score += 28;
  else if (urgency === "This month") score += 16;
  else if (urgency === "Planning — 1 to 3 months") score += 8;
  else if (urgency === "Just getting estimates") score += 4;

  const catBoost = {
    "Emergency Repair": 18,
    "Leak Repair": 12,
    "Insurance Claim": 14,
    "Full Replacement": 10,
    "Commercial Project": 12,
    Inspection: 6,
    Maintenance: 5,
    Other: 2,
  };
  score += catBoost[category] || 0;

  if (has(text, /\b(active leak|leaking now|water (is )?(coming|pouring) in|flooding)\b/)) score += 12;
  if (has(text, /\b(hail|hurricane|windstorm|tropical storm|storm damage|ice dam)\b/)) score += 8;
  if (has(text, /\binsurance|adjuster\b/)) score += 6;
  if (has(text, /\b(buying|closing|before closing|under contract)\b/)) score += 8;
  if (String(lead.property_type || "") === "Commercial") score += 6;
  if (String(lead.preferred_contact || "") === "Phone") score += 2;
  if ((lead.issue_description || "").trim().length > 80) score += 3;
  if (has(text, /\b(just looking|only looking|shopping around|not in a hurry)\b/)) score -= 8;
  if (urgency === "Just getting estimates" && category === "Inspection") score -= 2;

  score = Math.max(0, Math.min(100, Math.round(score)));
  return score;
}

function priorityFor(score, lead, category) {
  const urgency = String(lead.urgency || "");
  if (urgency.startsWith("Emergency") || category === "Emergency Repair" || score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  return "Cold";
}

function nextAction(lead, category, priority) {
  const method = String(lead.preferred_contact || "Phone").toLowerCase();
  const name = lead.full_name ? ` ${String(lead.full_name).split(" ")[0]}` : "";

  if (priority === "Hot" && (category === "Emergency Repair" || String(lead.urgency || "").startsWith("Emergency"))) {
    return {
      followup: "Within 15 minutes",
      next_action: `Call${name} within 15 minutes. Confirm whether water is still entering the building and offer same-day tarping or a leak-stop visit.`,
    };
  }
  if (category === "Insurance Claim") {
    return {
      followup: "Within 2 hours",
      next_action: `Call${name} today (within 2 hours). Ask whether an insurance claim has been opened and if an adjuster has been assigned, then schedule an inspection.`,
    };
  }
  if (priority === "Hot" || String(lead.urgency || "") === "This week") {
    return {
      followup: "Within 2 hours",
      next_action: `Reach out by ${method} within 2 hours and offer an inspection window in the next 24–48 hours.`,
    };
  }
  if (category === "Commercial Project") {
    return {
      followup: "Same business day",
      next_action: `Call the property contact today. Confirm building size, roof access, and whether a site walk can be scheduled this week.`,
    };
  }
  if (priority === "Warm") {
    return {
      followup: "Within 1 business day",
      next_action: `Follow up by ${method} within 1 business day. Set a measure or inspection appointment and be ready with a ballpark range.`,
    };
  }
  return {
    followup: "Within 2 business days",
    next_action: `Send a short email within 2 business days introducing Summit Ridge and offering a convenient inspection time.`,
  };
}

function formatMoney(n) {
  return "$" + Number(n).toLocaleString("en-US");
}

function buildSummary(lead, category, priority, range) {
  const where = [lead.city, lead.state].filter(Boolean).join(", ") || "an unspecified city";
  const prop = String(lead.property_type || "residential").toLowerCase();
  const roof = String(lead.roof_type || "roof").toLowerCase();
  const issue = String(lead.issue_description || "").replace(/\s+/g, " ").trim();
  const snippet = issue.length > 180 ? issue.slice(0, 177).replace(/\s+\S*$/, "") + "…" : issue;
  const value = `${formatMoney(range.low)}–${formatMoney(range.high)}`;
  const urgency = String(lead.urgency || "an unspecified timeline").toLowerCase();

  const sentence1 = `${lead.full_name || "This lead"} in ${where} is a ${prop} ${roof} ${category.toLowerCase()} inquiry (${urgency}).`;
  const sentence2 = snippet
    ? `The homeowner reports: ${snippet}`
    : `Little detail was provided beyond the requested service.`;
  const sentence3 = `Priority is ${priority}. Estimated job value is ${value}.`;
  return `${sentence1} ${sentence2} ${sentence3}`;
}

function scoreLead(lead) {
  const text = textOf(lead);
  const category = categorize(lead, text);
  const range = moneyRange(lead, category, text);
  let score = computeScore(lead, category, text);
  if (range.high >= 15000) score = Math.min(100, score + 6);
  if (category === "Full Replacement" && !String(lead.urgency || "").startsWith("Just")) {
    score = Math.min(100, score + 6);
  }
  const priority = priorityFor(score, lead, category);
  const action = nextAction(lead, category, priority);
  return {
    category,
    priority,
    score,
    value_low: range.low,
    value_high: range.high,
    next_action: action.next_action,
    followup: action.followup,
    summary: buildSummary(lead, category, priority, range),
    scored_at: new Date().toISOString(),
    source: "heuristic",
  };
}

function clampScore(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mergeAiResult(base, parsed) {
  const category = CATEGORIES.includes(parsed.category) ? parsed.category : base.category;
  const score = clampScore(parsed.score, base.score);
  let priority = PRIORITIES.includes(parsed.priority) ? parsed.priority : priorityFor(score, {}, category);
  if (category === "Emergency Repair" && priority !== "Hot") priority = "Hot";
  const value_low = Number.isFinite(Number(parsed.value_low)) ? Math.max(0, Math.round(Number(parsed.value_low))) : base.value_low;
  const value_high = Number.isFinite(Number(parsed.value_high)) ? Math.max(value_low, Math.round(Number(parsed.value_high))) : base.value_high;
  return {
    category,
    priority,
    score,
    value_low,
    value_high,
    next_action: String(parsed.next_action || base.next_action).trim().slice(0, 500),
    followup: String(parsed.followup || base.followup).trim().slice(0, 80),
    summary: String(parsed.summary || base.summary).trim().slice(0, 1200),
    scored_at: new Date().toISOString(),
    source: "openai",
  };
}

async function enhanceWithOpenAI(lead, base) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return base;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You score US roofing leads. Return JSON with keys: category, priority, score, value_low, value_high, next_action, followup, summary. category must be one of: " +
              CATEGORIES.join(", ") +
              ". priority must be Hot, Warm, or Cold. score is 0-100. value_low/value_high are USD integers using 2026 US roofing ballparks. summary is 2-3 sentences for a sales rep.",
          },
          {
            role: "user",
            content: JSON.stringify({ lead, heuristic: base }),
          },
        ],
      }),
    });
    if (!res.ok) return base;
    const data = await res.json();
    const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!raw) return base;
    return mergeAiResult(base, JSON.parse(raw));
  } catch (_) {
    return { ...base, source: "heuristic-fallback" };
  } finally {
    clearTimeout(timer);
  }
}

async function scoreLeadMaybeAi(lead) {
  const base = scoreLead(lead);
  if (!process.env.OPENAI_API_KEY) return base;
  return enhanceWithOpenAI(lead, base);
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  scoreLead,
  scoreLeadMaybeAi,
  formatMoney,
};
