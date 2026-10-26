/**
 * Analytics service — query helpers that aggregate SQLite data
 * for dashboard consumption.
 */

import { dbHelpers } from "../database/db";

export interface OverviewStats {
  total_conversations: number;
  total_messages: number;
  open_tickets: number;
  resolved_conversations: number;
  resolution_rate: number; // percentage 0-100
}

export interface SentimentTrendPoint {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface IntentStat {
  intent: string;
  count: number;
  percentage: number;
}

export interface TicketStats {
  by_status: { status: string; count: number }[];
  by_priority: { priority: string; count: number }[];
  total: number;
}

// ── Service Functions ─────────────────────────────────────────────────────────

/**
 * Return high-level support overview metrics.
 */
export function getOverview(): OverviewStats {
  return dbHelpers.getAnalyticsOverview();
}

/**
 * Return daily sentiment trend for the last N days.
 * Fills in missing dates with zeros so the frontend chart has contiguous data.
 */
export function getSentimentTrend(days = 7): SentimentTrendPoint[] {
  const rows = dbHelpers.getSentimentTrend(days);

  // Build a map of existing rows
  const rowMap = new Map(rows.map((r) => [r.date, r]));

  // Fill missing dates with zeros
  const result: SentimentTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    result.push(
      rowMap.get(dateStr) ?? {
        date: dateStr,
        positive: 0,
        neutral: 0,
        negative: 0,
      }
    );
  }

  return result;
}

/**
 * Return top N intents with percentages.
 */
export function getIntentDistribution(limit = 10): IntentStat[] {
  const rows = dbHelpers.getTopIntents(limit);
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  return rows.map((r) => ({
    ...r,
    percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
  }));
}

/**
 * Return ticket counts by status and priority, plus total.
 */
export function getTicketStats(): TicketStats {
  const stats = dbHelpers.getTicketStats();
  const total = stats.by_status.reduce((acc, s) => acc + s.count, 0);
  return { ...stats, total };
}
