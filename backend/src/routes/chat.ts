/**
 * Chat endpoints persist conversation turns and enrich the agent prompt with
 * intent, sentiment, and FAQ results before requesting the model response.
 */

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { chatLimiter } from "../middleware/rateLimiter";
import {
  hasOpenRouterKey,
  runSupportAgent,
  type ChatTurn,
} from "../mastra/agents/supportAgent";
import { dbHelpers } from "../database/db";
import { searchKnowledge } from "../services/ragService";
import { getIntent, getSentiment } from "../services/pythonService";

export const chatRouter = Router();

chatRouter.get("/api/chat/:sessionId/history", (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId || sessionId.length > 128) {
      res.status(400).json({
        success: false,
        error: { message: "Invalid session ID.", code: 400 },
      });
      return;
    }

    const messages = dbHelpers.getConversationHistory(sessionId).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    }));
    res.json({ success: true, sessionId, messages });
  } catch (err) {
    next(err);
  }
});

chatRouter.post("/api/chat", chatLimiter, async (req, res, next) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const sessionId =
      typeof req.body?.sessionId === "string" && req.body.sessionId.length > 0
        ? req.body.sessionId
        : uuidv4();

    if (!message) {
      res.status(400).json({
        success: false,
        error: { message: "Please type a message before sending.", code: 400 },
      });
      return;
    }

    if (message.length > 500) {
      res.status(400).json({
        success: false,
        error: { message: "Message is too long (max 500 characters).", code: 400 },
      });
      return;
    }

    if (sessionId.length > 128) {
      res.status(400).json({
        success: false,
        error: { message: "Session ID is too long.", code: 400 },
      });
      return;
    }

    let conversation = dbHelpers.getConversationBySession(sessionId);
    if (!conversation) {
      dbHelpers.createConversation(uuidv4(), sessionId, req.get("user-agent"));
      dbHelpers.insertAnalyticsEvent(uuidv4(), "session_started", { sessionId });
      conversation = dbHelpers.getConversationBySession(sessionId);
    }
    if (!conversation) {
      throw new Error("Could not create or load the support conversation.");
    }

    const previousTurns: ChatTurn[] = dbHelpers
      .getMessagesByConversation(conversation.id)
      .filter(
        (turn) =>
          (turn.role === "user" || turn.role === "assistant") &&
          turn.content.trim().length > 0
      )
      .slice(-8)
      .map((turn) => ({ role: turn.role as ChatTurn["role"], content: turn.content }));

    const [intent, sentiment, faqResults] = await Promise.all([
      getIntent(message),
      getSentiment(message),
      searchKnowledge(message, 3),
    ]);

    dbHelpers.insertMessage({
      id: uuidv4(),
      conversation_id: conversation.id,
      role: "user",
      content: message,
      intent: intent.label,
      confidence: intent.confidence,
      sentiment: sentiment.label,
    });
    dbHelpers.insertAnalyticsEvent(uuidv4(), "message_received", { sessionId });
    dbHelpers.insertAnalyticsEvent(uuidv4(), "intent_classified", {
      sessionId,
      intent: intent.label,
      confidence: intent.confidence,
      sentiment: sentiment.label,
    });

    if (!hasOpenRouterKey()) {
      res.status(503).json({
        success: false,
        error: {
          message:
            "The backend is running, but OPENROUTER_API_KEY is not set. Add it to the project .env file.",
          code: 503,
        },
      });
      return;
    }

    const supportContext = [
      `Detected intent: ${intent.label} (confidence ${intent.confidence.toFixed(2)}).`,
      `Detected sentiment: ${sentiment.label}.`,
      faqResults.length > 0
        ? `Relevant FAQ/policy content:\n${faqResults
            .map(
              (result, index) =>
                `${index + 1}. ${result.metadata.title}: ${result.text}`
            )
            .join("\n")}`
        : "No matching FAQ content was found. Do not claim a policy was verified.",
    ].join("\n");

    const reply = await runSupportAgent(message, previousTurns, supportContext);
    dbHelpers.insertMessage({
      id: uuidv4(),
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
      intent: null,
      confidence: null,
      sentiment: null,
    });
    dbHelpers.insertAnalyticsEvent(uuidv4(), "assistant_reply_created", { sessionId });

    res.json({
      success: true,
      sessionId,
      reply,
      agent: "blinkit-support-agent",
      intent: { label: intent.label, confidence: intent.confidence },
      sentiment,
      faqResults: faqResults.map((result) => ({
        title: result.metadata.title,
        category: result.metadata.category,
        relevanceScore: result.relevanceScore,
      })),
    });
  } catch (err) {
    next(err);
  }
});
