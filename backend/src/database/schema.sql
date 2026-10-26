-- ============================================================
-- Blinkit Customer Support Platform - SQLite Schema
-- ============================================================

-- Stores each unique support session (one per browser/user interaction)
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,                        -- UUID
  session_id  TEXT NOT NULL UNIQUE,                   -- frontend session identifier
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  status      TEXT DEFAULT 'active'                   -- active | resolved | escalated
               CHECK(status IN ('active','resolved','escalated')),
  user_agent  TEXT                                     -- browser user-agent string
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status  ON conversations(status);

-- ---------------------------------------------------------------
-- Individual chat messages within a conversation
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,                   -- UUID
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  intent          TEXT,                               -- classified intent label
  confidence      REAL,                               -- intent confidence 0.0 – 1.0
  sentiment       TEXT CHECK(sentiment IN ('positive','neutral','negative')),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created      ON messages(created_at);

-- ---------------------------------------------------------------
-- Support tickets raised during conversations
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id              TEXT PRIMARY KEY,                   -- UUID
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  issue_type      TEXT NOT NULL,                      -- order | refund | payment | delivery | damage | general
  priority        TEXT DEFAULT 'medium'
                  CHECK(priority IN ('low','medium','high','critical')),
  status          TEXT DEFAULT 'open'
                  CHECK(status IN ('open','in_progress','resolved','closed')),
  description     TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME
);

CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);

-- ---------------------------------------------------------------
-- Analytics event stream (append-only log)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,                       -- UUID
  event_type  TEXT NOT NULL,                          -- message_received | intent_classified | ticket_created | session_started | etc.
  data        TEXT NOT NULL DEFAULT '{}',             -- JSON-encoded payload
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created    ON analytics_events(created_at);

-- ---------------------------------------------------------------
-- Sample orders table (seeded from sampleOrders.ts at startup)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,                   -- e.g. ORD-001
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  items           TEXT NOT NULL,                      -- JSON array of {name, qty, price}
  total_amount    REAL NOT NULL,
  status          TEXT NOT NULL
                  CHECK(status IN ('pending','processing','shipped','delivered','cancelled','refund_requested','refunded')),
  delivery_address TEXT NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_at    DATETIME,
  notes           TEXT
);
