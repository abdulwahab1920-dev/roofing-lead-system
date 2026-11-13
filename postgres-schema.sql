-- PostgreSQL schema for the free-tier hosted database.
-- Keep timestamps as ISO-8601 text so existing display and workflow logic
-- can migrate without changing the stored timestamp representation.

CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  property_type TEXT NOT NULL,
  roof_type TEXT NOT NULL,
  service_needed TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  urgency TEXT NOT NULL,
  preferred_contact TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL,
  ai_category TEXT,
  ai_priority TEXT,
  ai_score INTEGER,
  ai_value_low INTEGER,
  ai_value_high INTEGER,
  ai_next_action TEXT,
  ai_followup TEXT,
  ai_summary TEXT,
  ai_scored_at TEXT,
  ai_source TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emails (
  id BIGSERIAL PRIMARY KEY,
  to_addr TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_at TEXT NOT NULL,
  completed_at TEXT,
  notified_overdue_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(ai_priority);
CREATE INDEX IF NOT EXISTS idx_notes_lead_created ON notes(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
