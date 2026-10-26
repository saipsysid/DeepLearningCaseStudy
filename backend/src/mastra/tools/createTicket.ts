/**
 * Mastra Tool: createTicket
 * Creates a support ticket in SQLite when a customer issue cannot be
 * resolved automatically and requires human or follow-up attention.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { dbHelpers } from "../../database/db";

const ISSUE_TYPES = [
  "order",
  "refund",
  "payment",
  "delivery",
  "damage",
  "account",
  "general",
] as const;

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const createTicket = createTool({
  id: "createTicket",
  description:
    "Create a support ticket for issues that require human follow-up or cannot be resolved immediately. Use this for refund requests, complaints, damage reports, or escalations.",
  inputSchema: z.object({
    conversationId: z
      .string()
      .optional()
      .describe("The conversation ID to link the ticket to"),
    issueType: z
      .enum(ISSUE_TYPES)
      .describe("Category of the issue"),
    priority: z
      .enum(PRIORITIES)
      .default("medium")
      .describe(
        "Ticket priority: critical (payment fraud, account locked), high (missing order, wrong delivery), medium (refund request, damage), low (general inquiry)"
      ),
    description: z
      .string()
      .describe("A clear summary of the customer's issue"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ticketId: z.string(),
    message: z.string(),
    estimatedResolutionTime: z.string(),
  }),
  execute: async ({ context }) => {
    const { conversationId, issueType, priority, description } = context;

    const ticketId = uuidv4();

    try {
      dbHelpers.insertTicket({
        id: ticketId,
        conversation_id: conversationId ?? null,
        issue_type: issueType,
        priority,
        status: "open",
        description,
      });

      // Estimated resolution times based on priority
      const resolutionTimes: Record<string, string> = {
        critical: "within 2 hours",
        high: "within 4-6 hours",
        medium: "within 24-48 hours",
        low: "within 3-5 business days",
      };

      return {
        success: true,
        ticketId,
        message: `Support ticket #${ticketId.slice(0, 8).toUpperCase()} has been created successfully. Our team will reach out to you ${resolutionTimes[priority]}.`,
        estimatedResolutionTime: resolutionTimes[priority] ?? "within 48 hours",
      };
    } catch (err) {
      console.error("[createTicket] Failed to create ticket:", err);
      return {
        success: false,
        ticketId: "",
        message: "Failed to create support ticket. Please try again or contact support directly.",
        estimatedResolutionTime: "N/A",
      };
    }
  },
});
