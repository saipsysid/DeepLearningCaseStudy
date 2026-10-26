import { Router } from "express";
import { hasOpenRouterKey } from "../mastra/agents/supportAgent";
import { checkPythonServiceHealth } from "../services/pythonService";
import { checkChromaHealth } from "../services/ragService";

export const healthRouter = Router();

healthRouter.get("/api/health", async (_req, res) => {
  const [pythonServiceAvailable, chromaAvailable] = await Promise.all([
    checkPythonServiceHealth(),
    checkChromaHealth(),
  ]);

  res.json({
    success: true,
    service: "blinkit-support-backend",
    status: "ok",
    openRouterConfigured: hasOpenRouterKey(),
    pythonServiceAvailable,
    chromaAvailable,
    sqliteAvailable: true,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/api/status", (_req, res) => {
  res.json({
    success: true,
    phase: 3,
    features: {
      chat: true,
      sqlite: true,
      chromadb: true,
      pythonNlp: true,
      analytics: false,
      tickets: true,
      conversationHistory: true,
    },
  });
});
