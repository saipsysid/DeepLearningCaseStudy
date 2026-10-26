/**
 * SQLite database initialization using better-sqlite3.
 * Reads schema from schema.sql and seeds sample orders on first run.
 * Exports typed query helpers used throughout the application.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { sampleOrders } from "../data/sampleOrders";

// ── Singleton DB instance ────────────────────────────────────────────────────
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

/**
 * Initialize the SQLite database:
 * 1. Open / create the DB file at SQLITE_DB_PATH
 * 2. Apply schema.sql (idempotent — uses CREATE TABLE IF NOT EXISTS)
 * 3. Seed sample orders if the table is empty
 */
export function initDatabase(): void {
  const projectRoot = path.resolve(__dirname, "../../../");
  const configuredPath =
    process.env.SQLITE_DB_PATH ?? process.env.DB_PATH ?? "database/blinkit_support.db";
  const dbPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(projectRoot, configuredPath);

  // Ensure the parent directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Apply schema
  const schemaCandidates = [
    path.join(__dirname, "schema.sql"),
    path.join(projectRoot, "backend", "src", "database", "schema.sql"),
  ];
  const schemaPath = schemaCandidates.find((candidate) => fs.existsSync(candidate));
  if (!schemaPath) {
    throw new Error(`SQLite schema was not found. Checked: ${schemaCandidates.join(", ")}`);
  }
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  // Seed sample orders if empty
  seedOrders();

  console.log(`[DB] SQLite initialized at ${dbPath}`);
}

function seedOrders(): void {
  const count = (
    db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number }
  ).c;

  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO orders
        (id, customer_name, customer_email, items, total_amount, status,
         delivery_address, created_at, delivered_at, notes)
      VALUES
        (@id, @customer_name, @customer_email, @items, @total_amount, @status,
         @delivery_address, @created_at, @delivered_at, @notes)
    `);

    const insertMany = db.transaction((orders: typeof sampleOrders) => {
      for (const o of orders) {
        insert.run({
          ...o,
          items: JSON.stringify(o.items),
          delivered_at: o.delivered_at ?? null,
        });
      }
    });

    insertMany(sampleOrders);
    console.log(`[DB] Seeded ${sampleOrders.length} sample orders.`);
  }
}

// ── Typed query helpers ──────────────────────────────────────────────────────

export interface ConversationRow {
  id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  status: "active" | "resolved" | "escalated";
  user_agent: string | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent: string | null;
  confidence: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  created_at: string;
}

export interface TicketRow {
  id: string;
  conversation_id: string | null;
  issue_type: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  description: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface OrderRow {
  id: string;
  customer_name: string;
  customer_email: string;
  items: string; // JSON string
  total_amount: number;
  status: string;
  delivery_address: string;
  created_at: string;
  delivered_at: string | null;
  notes: string | null;
}

// ── Conversation helpers ─────────────────────────────────────────────────────

export const dbHelpers = {
  // Conversations
  getConversationBySession(sessionId: string): ConversationRow | undefined {
    return getDb()
      .prepare("SELECT * FROM conversations WHERE session_id = ?")
      .get(sessionId) as ConversationRow | undefined;
  },

  createConversation(
    id: string,
    sessionId: string,
    userAgent?: string
  ): void {
    getDb()
      .prepare(
        `INSERT INTO conversations (id, session_id, user_agent)
         VALUES (?, ?, ?)`
      )
      .run(id, sessionId, userAgent ?? null);
  },

  updateConversationStatus(
    sessionId: string,
    status: ConversationRow["status"]
  ): void {
    getDb()
      .prepare(
        `UPDATE conversations SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE session_id = ?`
      )
      .run(status, sessionId);
  },

  // Messages
  insertMessage(msg: Omit<MessageRow, "created_at">): void {
    getDb()
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, intent, confidence, sentiment)
         VALUES (@id, @conversation_id, @role, @content, @intent, @confidence, @sentiment)`
      )
      .run(msg);
    getDb()
      .prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(msg.conversation_id);
  },

  getMessagesByConversation(conversationId: string): MessageRow[] {
    return getDb()
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC"
      )
      .all(conversationId) as MessageRow[];
  },

  getConversationHistory(sessionId: string): MessageRow[] {
    const conversation = this.getConversationBySession(sessionId);
    if (!conversation) return [];
    return this.getMessagesByConversation(conversation.id);
  },

  // Tickets
  insertTicket(ticket: Omit<TicketRow, "created_at" | "resolved_at">): void {
    getDb()
      .prepare(
        `INSERT INTO tickets (id, conversation_id, issue_type, priority, status, description)
         VALUES (@id, @conversation_id, @issue_type, @priority, @status, @description)`
      )
      .run(ticket);
  },

  getTickets(limit = 50, offset = 0): TicketRow[] {
    return getDb()
      .prepare("SELECT * FROM tickets ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .all(limit, offset) as TicketRow[];
  },

  updateTicketStatus(
    id: string,
    status: TicketRow["status"],
    resolvedAt?: string
  ): void {
    getDb()
      .prepare(
        `UPDATE tickets SET status = ?, resolved_at = ? WHERE id = ?`
      )
      .run(status, resolvedAt ?? null, id);
  },

  // Orders
  getOrderById(orderId: string): OrderRow | undefined {
    return getDb()
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(orderId) as OrderRow | undefined;
  },

  // Analytics
  insertAnalyticsEvent(id: string, eventType: string, data: object): void {
    getDb()
      .prepare(
        `INSERT INTO analytics_events (id, event_type, data) VALUES (?, ?, ?)`
      )
      .run(id, eventType, JSON.stringify(data));
  },

  /** Overview: total conversations, messages, open tickets, resolution rate */
  getAnalyticsOverview(): {
    total_conversations: number;
    total_messages: number;
    open_tickets: number;
    resolved_conversations: number;
    resolution_rate: number;
  } {
    const db = getDb();
    const totalConvs = (
      db.prepare("SELECT COUNT(*) as c FROM conversations").get() as { c: number }
    ).c;
    const totalMsgs = (
      db.prepare("SELECT COUNT(*) as c FROM messages").get() as { c: number }
    ).c;
    const openTickets = (
      db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = 'open'").get() as {
        c: number;
      }
    ).c;
    const resolvedConvs = (
      db
        .prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'resolved'")
        .get() as { c: number }
    ).c;

    const resolutionRate =
      totalConvs > 0
        ? Math.round((resolvedConvs / totalConvs) * 100)
        : 0;

    return {
      total_conversations: totalConvs,
      total_messages: totalMsgs,
      open_tickets: openTickets,
      resolved_conversations: resolvedConvs,
      resolution_rate: resolutionRate,
    };
  },

  /** Sentiment distribution for messages in the last N days */
  getSentimentTrend(
    days = 7
  ): { date: string; positive: number; neutral: number; negative: number }[] {
    return getDb()
      .prepare(
        `SELECT
           DATE(created_at) as date,
           SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
           SUM(CASE WHEN sentiment = 'neutral'  THEN 1 ELSE 0 END) as neutral,
           SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative
         FROM messages
         WHERE role = 'user'
           AND created_at >= DATE('now', '-' || ? || ' days')
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      )
      .all(days) as {
      date: string;
      positive: number;
      neutral: number;
      negative: number;
    }[];
  },

  /** Top N intent labels by frequency */
  getTopIntents(limit = 10): { intent: string; count: number }[] {
    return getDb()
      .prepare(
        `SELECT intent, COUNT(*) as count
         FROM messages
         WHERE intent IS NOT NULL AND intent != ''
         GROUP BY intent
         ORDER BY count DESC
         LIMIT ?`
      )
      .all(limit) as { intent: string; count: number }[];
  },

  /** Ticket counts grouped by status and priority */
  getTicketStats(): {
    by_status: { status: string; count: number }[];
    by_priority: { priority: string; count: number }[];
  } {
    const db = getDb();
    const byStatus = db
      .prepare(
        "SELECT status, COUNT(*) as count FROM tickets GROUP BY status"
      )
      .all() as { status: string; count: number }[];

    const byPriority = db
      .prepare(
        "SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority"
      )
      .all() as { priority: string; count: number }[];

    return { by_status: byStatus, by_priority: byPriority };
  },
};
