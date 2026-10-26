/**
 * Morgan-based HTTP request logger.
 * Uses a custom token format in development and
 * a compact JSON-like format in production.
 */

import morgan, { StreamOptions } from "morgan";
import { Request, Response } from "express";

// Custom token: response time with color coding in dev
morgan.token("status-colored", (_req: Request, res: Response) => {
  const status = res.statusCode;
  if (status >= 500) return `\x1b[31m${status}\x1b[0m`; // red
  if (status >= 400) return `\x1b[33m${status}\x1b[0m`; // yellow
  if (status >= 300) return `\x1b[36m${status}\x1b[0m`; // cyan
  return `\x1b[32m${status}\x1b[0m`; // green
});

const devFormat =
  ":method :url :status-colored :response-time ms - :res[content-length]";

const prodFormat =
  ':remote-addr - :method :url :status :response-time ms - :res[content-length] ":user-agent"';

const stream: StreamOptions = {
  write: (message: string) => {
    // Strip trailing newline added by morgan
    console.log(message.trim());
  },
};

const isProduction = process.env.NODE_ENV === "production";

export const requestLogger = morgan(isProduction ? prodFormat : devFormat, {
  stream,
  // Skip logging for health checks to reduce noise
  skip: (req: Request) => req.path === "/api/health",
});
