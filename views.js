const {
  STATUSES,
  PROPERTY_TYPES,
  ROOF_TYPES,
  SERVICES,
  URGENCIES,
  CONTACT_METHODS,
  US_STATES,
} = require("./db");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatDateShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function stateName(code) {
  const found = US_STATES.find(([c]) => c === code);
  return found ? found[1] : code;
}

function layout({ title, body, admin = false }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="${admin ? "admin" : "public"}">
  ${body}
</body>
</html>`;
}

function logoMark() {
  return `<span class="logo">
    <svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 18 L16 7 L28 18 V26 H4 Z" fill="currentColor" opacity="0.18"/>
      <path d="M4 18 L16 7 L28 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M10 26 V16.5 L16 11.5 L22 16.5 V26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
    </svg>
    <span class="logo-text">
      <strong>Summit Ridge</strong>
      <span>Roofing</span>
    </span>
  </span>`;
}

function publicFooter() {
  return `<footer class="site-footer">
    <p>© 2026 Summit Ridge Roofing · Licensed &amp; insured · Denver, Colorado</p>
    <p class="powered">Powered by Artific Creations</p>
  </footer>`;
}

function options(list, selected) {
  return list
    .map((item) => {
      const value = Array.isArray(item) ? item[0] : item;
      const label = Array.isArray(item) ? item[1] : item;
      const sel = String(selected || "") === String(value) ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function fieldError(errors, name) {
  if (!errors || !errors[name]) return "";
  return `<p class="field-error">${escapeHtml(errors[name])}</p>`;
}

function formPage({ values = {}, errors = {}, banner } = {}) {
  const v = (name) => escapeHtml(values[name] || "");
  const invalid = (name) => (errors[name] ? " invalid" : "");
  const bannerHtml = banner
    ? `<div class="banner error">${escapeHtml(banner)}</div>`
    : "";

  const body = `
  <header class="site-header">
    <div class="wrap header-inner">
      ${logoMark()}
      <div class="header-meta">
        <span>Licensed &amp; insured</span>
        <span class="dot"></span>
        <span>(303) 555-0148</span>
      </div>
    </div>
  </header>

  <main class="wrap page-grid">
    <section class="intro">
      <p class="eyebrow">Free inspection · Front Range</p>
      <h1>Request a roofing inspection</h1>
      <p class="lede">Tell us about your property and the issue. A Summit Ridge estimator will follow up by your preferred contact method, usually within one business day — sooner for active leaks.</p>
      <ul class="trust">
        <li>Residential and commercial roofs</li>
        <li>Repairs, replacements, and storm inspections</li>
        <li>Serving the Denver metro and Colorado Front Range</li>
      </ul>
    </section>

    <section class="form-card">
      <h2>Get in touch</h2>
      ${bannerHtml}
      <form method="post" action="/leads" novalidate>
        <fieldset>
          <legend>Contact</legend>
          <div class="field">
            <label for="full_name">Full name</label>
            <input id="full_name" name="full_name" type="text" required maxlength="120" value="${v("full_name")}" class="${invalid("full_name")}" autocomplete="name">
            ${fieldError(errors, "full_name")}
          </div>
          <div class="two-col">
            <div class="field">
              <label for="phone">Phone</label>
              <input id="phone" name="phone" type="tel" required maxlength="30" value="${v("phone")}" class="${invalid("phone")}" autocomplete="tel" placeholder="(303) 555-0148">
              ${fieldError(errors, "phone")}
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" name="email" type="email" required maxlength="120" value="${v("email")}" class="${invalid("email")}" autocomplete="email">
              ${fieldError(errors, "email")}
            </div>
          </div>
          <div class="field">
            <label for="preferred_contact">Preferred contact method</label>
            <select id="preferred_contact" name="preferred_contact" required class="${invalid("preferred_contact")}">
              <option value="">Select one</option>
              ${options(CONTACT_METHODS, values.preferred_contact)}
            </select>
            ${fieldError(errors, "preferred_contact")}
          </div>
        </fieldset>

        <fieldset>
          <legend>Property</legend>
          <div class="field">
            <label for="street">Street address</label>
            <input id="street" name="street" type="text" required maxlength="160" value="${v("street")}" class="${invalid("street")}" autocomplete="street-address">
            ${fieldError(errors, "street")}
          </div>
          <div class="three-col">
            <div class="field">
              <label for="city">City</label>
              <input id="city" name="city" type="text" required maxlength="80" value="${v("city")}" class="${invalid("city")}" autocomplete="address-level2">
              ${fieldError(errors, "city")}
            </div>
            <div class="field">
              <label for="state">State</label>
              <select id="state" name="state" required class="${invalid("state")}" autocomplete="address-level1">
                <option value="">Select</option>
                ${options(US_STATES, values.state)}
              </select>
              ${fieldError(errors, "state")}
            </div>
            <div class="field">
              <label for="zip">ZIP</label>
              <input id="zip" name="zip" type="text" required maxlength="10" value="${v("zip")}" class="${invalid("zip")}" autocomplete="postal-code" inputmode="numeric">
              ${fieldError(errors, "zip")}
            </div>
          </div>
          <div class="two-col">
            <div class="field">
              <label for="property_type">Property type</label>
              <select id="property_type" name="property_type" required class="${invalid("property_type")}">
                <option value="">Select one</option>
                ${options(PROPERTY_TYPES, values.property_type)}
              </select>
              ${fieldError(errors, "property_type")}
            </div>
            <div class="field">
              <label for="roof_type">Roof type</label>
              <select id="roof_type" name="roof_type" required class="${invalid("roof_type")}">
                <option value="">Select one</option>
                ${options(ROOF_TYPES, values.roof_type)}
              </select>
              ${fieldError(errors, "roof_type")}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>The job</legend>
          <div class="two-col">
            <div class="field">
              <label for="service_needed">Service needed</label>
              <select id="service_needed" name="service_needed" required class="${invalid("service_needed")}">
                <option value="">Select one</option>
                ${options(SERVICES, values.service_needed)}
              </select>
              ${fieldError(errors, "service_needed")}
            </div>
            <div class="field">
              <label for="urgency">Urgency / timeline</label>
              <select id="urgency" name="urgency" required class="${invalid("urgency")}">
                <option value="">Select one</option>
                ${options(URGENCIES, values.urgency)}
              </select>
              ${fieldError(errors, "urgency")}
            </div>
          </div>
          <div class="field">
            <label for="issue_description">Describe the issue</label>
            <textarea id="issue_description" name="issue_description" required maxlength="2000" rows="5" class="${invalid("issue_description")}" placeholder="What’s going on with the roof? Any leaks, missing shingles, or recent storm damage?">${v("issue_description")}</textarea>
            ${fieldError(errors, "issue_description")}
          </div>
        </fieldset>

        <button type="submit" class="btn primary">Submit request</button>
        <p class="fine-print">By submitting, you agree to be contacted about this request. We don’t sell your information.</p>
      </form>
    </section>
  </main>
  ${publicFooter()}`;

  return layout({ title: "Request an Inspection | Summit Ridge Roofing", body });
}

function thanksPage() {
  const body = `
  <header class="site-header">
    <div class="wrap header-inner">
      ${logoMark()}
    </div>
  </header>
  <main class="wrap narrow">
    <section class="form-card thanks">
      <p class="eyebrow">Request received</p>
      <h1>Thank you. We’ll be in touch.</h1>
      <p>Your inspection request has been saved. A Summit Ridge estimator will follow up by your preferred contact method, usually within one business day. If you reported an active leak, we’ll try to reach you sooner.</p>
      <p><a href="/" class="btn secondary">Submit another request</a></p>
    </section>
  </main>
  ${publicFooter()}`;
  return layout({ title: "Request received | Summit Ridge Roofing", body });
}

function denverYmd(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)) {
    parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDateTimeLocal(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)) {
    parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function groupTasks(tasks) {
  const now = Date.now();
  const today = denverYmd(new Date());
  const groups = { overdue: [], today: [], upcoming: [], completed: [] };
  for (const task of tasks || []) {
    if (task.completed_at) {
      groups.completed.push(task);
      continue;
    }
    const due = new Date(task.due_at).getTime();
    if (Number.isNaN(due) || due < now) groups.overdue.push(task);
    else if (denverYmd(task.due_at) === today) groups.today.push(task);
    else groups.upcoming.push(task);
  }
  groups.completed.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  return groups;
}

function taskIsOverdue(task) {
  return !task.completed_at && new Date(task.due_at).getTime() < Date.now();
}

function taskActions(task, next) {
  if (task.completed_at) {
    return `<span class="muted">Completed ${escapeHtml(formatDate(task.completed_at))}</span>`;
  }
  const nextField = next
    ? `<input type="hidden" name="next" value="${escapeHtml(next)}">`
    : "";
  return `<div class="task-actions">
      <form method="post" action="/admin/tasks/${task.id}/complete">${nextField}<button type="submit" class="btn small">Complete</button></form>
      <form method="post" action="/admin/tasks/${task.id}/snooze">${nextField}<button type="submit" name="amount" value="1h" class="btn small ghost-dark">Snooze 1 hour</button></form>
      <form method="post" action="/admin/tasks/${task.id}/snooze">${nextField}<button type="submit" name="amount" value="1d" class="btn small ghost-dark">Snooze 1 day</button></form>
    </div>`;
}

function taskRow(task, next) {
  const overdue = taskIsOverdue(task);
  const lead = task.lead_id
    ? `<a href="/admin/leads/${task.lead_id}">${escapeHtml(task.lead_name || "Lead")}</a>`
    : "—";
  return `<article class="task-item${overdue ? " overdue" : ""}${task.completed_at ? " done" : ""}">
      <div>
        <h3>${escapeHtml(task.title)}</h3>
        <p class="muted">Due ${escapeHtml(formatDate(task.due_at))} · ${lead}${overdue ? ' · <span class="overdue-flag">Overdue</span>' : ""}</p>
      </div>
      ${taskActions(task, next)}
    </article>`;
}

function adminHeader({ query = "", count, chrome = {}, inboxOpen = false } = {}) {
  const countLabel =
    typeof count === "number" ? `<span class="lead-count">${count} lead${count === 1 ? "" : "s"}</span>` : "";
  const unread = chrome.unread || 0;
  const overdueCount = chrome.overdueCount || 0;
  const notes = chrome.notifications || [];
  const badge = unread > 0 ? `<span class="bell-badge">${unread > 9 ? "9+" : unread}</span>` : "";
  const overdueBadge = overdueCount > 0 ? `<span class="nav-badge">${overdueCount}</span>` : "";
  const items = notes.length
    ? notes
        .map(
          (n) => `<a class="notify-item${n.read_at ? " read" : " unread"}" href="/admin/notifications/${n.id}/open">
            <strong>${escapeHtml(n.title)}</strong>
            <span>${escapeHtml(formatDate(n.created_at))}</span>
          </a>`
        )
        .join("")
    : `<p class="muted notify-empty">No notifications yet.</p>`;
  return `<header class="admin-header">
    <div class="wrap header-inner">
      <a href="/admin" class="logo-link">${logoMark()}<span class="crm-tag">Lead CRM</span></a>
      <nav class="admin-nav">
        <a href="/admin">Dashboard</a>
        <a href="/admin/leads">Leads</a>
        <a href="/admin/tasks">Tasks${overdueBadge}</a>
        <a href="/admin/emails">Email log</a>
      </nav>
      <div class="header-actions">
        ${countLabel}
        <details class="notify-menu"${inboxOpen ? " open" : ""}>
          <summary class="bell-btn" aria-label="Notifications">${badge}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 22a2.2 2.2 0 0 0 2.2-2.2h-4.4A2.2 2.2 0 0 0 12 22Zm7-5.5v-5a7 7 0 0 0-5.2-6.8V4a1.8 1.8 0 1 0-3.6 0v.7A7 7 0 0 0 5 11.5v5L3 18.3V19.5h18v-1.2l-2-1.8Z"/></svg>
          </summary>
          <div class="notify-dropdown">
            <div class="notify-head">
              <strong>Notifications</strong>
              ${unread ? `<form method="post" action="/admin/notifications/read-all"><button type="submit" class="linkish">Mark all as read</button></form>` : ""}
            </div>
            ${items}
            <a class="notify-all" href="/admin/notifications">View all notifications</a>
          </div>
        </details>
        <form class="search-form" method="get" action="/admin/leads">
          <label class="sr-only" for="q">Search leads</label>
          <input id="q" name="q" type="search" value="${escapeHtml(query)}" placeholder="Search name, phone, or email">
          <button type="submit" class="btn small">Search</button>
        </form>
        <form method="post" action="/admin/logout">
          <button type="submit" class="btn small ghost">Log out</button>
        </form>
      </div>
    </div>
  </header>`;
}

function adminFooter() {
  return `<footer class="site-footer admin-footer">
    <p class="powered">Powered by Artific Creations</p>
  </footer>`;
}

function loginPage({ error } = {}) {
  const err = error ? `<div class="banner error">${escapeHtml(error)}</div>` : "";
  const body = `
  <main class="login-wrap">
    <section class="form-card login-card">
      ${logoMark()}
      <h1>Lead CRM</h1>
      <p class="muted">Sign in to view and update leads.</p>
      ${err}
      <form method="post" action="/admin/login">
        <div class="field">
          <label for="username">Username</label>
          <input id="username" name="username" type="text" required autocomplete="username">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn primary">Sign in</button>
      </form>
      <p class="powered">Powered by Artific Creations</p>
    </section>
  </main>`;
  return layout({ title: "Sign in | Summit Ridge CRM", body, admin: true });
}

function statusBadge(status) {
  const slug = String(status || "New").toLowerCase().replace(/\s+/g, "-");
  return `<span class="badge badge-${escapeHtml(slug)}">${escapeHtml(status)}</span>`;
}

function formatMoney(n) {
  if (n === null || n === undefined || n === "") return "—";
  return "$" + Number(n).toLocaleString("en-US");
}

function priorityBadge(priority) {
  if (!priority) return `<span class="muted">—</span>`;
  const slug = String(priority).toLowerCase();
  return `<span class="badge badge-${escapeHtml(slug)}">${escapeHtml(priority)}</span>`;
}

function aiListCell(lead) {
  if (lead.ai_score === null || lead.ai_score === undefined) {
    return `<td class="ai-cell"><span class="muted">Not scored</span></td>`;
  }
  return `<td class="ai-cell">
        ${priorityBadge(lead.ai_priority)}
        <span class="ai-score">${escapeHtml(lead.ai_score)}</span>
        <div class="ai-cat">${escapeHtml(lead.ai_category || "")}</div>
      </td>`;
}

function filterBanner(query, filterLabel) {
  const bits = [];
  if (filterLabel) bits.push(escapeHtml(filterLabel));
  if (query) bits.push(`search for “${escapeHtml(query)}”`);
  if (!bits.length) return "";
  return `<p class="search-meta">Showing ${bits.join(" · ")}. <a href="/admin/leads">Clear</a></p>`;
}

function listPage({ leads, query, count, chrome, filterLabel }) {
  const rows = leads
    .map(
      (lead) => `
      <tr>
        <td><a href="/admin/leads/${lead.id}">${escapeHtml(lead.full_name)}</a></td>
        ${aiListCell(lead)}
        <td>${escapeHtml(lead.phone)}</td>
        <td>${escapeHtml(lead.email)}</td>
        <td>${escapeHtml(lead.city)}, ${escapeHtml(lead.state)}</td>
        <td>${escapeHtml(lead.service_needed)}</td>
        <td>${escapeHtml(lead.urgency)}</td>
        <td>${statusBadge(lead.status)}</td>
        <td>${escapeHtml(formatDateShort(lead.created_at))}</td>
      </tr>`
    )
    .join("");

  const empty = leads.length
    ? ""
    : `<p class="empty">${query || filterLabel ? "No leads match this view." : "No leads yet."}</p>`;

  const clear = filterBanner(query, filterLabel);

  const body = `
  ${adminHeader({ query, count, chrome })}
  <main class="wrap">
    <h1 class="page-title">Leads</h1>
    ${clear}
    ${empty}
    ${
      leads.length
        ? `<div class="table-wrap">
      <table class="leads-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Priority</th>
            <th>Phone</th>
            <th>Email</th>
            <th>City / State</th>
            <th>Service</th>
            <th>Urgency</th>
            <th>Status</th>
            <th>Date received</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
        : ""
    }
  </main>
  ${adminFooter()}`;
  return layout({ title: "Leads | Summit Ridge CRM", body, admin: true });
}

function aiPanel(lead) {
  const scored = lead.ai_score !== null && lead.ai_score !== undefined;
  const source = lead.ai_source === "openai" ? "OpenAI-assisted" : "Offline scoring";
  const when = lead.ai_scored_at ? ` · ${formatDate(lead.ai_scored_at)}` : "";
  const body = scored
    ? `<div class="ai-metrics">
          <div><dt>Priority</dt><dd>${priorityBadge(lead.ai_priority)}</dd></div>
          <div><dt>Score</dt><dd class="ai-score-lg">${escapeHtml(lead.ai_score)}<span class="muted"> / 100</span></dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(lead.ai_category || "—")}</dd></div>
          <div><dt>Est. job value</dt><dd>${escapeHtml(formatMoney(lead.ai_value_low))}–${escapeHtml(formatMoney(lead.ai_value_high))}</dd></div>
        </div>
        <div class="ai-copy">
          <p><strong>Follow up:</strong> ${escapeHtml(lead.ai_followup || "—")}</p>
          <p><strong>Next action:</strong> ${escapeHtml(lead.ai_next_action || "—")}</p>
          <p><strong>Summary:</strong> ${escapeHtml(lead.ai_summary || "—")}</p>
        </div>`
    : `<p class="muted">This lead has not been scored yet. Use Re-run scoring to generate a category, priority, and estimate.</p>`;
  return `<section class="form-card ai-panel">
      <div class="ai-panel-head">
        <h2>AI scoring</h2>
        <form method="post" action="/admin/leads/${lead.id}/rescore">
          <button type="submit" class="btn small secondary">Re-run scoring</button>
        </form>
      </div>
      ${body}
      <p class="ai-meta">${escapeHtml(source)}${escapeHtml(when)}</p>
    </section>`;
}

function detailPage({ lead, notes, error, tasks = [], chrome }) {
  const statusOptions = STATUSES.map(
    (s) =>
      `<option value="${escapeHtml(s)}"${lead.status === s ? " selected" : ""}>${escapeHtml(s)}</option>`
  ).join("");

  const notesHtml = notes.length
    ? notes
        .map(
          (n) => `<li>
            <p>${escapeHtml(n.body)}</p>
            <time>${escapeHtml(formatDate(n.created_at))}</time>
          </li>`
        )
        .join("")
    : "<li class='muted'>No notes yet.</li>";

  const err = error ? `<div class="banner error">${escapeHtml(error)}</div>` : "";

  const body = `
  ${adminHeader({ count: null, chrome })}
  <main class="wrap">
    <p class="back"><a href="/admin/leads">← All leads</a></p>
    <div class="detail-head">
      <div>
        <h1>${escapeHtml(lead.full_name)}</h1>
        <p class="muted">Received ${escapeHtml(formatDate(lead.created_at))}</p>
      </div>
      <div class="head-badges">${priorityBadge(lead.ai_priority)} ${statusBadge(lead.status)}</div>
    </div>
    ${err}

    ${aiPanel(lead)}

    <div class="detail-grid">
      <section class="form-card">
        <h2>Lead details</h2>
        <dl class="facts">
          <div><dt>Phone</dt><dd>${escapeHtml(lead.phone)}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(lead.email)}</dd></div>
          <div><dt>Preferred contact</dt><dd>${escapeHtml(lead.preferred_contact)}</dd></div>
          <div><dt>Address</dt><dd>${escapeHtml(lead.street)}<br>${escapeHtml(lead.city)}, ${escapeHtml(lead.state)} ${escapeHtml(lead.zip)}</dd></div>
          <div><dt>Property type</dt><dd>${escapeHtml(lead.property_type)}</dd></div>
          <div><dt>Roof type</dt><dd>${escapeHtml(lead.roof_type)}</dd></div>
          <div><dt>Service needed</dt><dd>${escapeHtml(lead.service_needed)}</dd></div>
          <div><dt>Urgency / timeline</dt><dd>${escapeHtml(lead.urgency)}</dd></div>
        </dl>
        <h3>Issue description</h3>
        <p class="description">${escapeHtml(lead.issue_description)}</p>
      </section>

      <aside class="side">
        <section class="form-card">
          <h2>Status</h2>
          <form method="post" action="/admin/leads/${lead.id}/status">
            <div class="field">
              <label for="status">Update status</label>
              <select id="status" name="status">${statusOptions}</select>
            </div>
            <button type="submit" class="btn primary">Save status</button>
          </form>
        </section>
        <section class="form-card">
          <h2>Follow-up tasks</h2>
          ${
            (tasks || []).length
              ? tasks.map((t) => taskRow(t, "/admin/leads/" + lead.id)).join("")
              : '<p class="muted">No tasks yet.</p>'
          }
          <form class="add-task" method="post" action="/admin/leads/${lead.id}/tasks">
            <div class="field">
              <label for="title">Add a task</label>
              <input id="title" name="title" type="text" required maxlength="160" placeholder="Call back, send quote…">
            </div>
            <div class="field">
              <label for="due_at">Due</label>
              <input id="due_at" name="due_at" type="datetime-local" required value="${escapeHtml(formatDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)))}">
            </div>
            <button type="submit" class="btn secondary">Add task</button>
          </form>
        </section>
        <section class="form-card">
          <h2>Notes</h2>
          <form method="post" action="/admin/leads/${lead.id}/notes">
            <div class="field">
              <label for="body">Add a note</label>
              <textarea id="body" name="body" rows="4" required maxlength="2000"></textarea>
            </div>
            <button type="submit" class="btn secondary">Add note</button>
          </form>
          <ul class="notes">${notesHtml}</ul>
        </section>
      </aside>
    </div>
  </main>
  ${adminFooter()}`;

  return layout({
    title: `${lead.full_name} | Summit Ridge CRM`,
    body,
    admin: true,
  });
}

function notificationsPage({ notifications, chrome, inboxOpen }) {
  const items = notifications.length
    ? `<ul class="notify-list">${notifications
        .map(
          (n) => `<li class="${n.read_at ? "read" : "unread"}">
            <a href="/admin/notifications/${n.id}/open">
              <strong>${escapeHtml(n.title)}</strong>
              <p>${escapeHtml(n.body || "")}</p>
              <span class="muted">${escapeHtml(formatDate(n.created_at))}${n.read_at ? "" : " · Unread"}</span>
            </a>
          </li>`
        )
        .join("")}</ul>`
    : '<p class="empty">No notifications yet.</p>';
  const mark = chrome && chrome.unread
    ? `<form method="post" action="/admin/notifications/read-all"><button type="submit" class="btn small secondary">Mark all as read</button></form>`
    : "";
  const body = `
  ${adminHeader({ chrome, inboxOpen })}
  <main class="wrap">
    <div class="page-head">
      <h1 class="page-title">Notifications</h1>
      ${mark}
    </div>
    ${items}
  </main>
  ${adminFooter()}`;
  return layout({ title: "Notifications | Summit Ridge CRM", body, admin: true });
}

function emailLogPage({ emails, chrome }) {
  const rows = emails.length
    ? emails
        .map(
          (e) => `<article class="email-item">
            <header>
              <div>
                <h2>${escapeHtml(e.subject)}</h2>
                <p class="muted">To ${escapeHtml(e.to_addr)} · ${escapeHtml(formatDate(e.created_at))}${e.lead_id ? ` · <a href="/admin/leads/${e.lead_id}">${escapeHtml(e.lead_name || "Lead")}</a>` : ""}</p>
              </div>
              <span class="badge badge-status-${escapeHtml(e.status)}">${escapeHtml(e.status)}</span>
            </header>
            <pre class="email-body">${escapeHtml(e.body)}</pre>
            ${e.error ? `<p class="field-error">${escapeHtml(e.error)}</p>` : ""}
          </article>`
        )
        .join("")
    : '<p class="empty">No emails have been logged yet.</p>';
  const body = `
  ${adminHeader({ chrome })}
  <main class="wrap">
    <h1 class="page-title">Email log</h1>
    <p class="search-meta">Every outbound alert is recorded here, even when SMTP is not configured. Status is <code>logged</code> unless a message was actually sent.</p>
    ${rows}
  </main>
  ${adminFooter()}`;
  return layout({ title: "Email log | Summit Ridge CRM", body, admin: true });
}

function tasksPage({ tasks, chrome }) {
  const groups = groupTasks(tasks);
  const section = (title, list, empty) => `
    <section class="task-section">
      <h2>${escapeHtml(title)} <span class="muted">${list.length}</span></h2>
      ${list.length ? list.map((t) => taskRow(t, "/admin/tasks")).join("") : `<p class="muted">${escapeHtml(empty)}</p>`}
    </section>`;
  const body = `
  ${adminHeader({ chrome })}
  <main class="wrap">
    <h1 class="page-title">Follow-up tasks</h1>
    ${section("Overdue", groups.overdue, "Nothing overdue.")}
    ${section("Today", groups.today, "No tasks due later today.")}
    ${section("Upcoming", groups.upcoming, "No upcoming tasks.")}
    ${section("Completed", groups.completed.slice(0, 8), "No completed tasks yet.")}
  </main>
  ${adminFooter()}`;
  return layout({ title: "Tasks | Summit Ridge CRM", body, admin: true });
}

function barRows(items, kind) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return items
    .map((item) => {
      const label = kind === "status" ? item.status : item.priority;
      const href =
        kind === "status"
          ? `/admin/leads?status=${encodeURIComponent(label)}`
          : `/admin/leads?priority=${encodeURIComponent(label)}`;
      const pct = Math.round((item.n / max) * 100);
      const slug = String(label).toLowerCase().replace(/\s+/g, "-");
      return `<a class="bar-row" href="${href}">
          <span class="bar-label">${escapeHtml(label)}</span>
          <span class="bar-track"><span class="bar bar-${escapeHtml(slug)}" style="width:${pct}%"></span></span>
          <span class="bar-count">${item.n}</span>
        </a>`;
    })
    .join("");
}

function kpiTile(href, label, value, hint) {
  return `<a class="kpi" href="${escapeHtml(href)}">
      <span class="kpi-value">${escapeHtml(value)}</span>
      <span class="kpi-label">${escapeHtml(label)}</span>
      ${hint ? `<span class="kpi-hint">${escapeHtml(hint)}</span>` : ""}
    </a>`;
}

function dashboardPage({ stats, chrome }) {
  const recentLeadRows = stats.recentLeads.length
    ? stats.recentLeads
        .map(
          (lead) => `<tr>
            <td><a href="/admin/leads/${lead.id}">${escapeHtml(lead.full_name)}</a></td>
            <td>${priorityBadge(lead.ai_priority)}</td>
            <td>${statusBadge(lead.status)}</td>
            <td>${escapeHtml(lead.city)}, ${escapeHtml(lead.state)}</td>
            <td>${escapeHtml(lead.service_needed)}</td>
            <td>${escapeHtml(formatDateShort(lead.created_at))}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="muted">No leads yet.</td></tr>`;

  const taskList = (list, empty) =>
    list.length
      ? list
          .map((t) => {
            const overdue = taskIsOverdue(t);
            return `<a class="dash-item${overdue ? " overdue" : ""}" href="${t.lead_id ? "/admin/leads/" + t.lead_id : "/admin/tasks"}">
              <strong>${escapeHtml(t.title)}</strong>
              <span>Due ${escapeHtml(formatDate(t.due_at))}${overdue ? " · Overdue" : ""}${t.lead_name ? " · " + escapeHtml(t.lead_name) : ""}</span>
            </a>`;
          })
          .join("")
      : `<p class="muted">${escapeHtml(empty)}</p>`;

  const notes = stats.recentNotifications.length
    ? stats.recentNotifications
        .map(
          (n) => `<a class="dash-item${n.read_at ? "" : " unread"}" href="/admin/notifications/${n.id}/open">
            <strong>${escapeHtml(n.title)}</strong>
            <span>${escapeHtml(formatDate(n.created_at))}${n.read_at ? "" : " · Unread"}</span>
          </a>`
        )
        .join("")
    : `<p class="muted">No recent activity.</p>`;

  const body = `
  ${adminHeader({ chrome, count: stats.total })}
  <main class="wrap dash">
    <div class="page-head">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="muted">${escapeHtml(new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()))} · America/Denver</p>
      </div>
      <a class="btn small secondary" href="/admin/leads">View all leads</a>
    </div>

    <section class="kpi-grid">
      ${kpiTile("/admin/leads?range=today", "New leads today", stats.newToday, "Received today")}
      ${kpiTile("/admin/leads?priority=Hot&open=1", "Open Hot leads", stats.openHot, "Not won or lost")}
      ${kpiTile("/admin/leads?pipeline=1", "In pipeline", stats.pipeline, "Active leads")}
      ${kpiTile("/admin/leads?status=Won&range=month", "Won this month", stats.wonMonth, "By date received")}
      ${kpiTile("/admin/tasks", "Overdue follow-ups", stats.overdueFollowups, "Open tasks past due")}
    </section>

    <div class="dash-grid">
      <section class="form-card">
        <div class="ai-panel-head">
          <h2>Pipeline by status</h2>
        </div>
        ${barRows(stats.byStatus, "status")}
      </section>
      <section class="form-card">
        <div class="ai-panel-head">
          <h2>Leads by priority</h2>
        </div>
        ${barRows(stats.byPriority, "priority")}
      </section>
    </div>

    <section class="form-card">
      <div class="ai-panel-head">
        <h2>Recent leads</h2>
        <a href="/admin/leads">All leads</a>
      </div>
      <div class="table-wrap flat">
        <table class="leads-table compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>Priority</th>
              <th>Status</th>
              <th>City / State</th>
              <th>Service</th>
              <th>Date received</th>
            </tr>
          </thead>
          <tbody>${recentLeadRows}</tbody>
        </table>
      </div>
    </section>

    <div class="dash-grid">
      <section class="form-card">
        <div class="ai-panel-head">
          <h2>Overdue tasks</h2>
          <a href="/admin/tasks">All tasks</a>
        </div>
        ${taskList(stats.overdueTasks, "Nothing overdue.")}
      </section>
      <section class="form-card">
        <div class="ai-panel-head">
          <h2>Upcoming tasks</h2>
          <a href="/admin/tasks">All tasks</a>
        </div>
        ${taskList(stats.upcomingTasks, "No upcoming tasks.")}
      </section>
    </div>

    <section class="form-card">
      <div class="ai-panel-head">
        <h2>Recent activity</h2>
        <a href="/admin/notifications">All notifications</a>
      </div>
      ${notes}
    </section>
  </main>
  ${adminFooter()}`;
  return layout({ title: "Dashboard | Summit Ridge CRM", body, admin: true });
}

function notFoundPage() {
  const body = `<main class="wrap narrow"><section class="form-card"><h1>Page not found</h1><p><a href="/">Back to the inspection form</a></p></section></main>`;
  return layout({ title: "Not found", body });
}

module.exports = {
  escapeHtml,
  formatDate,
  formatDateShort,
  stateName,
  formPage,
  thanksPage,
  loginPage,
  listPage,
  dashboardPage,
  detailPage,
  notificationsPage,
  emailLogPage,
  tasksPage,
  notFoundPage,
};
