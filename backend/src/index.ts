/**
 * Express entry point for the Blinkit support backend.
 * Phase 1 goal: health check + one chat route powered by a Mastra agent.
 */

import "./config/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requestLogger } from "./middleware/logger";
import { generalLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { chatRouter } from "./routes/chat";
import { healthRouter } from "./routes/health";
import { ticketsRouter } from "./routes/tickets";
import { initDatabase } from "./database/db";
import { initChromaClient } from "./services/ragService";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use("/api", generalLimiter);

app.use(healthRouter);
app.use(chatRouter);
app.use(ticketsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

initDatabase();
void initChromaClient();

app.listen(PORT, () => {
  console.log(`[server] Blinkit support backend listening on http://localhost:${PORT}`);
  console.log(`[server] Chat endpoint: POST http://localhost:${PORT}/api/chat`);
});

export default app;
