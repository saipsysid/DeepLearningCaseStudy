import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { dbHelpers } from "../database/db";

export const ticketsRouter = Router();

const createTicketSchema = z.object({
  sessionId: z.string().min(1).max(128).optional(),
  issueType: z.enum([
    "order",
    "refund",
    "payment",
    "delivery",
    "damage",
    "account",
    "general",
  ]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  description: z.string().trim().min(1).max(2000),
});

ticketsRouter.post("/api/tickets", (req, res, next) => {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          message: parsed.error.issues[0]?.message ?? "Invalid ticket details.",
          code: 400,
        },
      });
      return;
    }

    const { sessionId, issueType, priority, description } = parsed.data;
    const conversation = sessionId
      ? dbHelpers.getConversationBySession(sessionId)
      : undefined;
    if (sessionId && !conversation) {
      res.status(404).json({
        success: false,
        error: { message: "No conversation found for this session.", code: 404 },
      });
      return;
    }

    const ticketId = uuidv4();
    dbHelpers.insertTicket({
      id: ticketId,
      conversation_id: conversation?.id ?? null,
      issue_type: issueType,
      priority,
      status: "open",
      description,
    });
    dbHelpers.insertAnalyticsEvent(uuidv4(), "ticket_created", {
      ticketId,
      issueType,
      priority,
      sessionId: sessionId ?? null,
    });

    res.status(201).json({
      success: true,
      ticket: {
        id: ticketId,
        issueType,
        priority,
        status: "open",
        description,
      },
    });
  } catch (err) {
    next(err);
  }
});
